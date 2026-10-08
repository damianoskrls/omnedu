import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/person_face.dart';

const dayHistoryColors = [Color(0xFF77328D), Color(0xFFE95926)];

final childDayReportsProvider =
    FutureProvider.family<List<dynamic>, ({String schoolId, String studentId})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/daily-reports/student/${key.studentId}',
      queryParameters: {'limit': 20},
    );
    return resp.data is List ? resp.data as List<dynamic> : [];
  },
);

final childReportRangeProvider = FutureProvider.family<List<dynamic>, ({String schoolId, String studentId, String from, String to})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/daily-reports/student/${key.studentId}',
      queryParameters: {'from': key.from, 'to': key.to},
    );
    return resp.data is List ? resp.data as List<dynamic> : [];
  },
);

final dayHistoryMenuProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final today = dayHistoryIso(DateTime.now());
  try {
    final resp = await dio.get('/schools/$schoolId/daily-menus/$today');
    return resp.data as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

String dayHistoryIso(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Widget _childLabel(Map<String, dynamic> child) {
  final mention = ChildMention.fromMap(child);
  if (mention == null) return const SizedBox.shrink();
  return Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: ChildMentions(people: [mention]),
  );
}

class DayHistoryPanel extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  final bool showMenu;
  final String? heading;

  const DayHistoryPanel({
    super.key,
    required this.schoolId,
    required this.child,
    this.showMenu = true,
    this.heading,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menuAsync = ref.watch(dayHistoryMenuProvider(schoolId));
    const colors = dayHistoryColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (heading != null && heading!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Text(
              heading!,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF2C2422)),
            ),
          ),
        daySectionTitle(Icons.today_rounded, 'Ενημέρωση Σήμερα', colors),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: ChildTodayUpdate(schoolId: schoolId, child: child),
        ),
        if (showMenu) ...[
          daySectionTitle(Icons.restaurant_rounded, 'Διατροφολόγιο Σήμερα', colors),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: menuAsync.when(
              loading: () => const DayHistoryLoadingCard(),
              error: (_, __) => DayHistoryEmptyCard('Δεν υπάρχει καταχωρημένο μενού', child: child),
              data: (menu) => menu == null
                  ? DayHistoryEmptyCard('Δεν υπάρχει καταχωρημένο μενού για σήμερα', child: child)
                  : DayMenuCard(menu: menu, colors: colors, child: child),
            ),
          ),
        ],
        daySectionTitle(Icons.history_rounded, 'Πρόσφατες Ενημερώσεις', colors),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: ChildRecentUpdates(schoolId: schoolId, child: child, archive: true),
        ),
        _InstructionsBlock(child: child, colors: colors),
        _EventsBlock(child: child, colors: colors),
      ],
    );
  }
}

Widget daySectionTitle(IconData icon, String title, List<Color> colors, {String? badge}) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
    child: Row(
      children: [
        Icon(icon, color: colors[0], size: 20),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors[0]),
        ),
        if (badge != null && badge.isNotEmpty) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: const Color(0xFFE95926), borderRadius: BorderRadius.circular(20)),
            child: Text(badge, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
          ),
        ],
      ],
    ),
  );
}

class ChildTodayUpdate extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ChildTodayUpdate({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final reportsAsync = ref.watch(childDayReportsProvider((schoolId: schoolId, studentId: studentId)));
    final todayStr = dayHistoryIso(DateTime.now());
    const colors = dayHistoryColors;
    return reportsAsync.when(
      loading: () => const DayHistoryLoadingCard(),
      error: (_, __) => DayHistoryEmptyCard('Σφάλμα φόρτωσης', child: child),
      data: (reports) {
        Map<String, dynamic>? todayReport;
        for (final raw in reports) {
          if (raw is! Map) continue;
          final date = raw['reportDate']?.toString() ?? '';
          if (date.startsWith(todayStr)) {
            todayReport = Map<String, dynamic>.from(raw);
            break;
          }
        }
        if (todayReport == null) {
          return DayHistoryEmptyCard('Δεν υπάρχει ενημέρωση για σήμερα ακόμα', child: child);
        }
        return DayDiaryCard(report: todayReport, colors: colors, child: child);
      },
    );
  }
}

