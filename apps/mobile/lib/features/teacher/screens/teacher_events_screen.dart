import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/utils/event_status.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/person_face.dart';
import 'event_post_screen.dart';
import '../../parent/screens/event_instructions.dart';

final _teacherEventsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/events/teacher/my-events');
    final data = resp.data;
    return data is List ? data : [];
  },
);

const _statusMeta = {
  'pending_consent': ('Αναμονή Συναίνεσης', Color(0xFFF59E0B)),
  'consent_given': ('Συναίνεση ✓', Color(0xFF059669)),
  'consent_declined': ('Άρνηση', Color(0xFFDC2626)),
  'pending_payment': ('Αναμονή Πληρωμής', Color(0xFF2563EB)),
  'paid': ('Εξοφλημένο ✓', Color(0xFF059669)),
};

const _eventTypeGr = {
  'excursion': 'Εκδρομή',
  'theater': 'Θεατρικό',
  'sport': 'Αθλητισμός',
  'cultural': 'Πολιτιστική',
  'other': 'Άλλο',
};

class TeacherEventsScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const TeacherEventsScreen({super.key, required this.schoolId});

  @override
  ConsumerState<TeacherEventsScreen> createState() => _TeacherEventsScreenState();
}

class _TeacherEventsScreenState extends ConsumerState<TeacherEventsScreen> {
  Future<void> _openPost(Map<String, dynamic> event) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => EventPostScreen(schoolId: widget.schoolId, event: event),
      ),
    );
    if (saved == true) ref.invalidate(_teacherEventsProvider(widget.schoolId));
  }

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(_teacherEventsProvider(widget.schoolId));

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('Εκδηλώσεις', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF111827))),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Color(0xFF4F46E5)),
            onPressed: () => ref.invalidate(_teacherEventsProvider(widget.schoolId)),
          ),
        ],
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Σφάλμα: $e')),
        data: (events) {
          if (events.isEmpty) {
            return const Center(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.event_outlined, size: 64, color: Color(0xFFD1D5DB)),
                SizedBox(height: 16),
                Text('Δεν υπάρχουν εκδηλώσεις για σένα',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 15)),
                SizedBox(height: 8),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 40),
                  child: Text(
                    'Εμφανίζονται οι δημοσιευμένες εκδηλώσεις στις οποίες σε έχει ορίσει το σχολείο.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
                  ),
                ),
              ]),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.refresh(_teacherEventsProvider(widget.schoolId).future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              itemCount: events.length,
              separatorBuilder: (_, __) => const SizedBox(height: 14),
              itemBuilder: (_, i) {
                final event = events[i] as Map<String, dynamic>;
                return _TeacherEventCard(
                  event: event,
                  onUpload: () => _openPost(event),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _TeacherEventCard extends StatefulWidget {
  final Map<String, dynamic> event;
  final VoidCallback onUpload;
  const _TeacherEventCard({required this.event, required this.onUpload});

  @override
  State<_TeacherEventCard> createState() => _TeacherEventCardState();
}

class _TeacherEventCardState extends State<_TeacherEventCard> {
  bool _showStudents = false;

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final title = event['title'] as String? ?? '';
    final eventType = event['eventType'] as String? ?? '';
    final eventDate = event['eventDate'] as String?;
    final description = event['description'] as String?;
    final dayInstructions = event['dayInstructions'] as String?;
    final cost = double.tryParse(event['costPerChild']?.toString() ?? '0') ?? 0;
    final enrollments = event['enrollments'] as List<dynamic>? ?? [];
    final media = event['postMedia'] as List<dynamic>? ?? [];
    final shownStatus = eventDisplayStatus(event['status'] as String?, eventDate);
    final statusLabel = shownStatus == 'completed' ? 'Ολοκληρωμένη' : 'Δημοσιευμένη';

    final consentedCount = enrollments.where((e) =>
      (e['status'] as String?) != 'pending_consent' &&
      (e['status'] as String?) != 'consent_declined').length;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12, offset: const Offset(0, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(title,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(_eventTypeGr[eventType] ?? eventType,
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: shownStatus == 'completed'
                                ? const Color(0xFF059669)
                                : Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(statusLabel,
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ],
                ),
                if (eventDate != null) ...[
                  const SizedBox(height: 4),
                  Row(children: [
                    const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white70),
                    const SizedBox(width: 5),
                    Text(_formatDate(eventDate), style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    if (cost > 0) ...[
                      const Text(' · ', style: TextStyle(color: Colors.white38)),
                      const Icon(Icons.euro_rounded, size: 13, color: Colors.white70),
                      Text('${cost.toStringAsFixed(2)}/παιδί', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ],
                  ]),
                ],
              ],
            ),
          ),

          if (description != null && description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Περιγραφή', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
                  const SizedBox(height: 4),
                  Text(description, style: const TextStyle(fontSize: 14, height: 1.4, color: Color(0xFF374151))),
                ],
              ),
            ),
          if (instructionLines(dayInstructions).isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: UsefulInstructions(text: dayInstructions),
            ),

          // Stats row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(children: [
              _StatChip(Icons.people_outline_rounded, '${enrollments.length} μαθητές', const Color(0xFF4F46E5)),
              const SizedBox(width: 8),
              _StatChip(Icons.check_circle_outline_rounded, '$consentedCount συναίνεσαν', const Color(0xFF059669)),
              const SizedBox(width: 8),
              _StatChip(Icons.photo_library_outlined, '${media.length} αρχεία', const Color(0xFFEA580C)),
            ]),
          ),

          // Students toggle
          if (enrollments.isNotEmpty) ...[
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            InkWell(
              onTap: () => setState(() => _showStudents = !_showStudents),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(children: [
                  const Text('Μαθητές εκδήλωσης',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                  const Spacer(),
                  Icon(_showStudents ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                      color: const Color(0xFF9CA3AF), size: 20),
                ]),
              ),
            ),
            if (_showStudents) ...[
              const Divider(height: 1, color: Color(0xFFF3F4F6)),
              ...enrollments.map((enr) {
                final e = enr as Map<String, dynamic>;
                final s = e['student'] as Map<String, dynamic>? ?? {};
                final sName = s['fullName'] as String? ?? '';
                final sPhoto = s['avatarUrl'] as String?;
                final sStatus = e['status'] as String? ?? '';
                final meta = _statusMeta[sStatus];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(children: [
                    PersonFace(name: sName, photoUrl: sPhoto, size: 28, radius: 14, fontSize: 11, foreground: const Color(0xFF4F46E5)),
                    const SizedBox(width: 10),
                    Expanded(child: Text(sName, style: const TextStyle(fontSize: 13, color: Color(0xFF374151)))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: (meta?.$2 ?? const Color(0xFF6B7280)).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(meta?.$1 ?? sStatus,
                          style: TextStyle(color: meta?.$2 ?? const Color(0xFF6B7280), fontSize: 10, fontWeight: FontWeight.w600)),
                    ),
                  ]),
                );
              }),
            ],
          ],

          // Media gallery
          if (media.isNotEmpty) ...[
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Ανεβασμένο υλικό',
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
                        return ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Stack(children: [
                            AppImage(url, width: 80, height: 80, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 80, height: 80, color: const Color(0xFFF3F4F6),
                                  child: const Icon(Icons.broken_image_outlined, color: Color(0xFF9CA3AF)),
                                )),
                            if (isVideo)
                              Positioned.fill(child: Container(
                                color: Colors.black26,
                                child: const Icon(Icons.play_circle_outline_rounded, color: Colors.white, size: 28),
                              )),
                          ]),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Upload button
          if ((event['recap'] as String?)?.trim().isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                (event['recap'] as String).trim(),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, height: 1.35, color: Color(0xFF2C2422)),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: widget.onUpload,
                icon: const Icon(Icons.photo_library_outlined, size: 18),
                label: const Text('Ανάρτηση με κείμενο και υλικό'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF77328D),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Text(
              'Οι γονείς βλέπουν το κείμενο, τις φωτογραφίες και τα βίντεο σαν ανάρτηση.',
              style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
            ),
          ),
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

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _StatChip(this.icon, this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}
