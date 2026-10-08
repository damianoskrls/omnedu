import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/person_face.dart';

final teacherAbsencesProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  try {
    final resp = await dio.get('/schools/$schoolId/teacher-absences');
    return resp.data is List ? resp.data as List<dynamic> : [];
  } catch (_) {
    return [];
  }
});

class TeacherAbsencesScreen extends ConsumerWidget {
  final String schoolId;
  const TeacherAbsencesScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final absences = ref.watch(teacherAbsencesProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: const Text('Απουσίες εκπαιδευτικών')),
      body: absences.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Οι απουσίες δεν φορτώθηκαν.')),
        data: (rows) {
          final upcoming = rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).where(_isUpcoming).toList();
          if (upcoming.isEmpty) {
            return const Center(child: Text('Δεν υπάρχει προγραμματισμένη απουσία.'));
          }
          return ListView.separated(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
            itemCount: upcoming.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, index) => _AbsenceCard(absence: upcoming[index]),
          );
        },
      ),
    );
  }
}

class AbsenceHomeNotice extends StatelessWidget {
  final List<dynamic> absences;
  final List<Map<String, dynamic>> children;
  const AbsenceHomeNotice({super.key, required this.absences, this.children = const []});

  @override
  Widget build(BuildContext context) {
    final upcoming = absences.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).where(_isUpcoming).toList();
    if (upcoming.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        children: [
          for (final absence in upcoming) ...[
            _AbsenceCard(absence: absence, children: _childrenForTeacher(children, _teacherId(absence))),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _AbsenceCard extends StatelessWidget {
  final Map<String, dynamic> absence;
  final List<Map<String, dynamic>> children;
  const _AbsenceCard({required this.absence, this.children = const []});

  @override
  Widget build(BuildContext context) {
    final teacher = absence['teacher'];
    final name = teacher is Map ? teacher['fullName']?.toString() ?? 'Εκπαιδευτικός' : 'Εκπαιδευτικός';
    final note = absence['note']?.toString() ?? '';
    final mentions = children.map(ChildMention.fromMap).whereType<ChildMention>().toList();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0E6F4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (mentions.isNotEmpty) ...[
            ChildMentions(people: mentions),
            const SizedBox(height: 8),
          ],
          const Text('Απουσία εκπαιδευτικού', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
          const SizedBox(height: 4),
          Text('$name · ${_formatDay(absence['date']?.toString())}', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF2C2422))),
          if (note.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(note, style: const TextStyle(fontSize: 13, height: 1.35, color: Color(0xFF4B5563))),
          ],
        ],
      ),
    );
  }
}

String _teacherId(Map<String, dynamic> absence) {
  final teacher = absence['teacher'];
  if (teacher is Map && teacher['id'] != null) return teacher['id'].toString();
  return absence['teacherUserId']?.toString() ?? '';
}

List<Map<String, dynamic>> _childrenForTeacher(List<Map<String, dynamic>> children, String teacherId) {
  if (teacherId.isEmpty || children.isEmpty) return children;
  final matched = children.where((child) {
    final enrollments = child['enrollments'] as List? ?? [];
    if (enrollments.isEmpty || enrollments.first is! Map) return false;
    final klass = enrollments.first['class'];
    final teachers = klass is Map ? klass['teachers'] as List? ?? [] : [];
    for (final teacher in teachers) {
      if (teacher is! Map) continue;
      final user = teacher['user'];
      final id = user is Map ? user['id']?.toString() : teacher['userId']?.toString();
      if (id == teacherId) return true;
    }
    return false;
  }).toList();
  return matched.isEmpty ? children : matched;
}

bool _isUpcoming(Map<String, dynamic> absence) {
  final raw = absence['date']?.toString() ?? '';
  final date = DateTime.tryParse(raw);
  if (date == null) return true;
  final today = DateTime.now();
  final start = DateTime(today.year, today.month, today.day);
  final day = DateTime(date.toLocal().year, date.toLocal().month, date.toLocal().day);
  return !day.isBefore(start);
}

String _formatDay(String? iso) {
  final date = DateTime.tryParse(iso ?? '');
  if (date == null) return '';
  final local = date.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
}
