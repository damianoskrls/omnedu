import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/utils/event_status.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/person_face.dart';
import '../parent_children.dart';
import 'celebration_detail_screen.dart';
import 'event_gallery_screen.dart';
import 'event_instructions.dart';

// Returns list of enrollments (each has `event` + `student` + status)
final parentEventsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/events/parent/my-events');
    final data = resp.data;
    return data is List ? data : [];
  },
);

final _celebrationsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/celebrations');
  final data = resp.data;
  return data is List ? data : [];
});

const _statusMeta = {
  'pending_consent': ('Αναμονή Συναίνεσης', Color(0xFFF59E0B), Color(0xFFFFFBEB)),
  'consent_given': ('Συναίνεση ✓', Color(0xFF059669), Color(0xFFECFDF5)),
  'consent_declined': ('Άρνηση', Color(0xFFDC2626), Color(0xFFFEF2F2)),
  'pending_payment': ('Αναμονή Πληρωμής', Color(0xFF2563EB), Color(0xFFEFF6FF)),
  'paid': ('Εξοφλημένο ✓', Color(0xFF059669), Color(0xFFECFDF5)),
};

const _eventTypeGr = {
  'excursion': 'Εκδρομή',
  'theater': 'Θεατρικό',
  'sport': 'Αθλητική Εκδήλωση',
  'cultural': 'Πολιτιστική',
  'other': 'Άλλο',
};

class ParentEventsScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const ParentEventsScreen({super.key, required this.schoolId});

  @override
  ConsumerState<ParentEventsScreen> createState() => _ParentEventsScreenState();
}

class _ParentEventsScreenState extends ConsumerState<ParentEventsScreen> {
  final _giving = <String>{};

  Future<void> _giveConsent(String enrollmentId, bool consent) async {
    setState(() => _giving.add(enrollmentId));
    try {
      final dio = ref.read(dioProvider);
      await dio.put(
        '/schools/${widget.schoolId}/events/enrollments/$enrollmentId/consent',
        data: {'consent': consent},
      );
      ref.invalidate(parentEventsProvider(widget.schoolId));
      ref.invalidate(myChildrenProvider(widget.schoolId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Σφάλμα: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _giving.remove(enrollmentId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(parentEventsProvider(widget.schoolId));
    final celebrations = ref.watch(_celebrationsProvider(widget.schoolId)).asData?.value ?? const [];

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Εκδηλώσεις', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF111827))),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Color(0xFF77328D)),
            onPressed: () {
              ref.invalidate(parentEventsProvider(widget.schoolId));
              ref.invalidate(_celebrationsProvider(widget.schoolId));
            },
          ),
        ],
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Σφάλμα: $e')),
        data: (enrollments) {
          final celebrationCards = _celebrationSections(widget.schoolId, celebrations);
          if (enrollments.isEmpty && celebrationCards.isEmpty) {
            return const Center(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.event_outlined, size: 64, color: Color(0xFFD1D5DB)),
                SizedBox(height: 16),
                Text('Δεν υπάρχουν εκδηλώσεις', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 16)),
              ]),
            );
          }

          // Group by child
          final Map<String, Map<String, dynamic>> byChild = {};
          for (final enr in enrollments) {
            final s = enr['student'] as Map<String, dynamic>? ?? {};
            final sid = s['id'] as String? ?? '';
            byChild.putIfAbsent(sid, () => {'student': s, 'enrollments': <dynamic>[]});
            (byChild[sid]!['enrollments'] as List).add(enr);
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(parentEventsProvider(widget.schoolId));
              ref.invalidate(_celebrationsProvider(widget.schoolId));
              await ref.read(parentEventsProvider(widget.schoolId).future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              children: [
                ...celebrationCards,
                if (enrollments.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Text('Δεν υπάρχουν εκδρομές ή θέατρο.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF9CA3AF))),
                  ),
                ...byChild.values.map((group) {
                  final student = group['student'] as Map<String, dynamic>;
                  final childEnrollments = group['enrollments'] as List<dynamic>;
                  return _ChildEventGroup(
                    schoolId: widget.schoolId,
                    student: student,
                    enrollments: childEnrollments,
                    giving: _giving,
                    onConsent: _giveConsent,
                  );
                }),
              ],
            ),
          );
        },
      ),
    );
  }
}