DateTime? reportCalendarDay(dynamic raw) {
  if (raw is! Map) return null;
  final date = (raw['reportDate']?.toString() ?? '').split('T').first;
  final parts = date.split('-');
  if (parts.length != 3) return null;
  final year = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  final day = int.tryParse(parts[2]);
  if (year == null || month == null || day == null) return null;
  return DateTime(year, month, day);
}

String reportKey(dynamic raw) {
  if (raw is! Map) return '';
  final id = raw['id']?.toString() ?? '';
  if (id.isNotEmpty) return id;
  return raw['reportDate']?.toString() ?? '';
}

class ChildRecentUpdates extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  final bool archive;
  const ChildRecentUpdates({super.key, required this.schoolId, required this.child, this.archive = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final reportsAsync = ref.watch(childDayReportsProvider((schoolId: schoolId, studentId: studentId)));
    final today = DateTime.now();
    final todayDay = DateTime(today.year, today.month, today.day);
    final weekStart = todayDay.subtract(const Duration(days: 7));
    const colors = dayHistoryColors;
    return reportsAsync.when(
      loading: () => const DayHistoryLoadingCard(),
      error: (_, __) => const SizedBox.shrink(),
      data: (reports) {
        final earlier = reports.where((raw) {
          final day = reportCalendarDay(raw);
          return day != null && day.isBefore(todayDay);
        }).toList();
        final recent = archive
            ? earlier.take(7).toList()
            : earlier.where((raw) {
                final day = reportCalendarDay(raw);
                return day != null && !day.isBefore(weekStart);
              }).toList();
        if (recent.isEmpty && !archive) {
          return DayHistoryEmptyCard('Δεν υπάρχουν ενημερώσεις της τελευταίας εβδομάδας', child: child);
        }
        final shown = recent.map(reportKey).where((id) => id.isNotEmpty).toSet();
        return Column(
          children: [
            if (recent.isEmpty)
              DayHistoryEmptyCard('Δεν υπάρχουν προηγούμενες ενημερώσεις', child: child)
            else
              for (final raw in recent)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: DayDiaryCard(
                    report: Map<String, dynamic>.from(raw as Map),
                    colors: colors,
                    child: child,
                  ),
                ),
            if (archive) ...[
              const SizedBox(height: 4),
              _ArchiveButton(
                label: 'Δείτε τις προηγούμενες του μήνα',
                onTap: () => _openArchive(context, scope: 'month', exclude: shown),
              ),
              const SizedBox(height: 8),
              _ArchiveButton(
                label: 'Δείτε τις προηγούμενες του έτους',
                onTap: () => _openArchive(context, scope: 'year', exclude: shown),
              ),
            ],
          ],
        );
      },
    );
  }

  void _openArchive(BuildContext context, {required String scope, required Set<String> exclude}) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UpdateArchiveScreen(
          schoolId: schoolId,
          child: child,
          scope: scope,
          exclude: exclude,
        ),
      ),
    );
  }
}

class _ArchiveButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _ArchiveButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF77328D),
          side: const BorderSide(color: Color(0xFF77328D)),
          minimumSize: const Size.fromHeight(44),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }
}

