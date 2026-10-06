import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../bulletin_subjects.dart';

final childReportsProvider =
    FutureProvider.family<List<dynamic>, ({String schoolId, String studentId})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/daily-reports/student/${key.studentId}',
      queryParameters: {'limit': 60},
    );
    return resp.data is List ? resp.data as List<dynamic> : [];
  },
);

class BulletinScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const BulletinScreen({super.key, required this.schoolId, required this.child});

  @override
  ConsumerState<BulletinScreen> createState() => _BulletinScreenState();
}

class _BulletinScreenState extends ConsumerState<BulletinScreen> {
  late DateTime _day;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _day = DateTime(now.year, now.month, now.day);
  }

  String get _iso =>
      '${_day.year}-${_day.month.toString().padLeft(2, '0')}-${_day.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final studentId = widget.child['id'] as String? ?? '';
    final name = (widget.child['fullName'] as String? ?? '').toUpperCase();
    final reports = ref.watch(childReportsProvider((schoolId: widget.schoolId, studentId: studentId)));

    return Scaffold(
      backgroundColor: const Color(0xFFE7F4F8),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  Image.asset('assets/images/school_logo.png', height: 42, errorBuilder: (_, __, ___) {
                    return const Text('ονειροχώρα', style: TextStyle(color: Color(0xFFE95926), fontWeight: FontWeight.w800));
                  }),
                  const Spacer(),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('Ενημέρωση Γονέων', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF3F3F46))),
                      Text('Ημερολόγιο   Επικοινωνία', style: TextStyle(fontSize: 12, color: Color(0xFF52525B))),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              width: double.infinity,
              color: const Color(0xFF77328D),
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.account_circle, color: Colors.white, size: 22),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      name,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: 0.4),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => _day = _day.subtract(const Duration(days: 1))),
                    icon: const Icon(Icons.chevron_left, color: Color(0xFF77328D)),
                  ),
                  Text(
                    '${_day.day.toString().padLeft(2, '0')}/${_day.month.toString().padLeft(2, '0')}/${_day.year}',
                    style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w800, fontSize: 20),
                  ),
                  IconButton(
                    onPressed: () => setState(() => _day = _day.add(const Duration(days: 1))),
                    icon: const Icon(Icons.chevron_right, color: Color(0xFF77328D)),
                  ),
                  const Spacer(),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF77328D),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('ΕΠΙΣΤΡΟΦΗ'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: reports.when(
                loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
                error: (e, _) => Center(child: Text('Δεν φορτώθηκε το δελτίο.\n$e', textAlign: TextAlign.center)),
                data: (list) {
                  Map<String, dynamic>? report;
                  for (final item in list) {
                    final date = item['reportDate'] as String? ?? '';
                    if (date.startsWith(_iso)) {
                      report = Map<String, dynamic>.from(item as Map);
                      break;
                    }
                  }
                  return RefreshIndicator(
                    onRefresh: () => ref.refresh(childReportsProvider((schoolId: widget.schoolId, studentId: studentId)).future),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                      children: [
                        DailyBulletinCard(report: report),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class DailyBulletinCard extends StatelessWidget {
  final Map<String, dynamic>? report;
  const DailyBulletinCard({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    final breakfast = bulletinMealLabel(report?['mealBreakfast'] as String?);
    final lunch = bulletinMealLabel(report?['mealLunch'] as String?);
    final kaka = (report?['bathroomCount'] as num?)?.toInt() ?? 0;
    final tsisa = (report?['diaperChanges'] as num?)?.toInt() ?? 0;
    final nap1 = bulletinNapLabel((report?['napDurationMinutes'] as num?)?.toInt());
    final nap2 = bulletinNapLabel((report?['nap2DurationMinutes'] as num?)?.toInt());
    final raw = report?['activities'];
    final selected = raw is List ? raw.map((e) => e.toString()).toList() : <String>[];
    final notes = (report?['notes'] as String?)?.trim() ?? '';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _Band('Διατροφή'),
          _Pair('Πρωινό:', breakfast),
          const Divider(height: 1),
          _Pair('Μεσημεριανό:', lunch),
          const _Band('Υγιεινή: Τουαλέτα'),
          _Mark('Κακά', kaka > 0),
          _Mark('Τσισα', tsisa > 0),
          const _Band('Κοίμηση'),
          _Pair('1η φορά:', nap1),
          const Divider(height: 1),
          _Pair('2η φορά:', nap2),
          const _Band('Δραστηριότητες'),
          ...bulletinSubjects.map((s) => _Mark(s, bulletinSubjectChecked(selected, s))),
          const _Band('Σημείωση'),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Text(
              notes.isEmpty ? 'Η δασκάλα μου είπε να σας πω...' : 'Η δασκάλα μου είπε να σας πω...',
              style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
            child: Text(
              notes.isEmpty ? 'Δεν υπάρχει σημείωση για αυτή την ημέρα.' : '"$notes"',
              style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 15, color: Color(0xFF111827)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Band extends StatelessWidget {
  final String title;
  const _Band(this.title);
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 10, 10, 6),
      padding: const EdgeInsets.symmetric(vertical: 8),
      color: const Color(0xFFC4B08A),
      child: Text(title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
    );
  }
}

class _Pair extends StatelessWidget {
  final String label;
  final String value;
  const _Pair(this.label, this.value);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF4B5563))),
          const SizedBox(width: 16),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _Mark extends StatelessWidget {
  final String label;
  final bool done;
  const _Mark(this.label, this.done);
  @override
  Widget build(BuildContext context) {
    final color = done ? const Color(0xFF16A34A) : const Color(0xFF111827);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(done ? Icons.check : Icons.close, size: 16, color: color),
          const SizedBox(width: 6),
          Flexible(
            child: Text(label, style: TextStyle(color: color, fontWeight: done ? FontWeight.w600 : FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
