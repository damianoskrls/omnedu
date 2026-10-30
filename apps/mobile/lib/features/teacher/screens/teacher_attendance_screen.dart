// Called by: teacher_home_screen.dart «Παρουσιολόγιο» FilledButton (class actions).
// No prior file: grep attendance in mobile = 0 matches before this.
// Schema R/W via API: GET/PUT /schools/:id/attendance {classId,date,records[{studentId,status}]}.
// User: «θελω ο εκπαιδευτικός οταν μπαινει στην εφαρμογη του να εχει και παρουσιολογιο περα απο ημερησια ενημερωση. οποτε να εχει ενα κουμπι παρουσιολογιο για σημερα με την ημερα και ημερομηνια και οταν τσεκαρει τους μαθητες που ηταν σημερα να μπορει μετα σε εναν εναν που ηταν παρον να περναει ημερησια ενημερωση.»
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';
import 'teacher_student_screen.dart';

String _isoDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

const _weekdayEl = [
  'Δευτέρα',
  'Τρίτη',
  'Τετάρτη',
  'Πέμπτη',
  'Παρασκευή',
  'Σάββατο',
  'Κυριακή',
];
const _monthEl = [
  'Ιανουαρίου',
  'Φεβρουαρίου',
  'Μαρτίου',
  'Απριλίου',
  'Μαΐου',
  'Ιουνίου',
  'Ιουλίου',
  'Αυγούστου',
  'Σεπτεμβρίου',
  'Οκτωβρίου',
  'Νοεμβρίου',
  'Δεκεμβρίου',
];

String _greekTodayLabel(DateTime d) {
  final wd = _weekdayEl[d.weekday - 1];
  return '$wd ${d.day} ${_monthEl[d.month - 1]} ${d.year}';
}

final _attendanceProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({String schoolId, String classId, String date})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/attendance',
      queryParameters: {'classId': key.classId, 'date': key.date},
    );
    return Map<String, dynamic>.from(resp.data as Map);
  },
);

class TeacherAttendanceScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;

  const TeacherAttendanceScreen({
    super.key,
    required this.schoolId,
    required this.classId,
    required this.className,
  });

  @override
  ConsumerState<TeacherAttendanceScreen> createState() =>
      _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState
    extends ConsumerState<TeacherAttendanceScreen> {
  late final String _date;
  late final DateTime _now;
  final Map<String, String?> _local = {};
  bool _hydrated = false;
  bool _saving = false;
  bool _reporting = false;

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    _date = _isoDate(_now);
  }

  void _hydrate(List students) {
    if (_hydrated) return;
    for (final raw in students) {
      if (raw is! Map) continue;
      final id = raw['id'] as String?;
      if (id == null) continue;
      _local[id] = raw['status'] as String?;
    }
    _hydrated = true;
  }

  int get _presentCount =>
      _local.values.where((s) => s == 'present').length;
  int get _absentCount =>
      _local.values.where((s) => s == 'absent').length;
  int get _markedCount =>
      _local.values.where((s) => s == 'present' || s == 'absent').length;

  void _setStatus(String studentId, String status) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_local[studentId] == status) {
        _local[studentId] = null;
      } else {
        _local[studentId] = status;
      }
    });
  }

  void _markAllPresent(List students) {
    HapticFeedback.mediumImpact();
    setState(() {
      for (final raw in students) {
        if (raw is! Map) continue;
        final id = raw['id'] as String?;
        if (id != null) _local[id] = 'present';
      }
    });
  }

  Future<bool> _save() async {
    final records = <Map<String, String>>[];
    _local.forEach((id, status) {
      if (status == 'present' || status == 'absent') {
        records.add({'studentId': id, 'status': status!});
      }
    });
    if (records.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Επίλεξε τουλάχιστον έναν μαθητή')),
        );
      }
      return false;
    }
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.put('/schools/${widget.schoolId}/attendance', data: {
        'classId': widget.classId,
        'date': _date,
        'records': records,
      });
      ref.invalidate(_attendanceProvider((
        schoolId: widget.schoolId,
        classId: widget.classId,
        date: _date,
      )));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Αποθηκεύτηκε · $_presentCount παρόντες · $_absentCount απόντες'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      }
      return true;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Σφάλμα: $e'), backgroundColor: Colors.red),
        );
      }
      return false;
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveAndReport(List students) async {
    final ok = await _save();
    if (!ok || !mounted) return;

    final present = students.whereType<Map>().where((s) {
      final id = s['id'] as String?;
      return id != null && _local[id] == 'present';
    }).toList();

    final needReport =
        present.where((s) => s['hasDailyReport'] != true).toList();
    if (needReport.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Όλοι οι παρόντες έχουν ήδη ημερήσια ενημέρωση'),
            backgroundColor: Color(0xFF0EA5E9),
          ),
        );
      }
      return;
    }

    setState(() => _reporting = true);
    for (var i = 0; i < needReport.length; i++) {
      if (!mounted) break;
      final student = Map<String, dynamic>.from(needReport[i]);
      final cont = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => TeacherStudentScreen(
            student: student,
            schoolId: widget.schoolId,
            queueMode: true,
            queueIndex: i + 1,
            queueTotal: needReport.length,
          ),
        ),
      );
      if (cont != true) break;
    }
    if (mounted) {
      setState(() => _reporting = false);
      _hydrated = false;
      ref.invalidate(_attendanceProvider((
        schoolId: widget.schoolId,
        classId: widget.classId,
        date: _date,
      )));
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_attendanceProvider((
      schoolId: widget.schoolId,
      classId: widget.classId,
      date: _date,
    )));

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF0F4FF),
        body: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Σφάλμα: $e', textAlign: TextAlign.center),
            ),
          ),
          data: (data) {
            final students = (data['students'] as List?) ?? [];
            _hydrate(students);
            return _buildBody(students);
          },
        ),
      ),
    );
  }

  Widget _buildBody(List students) {
    final total = students.length;
    return Column(
      children: [
        _Header(
          className: widget.className,
          dateLabel: _greekTodayLabel(_now),
          present: _presentCount,
          absent: _absentCount,
          total: total,
          onBack: () => Navigator.of(context).pop(),
          onMarkAll: () => _markAllPresent(students),
        ),
        Expanded(
          child: students.isEmpty
              ? const Center(
                  child: Text(
                    'Δεν υπάρχουν μαθητές σε αυτό το τμήμα',
                    style: TextStyle(color: Color(0xFF9CA3AF)),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: students.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final student =
                        Map<String, dynamic>.from(students[i] as Map);
                    final id = student['id'] as String? ?? '';
                    final status = _local[id];
                    final hasReport = student['hasDailyReport'] == true;
                    return _StudentAttendanceRow(
                      student: student,
                      status: status,
                      hasReport: hasReport,
                      onPresent: () => _setStatus(id, 'present'),
                      onAbsent: () => _setStatus(id, 'absent'),
                      onOpenReport: status == 'present'
                          ? () async {
                              final ok = await _save();
                              if (!ok || !mounted) return;
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => TeacherStudentScreen(
                                    student: student,
                                    schoolId: widget.schoolId,
                                  ),
                                ),
                              );
                              if (mounted) {
                                _hydrated = false;
                                ref.invalidate(_attendanceProvider((
                                  schoolId: widget.schoolId,
                                  classId: widget.classId,
                                  date: _date,
                                )));
                              }
                            }
                          : null,
                    );
                  },
                ),
        ),
        _BottomBar(
          saving: _saving || _reporting,
          marked: _markedCount,
          present: _presentCount,
          onSave: _saving || _reporting ? null : () => _save(),
          onSaveAndReport: _saving || _reporting || _presentCount == 0
              ? null
              : () => _saveAndReport(students),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  final String className;
  final String dateLabel;
  final int present;
  final int absent;
  final int total;
  final VoidCallback onBack;
  final VoidCallback onMarkAll;

  const _Header({
    required this.className,
    required this.dateLabel,
    required this.present,
    required this.absent,
    required this.total,
    required this.onBack,
    required this.onMarkAll,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF059669), Color(0xFF0D9488)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: onBack,
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white),
                  ),
                  const Expanded(
                    child: Text(
                      'Παρουσιολόγιο',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: onMarkAll,
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white,
                      backgroundColor: Colors.white.withOpacity(0.2),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                    child: const Text('Όλοι παρόντες',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 12)),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Text(
                  className,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.9),
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today_rounded,
                        size: 14, color: Colors.white.withOpacity(0.85)),
                    const SizedBox(width: 6),
                    Text(
                      dateLabel,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    _StatChip(
                        label: 'Παρόντες',
                        value: '$present',
                        color: const Color(0xFFBBF7D0)),
                    const SizedBox(width: 8),
                    _StatChip(
                        label: 'Απόντες',
                        value: '$absent',
                        color: const Color(0xFFFECACA)),
                    const SizedBox(width: 8),
                    _StatChip(
                        label: 'Σύνολο', value: '$total', color: Colors.white),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatChip(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.18),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                )),
            Text(label,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.85),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                )),
          ],
        ),
      ),
    );
  }
}

