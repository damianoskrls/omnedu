import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../bulletin_subjects.dart';

final dayReportProvider = FutureProvider.family<Map<String, dynamic>?, ({String schoolId, String studentId, String date})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/daily-reports/student/${key.studentId}',
      queryParameters: {'date': key.date, 'limit': 40},
    );
    final list = resp.data is List ? resp.data as List<dynamic> : <dynamic>[];
    for (final item in list) {
      if (item is! Map) continue;
      final raw = (item['reportDate'] as String? ?? '').split('T').first;
      if (raw == key.date) return Map<String, dynamic>.from(item);
    }
    return null;
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

  DateTime get _today {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  @override
  void initState() {
    super.initState();
    _day = _today;
  }

  String get _dateKey =>
      '${_day.year}-${_day.month.toString().padLeft(2, '0')}-${_day.day.toString().padLeft(2, '0')}';

  String get _label {
    final today = _today;
    if (_day == today) return 'Σήμερα';
    if (_day == today.subtract(const Duration(days: 1))) return 'Χθες';
    const days = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
    return days[_day.weekday - 1];
  }

  String get _pretty =>
      '${_day.day.toString().padLeft(2, '0')}/${_day.month.toString().padLeft(2, '0')}/${_day.year}';

  void _shift(int days) {
    final next = _day.add(Duration(days: days));
    if (next.isAfter(_today)) return;
    setState(() => _day = next);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime(_today.year - 2, 9, 1),
      lastDate: _today,
      helpText: 'Ημερολόγιο',
      cancelText: 'Άκυρο',
      confirmText: 'Επιλογή',
    );
    if (picked == null) return;
    setState(() => _day = DateTime(picked.year, picked.month, picked.day));
  }

  @override
  Widget build(BuildContext context) {
    final studentId = widget.child['id'] as String? ?? '';
    final name = widget.child['fullName'] as String? ?? '';
    final key = (schoolId: widget.schoolId, studentId: studentId, date: _dateKey);
    final report = ref.watch(dayReportProvider(key));
    final isToday = _day == _today;

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 12, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF77328D)),
                  ),
                  Image.asset(
                    'assets/images/school_logo.png',
                    height: 36,
                    errorBuilder: (_, __, ___) => const Text(
                      'ονειροχώρα',
                      style: TextStyle(color: Color(0xFFE95926), fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Ημερήσιο δελτίο', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF2C2422))),
                        Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => _shift(-1),
                        icon: const Icon(Icons.chevron_left_rounded, color: Color(0xFF77328D)),
                      ),
                      Expanded(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: _pickDate,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.calendar_month_rounded, size: 18, color: Color(0xFFE95926)),
                                    const SizedBox(width: 6),
                                    Text(_label, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(_pretty, style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                              ],
                            ),
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: isToday ? null : () => _shift(1),
                        icon: Icon(Icons.chevron_right_rounded, color: isToday ? const Color(0xFFD1D5DB) : const Color(0xFF77328D)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Expanded(
              child: report.when(
                loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
                error: (e, _) => _EmptyBulletin(
                  title: 'Δεν φορτώθηκε το δελτίο',
                  message: 'Δοκίμασε ξανά σε λίγο.\n$e',
                  icon: Icons.cloud_off_rounded,
                ),
                data: (item) {
                  return RefreshIndicator(
                    color: const Color(0xFF77328D),
                    onRefresh: () => ref.refresh(dayReportProvider(key).future),
                    child: item == null
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              const SizedBox(height: 48),
                              _EmptyBulletin(
                                icon: Icons.edit_note_rounded,
                                title: isToday ? 'Το σημερινό δελτίο δεν είναι έτοιμο' : 'Δεν υπάρχει δελτίο',
                                message: isToday
                                    ? 'Ο εκπαιδευτικός δεν έχει συμπληρώσει ακόμα το ημερήσιο δελτίο για σήμερα. Θα εμφανιστεί εδώ μόλις το καταχωρήσει.'
                                    : 'Για την $_pretty δεν υπάρχει συμπληρωμένο δελτίο από τον εκπαιδευτικό.',
                              ),
                            ],
                          )
                        : ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                            children: [
                              DailyBulletinCard(report: item),
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

class _EmptyBulletin extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  const _EmptyBulletin({required this.icon, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [Color(0xFF77328D), Color(0xFFE95926)]),
            ),
            child: Icon(icon, color: Colors.white, size: 42),
          ),
          const SizedBox(height: 18),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(height: 1.4, color: Color(0xFF6B7280))),
        ],
      ),
    );
  }
}