List<Widget> _celebrationSections(String schoolId, List<dynamic> rows) {
  final grouped = <String, List<Map<String, dynamic>>>{};
  for (final row in rows) {
    if (row is! Map) continue;
    final item = Map<String, dynamic>.from(row);
    final year = item['academicYear']?.toString() ?? '';
    grouped.putIfAbsent(year, () => []).add(item);
  }
  final years = grouped.keys.toList()..sort((a, b) => b.compareTo(a));
  return [
    for (final year in years) ...[
      Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text('Γιορτές $year', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
      ),
      ...grouped[year]!.map((item) => _CelebrationCard(schoolId: schoolId, celebration: item)),
      const SizedBox(height: 12),
    ],
  ];
}

class _CelebrationCard extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> celebration;
  const _CelebrationCard({required this.schoolId, required this.celebration});

  @override
  Widget build(BuildContext context) {
    final title = celebration['title']?.toString() ?? '';
    final place = celebration['place']?.toString() ?? '';
    final details = celebration['details']?.toString() ?? '';
    final arrival = celebration['arrivalTime']?.toString() ?? '';
    final date = _formatDate(celebration['eventDate']?.toString());
    final items = _items(celebration['items']);
    final before = items.where((item) => item['phase'] != 'after').toList();
    final after = items.where((item) => item['phase'] == 'after').toList();

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          final id = celebration['id']?.toString() ?? '';
          if (id.isEmpty) return;
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CelebrationDetailScreen(
                schoolId: schoolId,
                celebrationId: id,
                initial: celebration,
              ),
            ),
          );
        },
        child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9D5FF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((celebration['imageUrl']?.toString() ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AppImage(celebration['imageUrl'].toString(), height: 160, width: double.infinity, fit: BoxFit.cover),
              ),
            ),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827))),
          Text(_audienceLabel(celebration['audienceType']?.toString()), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF77328D))),
          if (date.isNotEmpty || arrival.isNotEmpty || place.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              [date, if (arrival.isNotEmpty) 'προσέλευση $arrival', place].where((part) => part.isNotEmpty).join(' · '),
              style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
          ],
          if (details.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(details, style: const TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF374151))),
          ],
          _ItemBlock(title: 'Πριν τη γιορτή', items: before),
          _ItemBlock(title: 'Μετά τη γιορτή', items: after),
        ],
      ),
        ),
      ),
    );
  }

  String _audienceLabel(String? type) {
    if (type == 'class') return 'Για την τάξη';
    if (type == 'level') return 'Για τη βαθμίδα';
    if (type == 'teachers') return 'Για τους εκπαιδευτικούς';
    return 'Όλο το σχολείο';
  }

  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final date = DateTime.tryParse(iso);
    if (date == null) return '';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  List<Map<String, dynamic>> _items(dynamic raw) {
    dynamic parsed = raw;
    if (raw is String && raw.isNotEmpty) {
      try {
        parsed = jsonDecode(raw);
      } catch (_) {
        return [];
      }
    }
    if (parsed is! List) return [];
    return parsed.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
  }
}

class _ItemBlock extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  const _ItemBlock({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF77328D))),
          const SizedBox(height: 4),
          ...items.map((item) {
            final name = item['name']?.toString() ?? '';
            final cost = item['cost'];
            final price = cost == null || cost.toString().isEmpty ? '' : ' · $cost€';
            return Text('$name$price', style: const TextStyle(fontSize: 13, color: Color(0xFF374151)));
          }),
        ],
      ),
    );
  }
}

class _ChildEventGroup extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> student;
  final List<dynamic> enrollments;
  final Set<String> giving;
  final Future<void> Function(String, bool) onConsent;

  const _ChildEventGroup({
    required this.schoolId,
    required this.student,
    required this.enrollments,
    required this.giving,
    required this.onConsent,
  });

  @override
  Widget build(BuildContext context) {
    final name = student['fullName'] as String? ?? '';
    final photo = student['avatarUrl'] as String?;
    final pendingConsent = enrollments.where((e) => e['status'] == 'pending_consent').length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Child header
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            PersonFace(name: name, photoUrl: photo, size: 32, radius: 16, fontSize: 13),
            const SizedBox(width: 8),
            Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF111827))),
            if (pendingConsent > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFF59E0B), borderRadius: BorderRadius.circular(20)),
                child: Text('$pendingConsent εκκρεμεί',
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ],
          ]),
        ),
        ...enrollments.map((enr) => _EventCard(schoolId: schoolId, enrollment: enr, giving: giving, onConsent: onConsent)),
        const SizedBox(height: 20),
      ],
    );
  }
}

