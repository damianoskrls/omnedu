import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import 'teacher_student_screen.dart';

final _myClassesProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/classes/my-classes');
    return resp.data is List ? resp.data as List<dynamic> : [];
  },
);

final _classStudentsProvider =
    FutureProvider.family<List<dynamic>, ({String schoolId, String classId})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/students',
      queryParameters: {'classId': key.classId},
    );
    return resp.data is List ? resp.data as List<dynamic> : [];
  },
);

class TeacherHomeScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const TeacherHomeScreen({super.key, required this.schoolId});

  @override
  ConsumerState<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends ConsumerState<TeacherHomeScreen> {
  String? _selectedClassId;

  static const _gradients = [
    [Color(0xFF4F46E5), Color(0xFF7C3AED)],
    [Color(0xFF0EA5E9), Color(0xFF6366F1)],
    [Color(0xFFEC4899), Color(0xFFF43F5E)],
    [Color(0xFF10B981), Color(0xFF059669)],
  ];

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user!;
    final firstName = user.fullName.split(' ').first;
    final classesAsync = ref.watch(_myClassesProvider(widget.schoolId));

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Σφάλμα: $e')),
        data: (classes) {
          // Auto-select first class
          if (_selectedClassId == null && classes.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _selectedClassId = classes[0]['id'] as String);
            });
          }

          return CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(16, 56, 16, 0),
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF4F46E5).withOpacity(0.4),
                        blurRadius: 28,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Καλημέρα, $firstName! 👋',
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Καλή δύναμη για σήμερα',
                              style: TextStyle(fontSize: 13, color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _showLogout(context),
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Center(
                            child: Text(
                              firstName.isNotEmpty ? firstName[0].toUpperCase() : '?',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 20,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Class selector
              if (classes.isNotEmpty) ...[
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(20, 28, 20, 12),
                    child: Text(
                      'Τμήμα',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 44,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemCount: classes.length,
                      itemBuilder: (_, i) {
                        final cls = classes[i];
                        final id = cls['id'] as String;
                        final isSelected = id == _selectedClassId;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedClassId = id),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                            decoration: BoxDecoration(
                              gradient: isSelected
                                  ? const LinearGradient(
                                      colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                                    )
                                  : null,
                              color: isSelected ? null : Colors.white,
                              borderRadius: BorderRadius.circular(22),
                              boxShadow: [
                                if (isSelected)
                                  BoxShadow(
                                    color: const Color(0xFF4F46E5).withOpacity(0.3),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                              ],
                            ),
                            child: Text(
                              cls['name'] as String,
                              style: TextStyle(
                                color: isSelected ? Colors.white : const Color(0xFF6B7280),
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ],

              // Students label
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: Text(
                    'Μαθητές',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
                  ),
                ),
              ),

              // Students list
              if (_selectedClassId == null)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('Επιλέξτε τμήμα', style: TextStyle(color: Color(0xFF9CA3AF))),
                  ),
                )
              else
                _StudentsSliver(
                  schoolId: widget.schoolId,
                  classId: _selectedClassId!,
                  gradients: _gradients,
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 110)),
            ],
          );
        },
      ),
    );
  }

  void _showLogout(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 20),
              ListTile(
                leading: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
                title: const Text('Αποσύνδεση', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(context);
                  ref.read(authProvider.notifier).logout();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StudentsSliver extends ConsumerWidget {
  final String schoolId;
  final String classId;
  final List<List<Color>> gradients;

  const _StudentsSliver({
    required this.schoolId,
    required this.classId,
    required this.gradients,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentsAsync = ref.watch(_classStudentsProvider((schoolId: schoolId, classId: classId)));

    return studentsAsync.when(
      loading: () => const SliverToBoxAdapter(
        child: SizedBox(height: 100, child: Center(child: CircularProgressIndicator())),
      ),
      error: (e, _) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text('Σφάλμα: $e', style: const TextStyle(color: Colors.red)),
        ),
      ),
      data: (students) {
        if (students.isEmpty) {
          return const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Text('Δεν υπάρχουν μαθητές σε αυτό το τμήμα', style: TextStyle(color: Color(0xFF9CA3AF))),
            ),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) {
                final student = students[i];
                final name = student['fullName'] as String? ?? '';
                final colorIndex = name.isNotEmpty ? name.codeUnitAt(0) % gradients.length : 0;
                final colors = gradients[colorIndex];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _StudentCard(
                    student: student,
                    colors: colors,
                    schoolId: schoolId,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => TeacherStudentScreen(
                          student: student,
                          schoolId: schoolId,
                        ),
                      ),
                    ),
                  ),
                );
              },
              childCount: students.length,
            ),
          ),
        );
      },
    );
  }
}

class _StudentCard extends StatelessWidget {
  final Map<String, dynamic> student;
  final List<Color> colors;
  final String schoolId;
  final VoidCallback onTap;

  const _StudentCard({
    required this.student,
    required this.colors,
    required this.schoolId,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = student['fullName'] as String? ?? '';
    final enrollments = student['enrollments'] as List<dynamic>? ?? [];
    final className = enrollments.isNotEmpty
        ? (enrollments.first['class']?['name'] as String? ?? '')
        : '';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: colors[0].withOpacity(0.10),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: colors,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
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
                  if (className.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      className,
                      style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              Icons.edit_note_rounded,
              color: colors[0],
              size: 24,
            ),
          ],
        ),
      ),
    );
  }
}