class UpdateArchiveScreen extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  final String scope;
  final Set<String> exclude;
  const UpdateArchiveScreen({
    super.key,
    required this.schoolId,
    required this.child,
    required this.scope,
    required this.exclude,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    late final DateTime from;
    late final DateTime to;
    late final String title;
    if (scope == 'year') {
      final startYear = now.month >= 9 ? now.year : now.year - 1;
      from = DateTime(startYear, 9, 1);
      final yearEnd = DateTime(startYear + 1, 7, 31);
      to = yesterday.isBefore(yearEnd) ? yesterday : yearEnd;
      final endShort = ((startYear + 1) % 100).toString().padLeft(2, '0');
      title = 'Ενημερώσεις $startYear-$endShort';
    } else {
      from = DateTime(now.year, now.month, 1);
      to = yesterday;
      const months = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
      title = 'Ενημερώσεις ${months[now.month]}';
    }
    final range = (schoolId: schoolId, studentId: studentId, from: dayHistoryIso(from), to: dayHistoryIso(to));
    final reportsAsync = to.isBefore(from) ? null : ref.watch(childReportRangeProvider(range));

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF77328D),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF2C2422))),
      ),
      body: reportsAsync == null
          ? const Center(child: Text('Δεν υπάρχουν παλαιότερες ενημερώσεις.', style: TextStyle(color: Color(0xFF9CA3AF))))
          : reportsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
              error: (_, __) => const Center(
                child: Text('Οι ενημερώσεις δεν φορτώθηκαν.', style: TextStyle(color: Color(0xFF9CA3AF))),
              ),
              data: (reports) {
                final older = reports.where((raw) => !exclude.contains(reportKey(raw))).toList();
                if (older.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text(
                        'Δεν υπάρχουν παλαιότερες ενημερώσεις σε αυτή την περίοδο.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 15),
                      ),
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  itemCount: older.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => DayDiaryCard(
                    report: Map<String, dynamic>.from(older[index] as Map),
                    colors: dayHistoryColors,
                    child: child,
                  ),
                );
              },
            ),
    );
  }
}

class SharedTodayMenu extends ConsumerWidget {
  final String schoolId;
  final List<Map<String, dynamic>> children;
  const SharedTodayMenu({super.key, required this.schoolId, required this.children});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menuAsync = ref.watch(dayHistoryMenuProvider(schoolId));
    return menuAsync.when(
      loading: () => const DayHistoryLoadingCard(),
      error: (_, __) => DayHistoryEmptyCard('Δεν υπάρχει καταχωρημένο μενού', children: children),
      data: (menu) => menu == null
          ? DayHistoryEmptyCard('Δεν υπάρχει καταχωρημένο μενού για σήμερα', children: children)
          : DayMenuCard(menu: menu, colors: dayHistoryColors, children: children),
    );
  }
}

bool childHasInstructions(Map<String, dynamic> child) {
  final enrollments = child['enrollments'] as List? ?? [];
  if (enrollments.isEmpty || enrollments.first is! Map) return false;
  final instructions = enrollments.first['class']?['instructions'];
  return instructions is List && instructions.isNotEmpty;
}

bool childHasEvents(Map<String, dynamic> child) {
  final events = child['eventEnrollments'];
  return events is List && events.isNotEmpty;
}

int childPendingEvents(Map<String, dynamic> child) {
  final events = child['eventEnrollments'];
  if (events is! List) return 0;
  return events.where((row) {
    if (row is! Map) return false;
    final status = row['status'] as String?;
    return status == 'pending_consent' || status == 'pending_payment';
  }).length;
}

class ChildInstructionCards extends StatelessWidget {
  final Map<String, dynamic> child;
  const ChildInstructionCards({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return _InstructionsBlock(child: child, colors: dayHistoryColors, showTitle: false);
  }
}

class ChildEventCards extends StatelessWidget {
  final Map<String, dynamic> child;
  const ChildEventCards({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return _EventsBlock(child: child, colors: dayHistoryColors, showTitle: false);
  }
}

class DayHistoryLoadingCard extends StatelessWidget {
  const DayHistoryLoadingCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 80,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
      child: const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
    );
  }
}

class DayHistoryEmptyCard extends StatelessWidget {
  final String message;
  final Map<String, dynamic>? child;
  final List<Map<String, dynamic>> children;
  const DayHistoryEmptyCard(this.message, {super.key, this.child, this.children = const []});