class _EventCard extends StatelessWidget {
  final String schoolId;
  final dynamic enrollment;
  final Set<String> giving;
  final Future<void> Function(String, bool) onConsent;

  const _EventCard({required this.schoolId, required this.enrollment, required this.giving, required this.onConsent});

  @override
  Widget build(BuildContext context) {
    final enr = enrollment as Map<String, dynamic>;
    final event = enr['event'] as Map<String, dynamic>? ?? {};
    final enrollmentId = enr['id'] as String? ?? '';
    final status = enr['status'] as String? ?? '';
    final eventTitle = event['title'] as String? ?? '';
    final eventType = event['eventType'] as String? ?? '';
    final eventDate = event['eventDate'] as String?;
    final cost = double.tryParse(event['costPerChild']?.toString() ?? '0') ?? 0;
    final description = event['description'] as String?;
    final dayInstructions = event['dayInstructions'] as String?;
    final recap = (event['recap'] as String?)?.trim() ?? '';
    final media = eventMediaList(event['postMedia']);
    final completed = eventDisplayStatus(event['status'] as String?, eventDate) == 'completed';

    final meta = _statusMeta[status];
    final statusLabel = meta?.$1 ?? status;
    final statusColor = meta?.$2 ?? const Color(0xFF6B7280);
    final statusBg = meta?.$3 ?? const Color(0xFFF3F4F6);

    final isLoading = giving.contains(enrollmentId);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: InkWell(
              onTap: () => openParentEvent(context, schoolId, event['id']?.toString() ?? ''),
              child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF77328D), Color(0xFFE95926)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.event_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(eventTitle, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF111827))),
                      const SizedBox(height: 2),
                      Row(children: [
                        Text(_eventTypeGr[eventType] ?? eventType,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                        if (eventDate != null) ...[
                          const Text(' · ', style: TextStyle(color: Color(0xFF9CA3AF))),
                          Text(_formatDate(eventDate), style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                        ],
                      ]),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(10)),
                  child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            ),
          ),

          if (recap.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(recap, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, height: 1.4, color: Color(0xFF2C2422))),
            )
          else if (description != null && description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Περιγραφή', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF77328D))),
                  const SizedBox(height: 4),
                  Text(description, style: const TextStyle(fontSize: 14, height: 1.4, color: Color(0xFF374151))),
                ],
              ),
            ),
          if (instructionLines(dayInstructions).isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: UsefulInstructions(text: dayInstructions),
            ),

          // Cost row
          if (cost > 0)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF3F4F6)),
              ),
              child: Row(children: [
                const Icon(Icons.euro_rounded, size: 16, color: Color(0xFF6B7280)),
                const SizedBox(width: 6),
                Text('Κόστος ανά παιδί: €${cost.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF374151), fontWeight: FontWeight.w500)),
              ]),
            ),

          const Divider(height: 1, color: Color(0xFFF3F4F6)),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: () => openEventGallery(context, event),
                  child: Row(
                    children: [
                      Icon(completed ? Icons.photo_library_rounded : Icons.lock_clock_rounded, size: 16, color: const Color(0xFF77328D)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          (completed || recap.isNotEmpty || media.isNotEmpty)
                              ? 'Ανάρτηση εκδήλωσης'
                              : 'Η ανάρτηση εμφανίζεται μετά την εκδήλωση',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF77328D)),
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: Color(0xFF77328D), size: 20),
                    ],
                  ),
                ),
                if (completed && media.isEmpty && recap.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 8, bottom: 4),
                    child: Text(
                      'Ο εκπαιδευτικός δεν έχει ανεβάσει ακόμα την ανάρτηση.',
                      style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                    ),
                  ),
                if (media.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 80,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: media.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) {
                        final m = media[i];
                        final url = m['url'] as String? ?? '';
                        final isVideo = m['mediaType'] == 'video';
                        return GestureDetector(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => EventMediaViewer(url: url, isVideo: isVideo)),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Stack(
                              children: [
                                if (isVideo)
                                  Container(
                                    width: 80,
                                    height: 80,
                                    color: const Color(0xFF2C2422),
                                    child: const Icon(Icons.play_circle_outline_rounded, color: Colors.white, size: 28),
                                  )
                                else
                                  AppImage(url, width: 80, height: 80, fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        width: 80, height: 80,
                                        color: const Color(0xFFF3F4F6),
                                        child: const Icon(Icons.broken_image_outlined, color: Color(0xFF9CA3AF)),
                                      )),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Consent buttons
          if (status == 'pending_consent')
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: isLoading
                  ? const Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2)))
                  : Row(children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => onConsent(enrollmentId, false),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFDC2626),
                            side: const BorderSide(color: Color(0xFFFCA5A5)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                          child: const Text('Όχι', style: TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: () => onConsent(enrollmentId, true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF77328D),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            elevation: 0,
                          ),
                          child: const Text('Συναινώ', style: TextStyle(fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ]),
            )
          else
            const SizedBox(height: 4),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      const months = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      return '${dt.day} ${months[dt.month]} ${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

