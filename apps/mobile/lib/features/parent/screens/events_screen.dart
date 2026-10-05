import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/app_image.dart';

// Returns list of enrollments (each has `event` + `student` + status)
final _parentEventsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/events/parent/my-events');
    final data = resp.data;
    return data is List ? data : [];
  },
);

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
      ref.invalidate(_parentEventsProvider(widget.schoolId));
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
    final eventsAsync = ref.watch(_parentEventsProvider(widget.schoolId));

    return Scaffold(
      backgroundColor: const Color(0xFFF6F5FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Εκδηλώσεις', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF111827))),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Color(0xFF4F46E5)),
            onPressed: () => ref.invalidate(_parentEventsProvider(widget.schoolId)),
          ),
        ],
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Σφάλμα: $e')),
        data: (enrollments) {
          if (enrollments.isEmpty) {
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
            onRefresh: () => ref.refresh(_parentEventsProvider(widget.schoolId).future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              children: byChild.values.map((group) {
                final student = group['student'] as Map<String, dynamic>;
                final childEnrollments = group['enrollments'] as List<dynamic>;
                return _ChildEventGroup(
                  student: student,
                  enrollments: childEnrollments,
                  giving: _giving,
                  onConsent: _giveConsent,
                );
              }).toList(),
            ),
          );
        },
      ),
    );
  }
}

class _ChildEventGroup extends StatelessWidget {
  final Map<String, dynamic> student;
  final List<dynamic> enrollments;
  final Set<String> giving;
  final Future<void> Function(String, bool) onConsent;

  const _ChildEventGroup({
    required this.student,
    required this.enrollments,
    required this.giving,
    required this.onConsent,
  });

  @override
  Widget build(BuildContext context) {
    final name = student['fullName'] as String? ?? '';
    final pendingConsent = enrollments.where((e) => e['status'] == 'pending_consent').length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Child header
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: const Color(0xFFEEF2FF),
              child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(color: Color(0xFF4F46E5), fontWeight: FontWeight.bold, fontSize: 13)),
            ),
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
        ...enrollments.map((enr) => _EventCard(enrollment: enr, giving: giving, onConsent: onConsent)),
        const SizedBox(height: 20),
      ],
    );
  }
}

class _EventCard extends StatelessWidget {
  final dynamic enrollment;
  final Set<String> giving;
  final Future<void> Function(String, bool) onConsent;

  const _EventCard({required this.enrollment, required this.giving, required this.onConsent});

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
    final media = event['postMedia'] as List<dynamic>? ?? [];

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
          // Event header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
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

          if (description != null && description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(description, style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
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

          // Post-event media gallery
          if (media.isNotEmpty) ...[
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Φωτογραφίες & Βίντεο',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 80,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: media.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) {
                        final m = media[i] as Map<String, dynamic>;
                        final url = m['url'] as String? ?? '';
                        final isVideo = m['mediaType'] == 'video';
                        return GestureDetector(
                          onTap: () => _openMedia(context, url, isVideo),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Stack(
                              children: [
                                AppImage(url, width: 80, height: 80, fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      width: 80, height: 80,
                                      color: const Color(0xFFF3F4F6),
                                      child: const Icon(Icons.broken_image_outlined, color: Color(0xFF9CA3AF)),
                                    )),
                                if (isVideo)
                                  Positioned.fill(child: Container(
                                    color: Colors.black26,
                                    child: const Icon(Icons.play_circle_outline_rounded, color: Colors.white, size: 28),
                                  )),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],

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
                          child: const Text('Άρνηση', style: TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: () => onConsent(enrollmentId, true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4F46E5),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            elevation: 0,
                          ),
                          child: const Text('Δίνω Συναίνεση ✓', style: TextStyle(fontWeight: FontWeight.w700)),
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

  void _openMedia(BuildContext context, String url, bool isVideo) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            if (!isVideo)
              AppImage(url, fit: BoxFit.contain)
            else
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(url, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ),
          ],
        ),
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