  @override
  Widget build(BuildContext context) {
    final people = (children.isNotEmpty ? children : [if (child != null) child!])
        .map(ChildMention.fromMap)
        .whereType<ChildMention>()
        .toList();
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (people.isNotEmpty) ...[
            ChildMentions(people: people),
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: Color(0xFF77328D), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(message, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InstructionsBlock extends StatelessWidget {
  final Map<String, dynamic> child;
  final List<Color> colors;
  final bool showTitle;
  const _InstructionsBlock({required this.child, required this.colors, this.showTitle = true});

  @override
  Widget build(BuildContext context) {
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    final instructions = enrollments.isNotEmpty
        ? (enrollments.first['class']?['instructions'] as List<dynamic>? ?? [])
        : <dynamic>[];
    if (instructions.isEmpty) return const SizedBox.shrink();
    final cards = instructions.map((instr) {
            final i = instr as Map<String, dynamic>;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7F4),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFF6C7B8)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _childLabel(child),
                Row(children: [
                  Expanded(
                    child: Text(i['title'] as String? ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF77328D))),
                  ),
                  if ((i['category'] as String?)?.isNotEmpty == true)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE95926).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(i['category'] as String,
                          style: const TextStyle(fontSize: 10, color: Color(0xFFE95926), fontWeight: FontWeight.w600)),
                    ),
                ]),
                const SizedBox(height: 4),
                Text(i['content'] as String? ?? '',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF4B3A36))),
              ]),
            );
    });
    if (!showTitle) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
        child: Column(children: cards.toList()),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        daySectionTitle(Icons.assignment_rounded, 'Οδηγίες από το Σχολείο', colors),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Column(children: cards.toList()),
        ),
      ],
    );
  }
}

class _EventsBlock extends StatelessWidget {
  final Map<String, dynamic> child;
  final List<Color> colors;
  final bool showTitle;
  const _EventsBlock({required this.child, required this.colors, this.showTitle = true});

  @override
  Widget build(BuildContext context) {
    final eventEnrollments = child['eventEnrollments'] as List<dynamic>? ?? [];
    if (eventEnrollments.isEmpty) return const SizedBox.shrink();
    final pending = childPendingEvents(child);
    final cards = eventEnrollments.take(5).map((enr) {
            final e = enr as Map<String, dynamic>;
            final event = e['event'] as Map<String, dynamic>? ?? {};
            final status = e['status'] as String? ?? '';
            const statusColors = {
              'pending_consent': (Color(0xFFE95926), Color(0xFFFFF7F4)),
              'pending_payment': (Color(0xFF77328D), Color(0xFFF6F3FA)),
              'paid': (Color(0xFF059669), Color(0xFFECFDF5)),
              'consent_given': (Color(0xFF059669), Color(0xFFECFDF5)),
              'consent_declined': (Color(0xFFDC2626), Color(0xFFFEF2F2)),
            };
            const statusLabels = {
              'pending_consent': 'Αναμονή Συναίνεσης',
              'pending_payment': 'Αναμονή Πληρωμής',
              'paid': 'Εξοφλημένο ✓',
              'consent_given': 'Συναίνεση ✓',
              'consent_declined': 'Άρνηση',
            };
            final sc = statusColors[status] ?? (const Color(0xFF6B7280), const Color(0xFFF3F4F6));
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF0E6F4)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _childLabel(child),
                Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(event['title'] as String? ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF2C2422))),
                  if ((event['eventDate'] as String?) != null)
                    Text(_formatEventDate(event['eventDate'] as String),
                        style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                ])),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: sc.$2, borderRadius: BorderRadius.circular(8)),
                  child: Text(statusLabels[status] ?? status,
                      style: TextStyle(color: sc.$1, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ]),
              ]),
            );
    });
    final list = Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(children: cards.toList()),
    );
    if (!showTitle) return list;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        daySectionTitle(
          Icons.event_rounded,
          'Εκδηλώσεις',
          colors,
          badge: pending > 0 ? '$pending εκκρεμεί' : null,
        ),
        list,
      ],
    );
  }

  String _formatEventDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      const months = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      return '${dt.day} ${months[dt.month]} ${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

class DayDiaryCard extends StatelessWidget {
  final Map<String, dynamic> report;
  final List<Color> colors;
  final Map<String, dynamic>? child;
  const DayDiaryCard({super.key, required this.report, required this.colors, this.child});