class DailyBulletinCard extends StatelessWidget {
  final Map<String, dynamic> report;
  const DailyBulletinCard({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    final breakfast = bulletinMealLabel(report['mealBreakfast'] as String?);
    final lunch = bulletinMealLabel(report['mealLunch'] as String?);
    final snack = bulletinMealLabel(report['mealSnack'] as String?);
    final kaka = (report['bathroomCount'] as num?)?.toInt() ?? 0;
    final tsisa = (report['diaperChanges'] as num?)?.toInt() ?? 0;
    final nap1 = bulletinNapLabel((report['napDurationMinutes'] as num?)?.toInt());
    final nap2 = bulletinNapLabel((report['nap2DurationMinutes'] as num?)?.toInt());
    final raw = report['activities'];
    final selected = raw is List ? raw.map((e) => e.toString()).toList() : <String>[];
    final done = bulletinSubjects.where((s) => bulletinSubjectChecked(selected, s)).toList();
    final notes = (report['notes'] as String?)?.trim() ?? '';
    final teacher = (report['teacher'] as Map?)?['fullName'] as String?;

    return Column(
      children: [
        if (teacher != null && teacher.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                const Icon(Icons.person_rounded, size: 16, color: Color(0xFF77328D)),
                const SizedBox(width: 6),
                Text('Συμπλήρωσε: $teacher', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
              ],
            ),
          ),
        _Section(
          icon: Icons.restaurant_rounded,
          title: 'Διατροφή',
          child: Column(
            children: [
              _Line('Πρωινό', breakfast),
              _Line('Μεσημεριανό', lunch),
              _Line('Σνακ', snack),
            ],
          ),
        ),
        _Section(
          icon: Icons.child_care_rounded,
          title: 'Υγιεινή',
          child: Column(
            children: [
              _Line('Κακά', kaka > 0 ? '$kaka' : '—'),
              _Line('Τσισα', tsisa > 0 ? '$tsisa' : '—'),
            ],
          ),
        ),
        _Section(
          icon: Icons.bedtime_rounded,
          title: 'Κοίμηση',
          child: Column(
            children: [
              _Line('1η φορά', nap1),
              _Line('2η φορά', nap2),
            ],
          ),
        ),
        _Section(
          icon: Icons.palette_rounded,
          title: 'Δραστηριότητες',
          child: done.isEmpty
              ? const Text('Δεν σημειώθηκαν δραστηριότητες.', style: TextStyle(color: Color(0xFF9CA3AF)))
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: done
                      .map((s) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF6F3FA),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(s, style: const TextStyle(fontSize: 13, color: Color(0xFF77328D), fontWeight: FontWeight.w600)),
                          ))
                      .toList(),
                ),
        ),
        if (notes.isNotEmpty)
          _Section(
            icon: Icons.chat_bubble_rounded,
            title: 'Σημείωση',
            child: Text(notes, style: const TextStyle(height: 1.4, color: Color(0xFF2C2422))),
          ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;
  const _Section({required this.icon, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: const Color(0xFFE95926)),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  final String label;
  final String value;
  const _Line(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF6B7280)))),
          Text(value.isEmpty ? '—' : value, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF2C2422))),
        ],
      ),
    );
  }
}
