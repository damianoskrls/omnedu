import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../teacher/screens/assignments_screen.dart';

class ParentAssignmentsScreen extends ConsumerWidget {
  final String schoolId;
  final String? studentId;
  final String childName;
  const ParentAssignmentsScreen({super.key, required this.schoolId, this.studentId, this.childName = ''});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (schoolId: schoolId, classId: null, studentId: studentId);
    final work = ref.watch(classAssignmentsProvider(key));
    final title = childName.isEmpty ? 'Εργασίες' : 'Εργασίες · $childName';
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(onPressed: () => ref.invalidate(classAssignmentsProvider(key)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: work.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Οι εργασίες δεν φορτώθηκαν.')),
        data: (rows) {
          if (rows.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Όταν ο εκπαιδευτικός ανεβάσει εργασία για την τάξη, θα φαίνεται εδώ μαζί με τις οδηγίες και το αρχείο για εκτύπωση.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
                ),
              ),
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(classAssignmentsProvider(key).future),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, index) {
                final row = rows[index] is Map ? Map<String, dynamic>.from(rows[index] as Map) : <String, dynamic>{};
                return AssignmentCard(assignment: row);
              },
            ),
          );
        },
      ),
    );
  }
}