  static const _moodEmojis = {
    'χαρούμενος': '😊', 'happy': '😊', 'ήρεμος': '😌', 'calm': '😌',
    'κουρασμένος': '😴', 'tired': '😴', 'λυπημένος': '😢', 'sad': '😢',
    'αγχωμένος': '😰', 'anxious': '😰', 'ενθουσιασμένος': '🤩',
  };

  static const _moodLabels = {
    'χαρούμενος': 'Χαρούμενος', 'happy': 'Χαρούμενος',
    'ήρεμος': 'Ήρεμος', 'calm': 'Ήρεμος',
    'κουρασμένος': 'Κουρασμένος', 'tired': 'Κουρασμένος',
    'λυπημένος': 'Λυπημένος', 'sad': 'Λυπημένος',
    'αγχωμένος': 'Αγχωμένος', 'anxious': 'Αγχωμένος',
    'ενθουσιασμένος': 'Ενθουσιασμένος',
  };

  static const _mealLabels = {
    'all': 'Όλο', 'most': 'Τα πιο πολλά', 'half': 'Τα μισά',
    'little': 'Λίγο', 'none': 'Καθόλου',
  };

  @override
  Widget build(BuildContext context) {
    final mood = report['mood'] as String?;
    final notes = report['notes'] as String?;
    final date = report['reportDate'] as String?;
    final teacher = report['teacher'] as Map<String, dynamic>?;
    final teacherName = teacher?['fullName'] as String? ?? '';
    final teacherPhoto = teacher?['avatarUrl'] as String?;
    final emoji = mood != null ? (_moodEmojis[mood.toLowerCase()] ?? '😐') : '😐';
    final moodLabel = mood != null ? (_moodLabels[mood.toLowerCase()] ?? mood) : '';

    final mealBreakfast = _text(report['mealBreakfast']);
    final mealLunch = _text(report['mealLunch']);
    final nap1 = _number(report['napDurationMinutes']);
    final nap2 = _number(report['nap2DurationMinutes']);
    final bathroomCount = _number(report['bathroomCount']);
    final diaperChanges = _number(report['diaperChanges']);
    final rawActs = report['activities'];
    final activities = rawActs is List ? rawActs.cast<String>() : <String>[];

    final hasMeals = mealBreakfast != null || mealLunch != null;
    final hasBathroom = bathroomCount > 0 || diaperChanges > 0;
    final hasSleep = nap1 > 0 || nap2 > 0;
    final hasActivities = activities.isNotEmpty;
    final hasDetails = hasMeals || hasBathroom || hasSleep || hasActivities;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: colors[0].withOpacity(0.08), blurRadius: 16, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (child != null) _childLabel(child!),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [colors[0].withOpacity(0.12), colors[1].withOpacity(0.12)]),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  date != null ? _formatDate(date) : '',
                  style: TextStyle(color: colors[0], fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
              const Spacer(),
              if (mood != null) ...[
                Text(emoji, style: const TextStyle(fontSize: 24)),
                const SizedBox(width: 6),
                Text(moodLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
              ],
            ],
          ),
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF6F3FA),
                borderRadius: BorderRadius.circular(10),
                border: Border(left: BorderSide(color: colors[1], width: 3)),
              ),
              child: Text(
                '"$notes"',
                style: const TextStyle(color: Color(0xFF4B3A36), fontSize: 13, height: 1.5, fontStyle: FontStyle.italic),
              ),
            ),
          ],
          if (hasDetails) ...[
            const SizedBox(height: 12),
            const Divider(color: Color(0xFFF3F4F6), height: 1),
            const SizedBox(height: 10),
          ],
          if (hasMeals)
            _detailRow('🍽', 'Φαγητό', [
              if (mealBreakfast != null) 'Πρωινό: ${_mealLabels[mealBreakfast] ?? mealBreakfast}',
              if (mealLunch != null) 'Μεσημ.: ${_mealLabels[mealLunch] ?? mealLunch}',
            ].join(' • ')),
          if (hasBathroom)
            _detailRow('🚽', 'Τουαλέτα', [
              if (bathroomCount > 0) 'Κακά ✓',
              if (diaperChanges > 0) 'Τσίσα ✓',
            ].join(' • ')),
          if (hasSleep)
            _detailRow('😴', 'Ύπνος', [
              if (nap1 > 0) '1η: ${_napLabel(nap1)}',
              if (nap2 > 0) '2η: ${_napLabel(nap2)}',
            ].join(' • ')),
          if (hasActivities) _detailRow('🎨', 'Δραστηριότητες', activities.join(', ')),
          if (teacherName.isNotEmpty) ...[
            if (hasDetails) const SizedBox(height: 6) else const SizedBox(height: 10),
            Row(
              children: [
                if (teacherPhoto != null && teacherPhoto.isNotEmpty)
                  PersonFace(name: teacherName, photoUrl: teacherPhoto, size: 16, radius: 8, fontSize: 8, foreground: colors[0])
                else
                  Icon(Icons.person_outline_rounded, size: 14, color: colors[0].withOpacity(0.7)),
                const SizedBox(width: 4),
                Text(
                  teacherName,
                  style: TextStyle(fontSize: 12, color: colors[0].withOpacity(0.7), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _detailRow(String icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 12)),
          const SizedBox(width: 6),
          Text('$label: ', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12, fontWeight: FontWeight.w600)),
          Expanded(child: Text(value, style: const TextStyle(color: Color(0xFF4B5563), fontSize: 12))),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      const months = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      return '${d.day} ${months[d.month - 1]} ${d.year}';
    } catch (_) {
      return iso;
    }
  }

  String? _text(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
  }

  int _number(dynamic value) => value is num ? value.toInt() : 0;

  String _napLabel(int minutes) {
    if (minutes == 0) return 'Καθόλου';
    if (minutes < 60) return '$minutes\'';
    if (minutes == 60) return '1 ώρα';
    if (minutes == 90) return '1½ ώρα';
    return '${minutes ~/ 60} ώρες';
  }
}