void openParentEvent(BuildContext context, String schoolId, String eventId) {
  if (schoolId.isEmpty || eventId.isEmpty) return;
  Navigator.push(
    context,
    MaterialPageRoute(builder: (_) => ParentEventScreen(schoolId: schoolId, eventId: eventId)),
  );
}

class ParentEventScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String eventId;
  const ParentEventScreen({super.key, required this.schoolId, required this.eventId});

  @override
  ConsumerState<ParentEventScreen> createState() => _ParentEventScreenState();
}

class _ParentEventScreenState extends ConsumerState<ParentEventScreen> {
  final _giving = <String>{};

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (!mounted) return;
      ref.invalidate(parentEventsProvider(widget.schoolId));
    });
  }

  Future<void> _giveConsent(String enrollmentId, bool consent) async {
    setState(() => _giving.add(enrollmentId));
    try {
      final dio = ref.read(dioProvider);
      await dio.put(
        '/schools/${widget.schoolId}/events/enrollments/$enrollmentId/consent',
        data: {'consent': consent},
      );
      ref.invalidate(parentEventsProvider(widget.schoolId));
      ref.invalidate(myChildrenProvider(widget.schoolId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Δεν αποθηκεύτηκε η απάντηση. Δοκίμασε ξανά.'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _giving.remove(enrollmentId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final events = ref.watch(parentEventsProvider(widget.schoolId));
    return events.when(
      loading: () => const Scaffold(
        backgroundColor: Color(0xFFF6F3FA),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
      ),
      error: (_, __) => Scaffold(
        appBar: AppBar(title: const Text('Εκδήλωση')),
        body: const Center(child: Text('Η εκδήλωση δεν φορτώθηκε.')),
      ),
      data: (rows) {
        Map<String, dynamic>? event;
        final enrollments = <Map<String, dynamic>>[];
        for (final row in rows) {
          if (row is! Map) continue;
          final item = Map<String, dynamic>.from(row);
          final current = item['event'];
          if (current is! Map || current['id']?.toString() != widget.eventId) continue;
          event ??= Map<String, dynamic>.from(current);
          enrollments.add(item);
        }
        if (event == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Εκδήλωση')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Η εκδήλωση δεν είναι διαθέσιμη.', textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => ref.invalidate(parentEventsProvider(widget.schoolId)),
                      child: const Text('Ανανέωση'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }
        return _EventDetailBody(
          event: event,
          enrollments: enrollments,
          giving: _giving,
          onConsent: _giveConsent,
        );
      },
    );
  }
}

class _EventDetailBody extends StatelessWidget {
  final Map<String, dynamic> event;
  final List<Map<String, dynamic>> enrollments;
  final Set<String> giving;
  final Future<void> Function(String, bool) onConsent;

  const _EventDetailBody({
    required this.event,
    required this.enrollments,
    required this.giving,
    required this.onConsent,
  });

  @override
  Widget build(BuildContext context) {
    final title = event['title']?.toString() ?? 'Εκδήλωση';
    final eventType = event['eventType']?.toString() ?? '';
    final description = (event['description']?.toString() ?? '').trim();
    final dayInstructions = event['dayInstructions']?.toString();
    final recap = (event['recap']?.toString() ?? '').trim();
    final date = event['eventDate']?.toString();
    final when = date == null || date.isEmpty ? '' : _formatEventDate(date);
    final cost = double.tryParse(event['costPerChild']?.toString() ?? '') ?? 0;
    final media = eventMediaList(event['postMedia']);
    final completed = eventDisplayStatus(event['status']?.toString(), date) == 'completed';
    final teachers = event['teachers'] as List<dynamic>? ?? [];
    final names = teachers.map((row) {
      if (row is! Map) return '';
      final user = row['user'];
      if (user is! Map) return '';
      return user['fullName']?.toString() ?? '';
    }).where((name) => name.isNotEmpty).join(', ');

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF111827))),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
        children: [
          Text(_eventTypeGr[eventType] ?? 'Εκδήλωση', style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w800)),
          if (when.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(when, style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
          ],
          if (cost > 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Text(
                'Κόστος συμμετοχής ανά παιδί: ${cost.toStringAsFixed(2)} €',
                style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF111827)),
              ),
            ),
          ],
          if (names.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Εκπαιδευτικοί: $names', style: const TextStyle(color: Color(0xFF6B7280))),
          ],
          if (description.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Text('Περιγραφή', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF77328D))),
            const SizedBox(height: 6),
            Text(description, style: const TextStyle(fontSize: 15, height: 1.45, color: Color(0xFF374151))),
          ],
          if (instructionLines(dayInstructions).isNotEmpty) ...[
            const SizedBox(height: 16),
            UsefulInstructions(text: dayInstructions),
          ],
          if (recap.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Ανασκόπηση', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF77328D))),
            const SizedBox(height: 6),
            Text(recap, style: const TextStyle(fontSize: 15, height: 1.45, color: Color(0xFF2C2422))),
          ],
          const SizedBox(height: 18),
          ...enrollments.map((enrollment) => _ConsentBlock(
                enrollment: enrollment,
                loading: giving.contains(enrollment['id']?.toString() ?? ''),
                onConsent: onConsent,
              )),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => openEventGallery(context, event),
            icon: Icon(completed || media.isNotEmpty || recap.isNotEmpty ? Icons.photo_library_rounded : Icons.lock_clock_rounded),
            label: Text(
              (completed || media.isNotEmpty || recap.isNotEmpty)
                  ? 'Ανάρτηση εκδήλωσης'
                  : 'Η ανάρτηση εμφανίζεται μετά την εκδήλωση',
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF77328D),
              side: const BorderSide(color: Color(0xFF77328D)),
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsentBlock extends StatelessWidget {
  final Map<String, dynamic> enrollment;
  final bool loading;
  final Future<void> Function(String, bool) onConsent;

  const _ConsentBlock({required this.enrollment, required this.loading, required this.onConsent});

  @override
  Widget build(BuildContext context) {
    final enrollmentId = enrollment['id']?.toString() ?? '';
    final status = enrollment['status']?.toString() ?? '';
    final student = enrollment['student'] as Map?;
    final name = student?['fullName']?.toString() ?? '';
    final meta = _statusMeta[status];
    final pending = status == 'pending_consent';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: pending ? const Color(0xFFF6C7B8) : const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (name.isNotEmpty)
            Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF111827))),
          if (meta != null) ...[
            const SizedBox(height: 6),
            Text(meta.$1, style: TextStyle(color: meta.$2, fontWeight: FontWeight.w700)),
          ],
          if (pending) ...[
            const SizedBox(height: 8),
            const Text(
              'Θέλεις να συμμετέχει το παιδί;',
              style: TextStyle(fontSize: 14, color: Color(0xFF374151)),
            ),
            const SizedBox(height: 12),
            if (loading)
              const Center(child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF77328D))))
            else
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: enrollmentId.isEmpty ? null : () => onConsent(enrollmentId, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        minimumSize: const Size.fromHeight(56),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Όχι', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: enrollmentId.isEmpty ? null : () => onConsent(enrollmentId, true),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF77328D),
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(56),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Συναινώ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }
}

String _formatEventDate(String iso) {
  try {
    final dt = DateTime.parse(iso).toLocal();
    const months = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    return '${dt.day} ${months[dt.month]} ${dt.year}';
  } catch (_) {
    return iso;
  }
}