class _StudentAttendanceRow extends StatelessWidget {
  final Map<String, dynamic> student;
  final String? status;
  final bool hasReport;
  final VoidCallback onPresent;
  final VoidCallback onAbsent;
  final VoidCallback? onOpenReport;

  const _StudentAttendanceRow({
    required this.student,
    required this.status,
    required this.hasReport,
    required this.onPresent,
    required this.onAbsent,
    this.onOpenReport,
  });

  @override
  Widget build(BuildContext context) {
    final name = student['fullName'] as String? ?? '';
    final isPresent = status == 'present';
    final isAbsent = status == 'absent';
    final borderColor = isPresent
        ? const Color(0xFF10B981)
        : isAbsent
            ? const Color(0xFFEF4444)
            : const Color(0xFFE5E7EB);
    final bg = isPresent
        ? const Color(0xFFECFDF5)
        : isAbsent
            ? const Color(0xFFFEF2F2)
            : Colors.white;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(18),
        border:
            Border.all(color: borderColor, width: isPresent || isAbsent ? 1.5 : 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          _Avatar(student: student, name: name),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Color(0xFF1E1B4B),
                  ),
                ),
                if (hasReport) ...[
                  const SizedBox(height: 2),
                  const Text(
                    'Ενημέρωση ✓',
                    style: TextStyle(
                      color: Color(0xFF059669),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ] else if (isPresent && onOpenReport != null) ...[
                  const SizedBox(height: 2),
                  GestureDetector(
                    onTap: onOpenReport,
                    child: const Text(
                      'Πέρασε ενημέρωση →',
                      style: TextStyle(
                        color: Color(0xFF4F46E5),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          _StatusBtn(
            selected: isPresent,
            color: const Color(0xFF10B981),
            icon: Icons.check_rounded,
            label: 'Παρόν',
            onTap: onPresent,
          ),
          const SizedBox(width: 6),
          _StatusBtn(
            selected: isAbsent,
            color: const Color(0xFFEF4444),
            icon: Icons.close_rounded,
            label: 'Απών',
            onTap: onAbsent,
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final Map<String, dynamic> student;
  final String name;
  const _Avatar({required this.student, required this.name});

  @override
  Widget build(BuildContext context) {
    final url = student['avatarUrl'] as String?;
    final letter = Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF059669), Color(0xFF0D9488)],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
    );
    if (url == null || url.isEmpty) return letter;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: AppImage(
        url,
        width: 48,
        height: 48,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => letter,
      ),
    );
  }
}

class _StatusBtn extends StatelessWidget {
  final bool selected;
  final Color color;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _StatusBtn({
    required this.selected,
    required this.color,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color : color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: selected ? Colors.white : color),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : color,
                fontWeight: FontWeight.w700,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  final bool saving;
  final int marked;
  final int present;
  final VoidCallback? onSave;
  final VoidCallback? onSaveAndReport;

  const _BottomBar({
    required this.saving,
    required this.marked,
    required this.present,
    required this.onSave,
    required this.onSaveAndReport,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              onPressed: onSaveAndReport,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.edit_note_rounded),
              label: Text(
                present > 0
                    ? 'Αποθήκευση & ενημερώσεις ($present)'
                    : 'Αποθήκευση & ενημερώσεις',
                style:
                    const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton(
              onPressed: onSave,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF059669),
                side: const BorderSide(color: Color(0xFF059669)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(
                marked > 0 ? 'Μόνο αποθήκευση ($marked)' : 'Μόνο αποθήκευση',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