class DayMenuCard extends StatelessWidget {
  final Map<String, dynamic> menu;
  final List<Color> colors;
  final Map<String, dynamic>? child;
  final List<Map<String, dynamic>> children;
  const DayMenuCard({super.key, required this.menu, required this.colors, this.child, this.children = const []});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Πρωινό', Icons.free_breakfast_rounded, menu['breakfast']),
      ('Δεκατιανό', Icons.apple_rounded, menu['midMorning']),
      ('Μεσημεριανό', Icons.lunch_dining_rounded, menu['lunch']),
      ('Απογευματινό', Icons.icecream_rounded, menu['afternoon']),
    ];

    final filled = items.where((i) => i.$3 != null && (i.$3 as String).isNotEmpty).toList();
    if (filled.isEmpty) {
      return DayHistoryEmptyCard('Δεν υπάρχει καταχωρημένο μενού για σήμερα', child: child, children: children);
    }
    final people = (children.isNotEmpty ? children : [if (child != null) child!])
        .map(ChildMention.fromMap)
        .whereType<ChildMention>()
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: colors[0].withOpacity(0.08), blurRadius: 16, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        children: [
          if (people.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
              child: Align(alignment: Alignment.centerLeft, child: ChildMentions(people: people)),
            ),
          ...filled.map((item) {
            final isLast = filled.last == item && (menu['notes'] == null || (menu['notes'] as String).isEmpty);
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: BoxDecoration(
                border: isLast ? null : const Border(bottom: BorderSide(color: Color(0xFFF3F4F6), width: 1)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [colors[0].withOpacity(0.14), colors[1].withOpacity(0.14)],
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(item.$2, color: colors[0], size: 18),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.$1,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFE95926),
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          item.$3 as String,
                          style: const TextStyle(fontSize: 14, color: Color(0xFF2C2422), fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
          if (menu['notes'] != null && (menu['notes'] as String).isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: Color(0xFFF6F3FA),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(18)),
              ),
              child: Text('📝 ${menu['notes']}', style: TextStyle(color: colors[0], fontSize: 12)),
            ),
        ],
      ),
    );
  }
}
