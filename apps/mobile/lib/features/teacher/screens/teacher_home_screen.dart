import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/providers/auth_provider.dart';
import 'teacher_student_screen.dart';
import 'teacher_thematic_screen.dart';
import 'teacher_meetings_screen.dart';
import 'teacher_notify_screen.dart';
import '../../medications/medications_screen.dart';
import 'teacher_leaves_screen.dart';
import 'class_moment_screen.dart';
import 'found_item_screen.dart';
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
                  margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
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
                            Text(
                              user.isOwner ? 'Εποπτεία όλου του σχολείου' : 'Καλή δύναμη για σήμερα',
                              style: const TextStyle(fontSize: 13, color: Colors.white70),
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                if (!user.isOwner)
                                  OutlinedButton.icon(
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      side: const BorderSide(color: Colors.white70),
                                    ),
                                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                                      builder: (_) => TeacherLeavesScreen(schoolId: widget.schoolId),
                                    )),
                                    icon: const Icon(Icons.beach_access_rounded, size: 18),
                                    label: const Text('Άδειες'),
                                  ),
                                OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.white,
                                    side: const BorderSide(color: Colors.white70),
                                  ),
                                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                                    builder: (_) => MedicationsScreen(schoolId: widget.schoolId, forParent: false),
                                  )),
                                  icon: const Icon(Icons.medication_rounded, size: 18),
                                  label: const Text('Φάρμακα'),
                                ),
                                OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.white,
                                    side: const BorderSide(color: Colors.white70),
                                  ),
                                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                                    builder: (_) => FoundItemsScreen(schoolId: widget.schoolId),
                                  )),
                                  icon: const Icon(Icons.checkroom_rounded, size: 18),
                                  label: const Text('Ευρήματα'),
                                ),
                              ],
                            ),
                          ],
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
                              cls['covering'] is Map ? '${cls['name']} · αντικ.' : cls['name'] as String,
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

              if (_selectedClassId != null && _coveringOf(classes, _selectedClassId) != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF6EE),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFF3D2C2)),
                      ),
                      child: Text(
                        _coverText(_coveringOf(classes, _selectedClassId)!),
                        style: const TextStyle(color: Color(0xFF7A3412), height: 1.35, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
              if (_selectedClassId != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                    child: Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D)),
                            onPressed: () {
                              final cls = classes.cast<Map>().firstWhere((c) => c['id'] == _selectedClassId);
                              Navigator.of(context).push(MaterialPageRoute(
                                builder: (_) => TeacherThematicScreen(
                                  schoolId: widget.schoolId,
                                  classId: _selectedClassId!,
                                  className: cls['name'] as String? ?? '',
                                ),
                              ));
                            },
                            icon: const Icon(Icons.auto_stories_rounded),
                            label: const Text('Διαθεματικό'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE95926)),
                            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => TeacherNotifyScreen(
                                schoolId: widget.schoolId,
                                classId: _selectedClassId!,
                                teacherId: user.id,
                              ),
                            )),
                            icon: const Icon(Icons.campaign_rounded),
                            label: const Text('Ενημέρωση'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_selectedClassId != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                    child: Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFBE185D)),
                            onPressed: () => _openMoment(classes, forClass: false),
                            icon: const Icon(Icons.cake_rounded),
                            label: const Text('Γενέθλια'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0F766E)),
                            onPressed: () => _openMoment(classes, forClass: true),
                            icon: const Icon(Icons.photo_library_rounded),
                            label: const Text('Σήμερα'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_selectedClassId != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF642678)),
                      onPressed: () {
                        final cls = classes.cast<Map>().firstWhere((c) => c['id'] == _selectedClassId);
                        Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => TeacherMeetingsScreen(
                            schoolId: widget.schoolId,
                            classId: _selectedClassId!,
                            className: cls['name'] as String? ?? '',
                          ),
                        ));
                      },
                      icon: const Icon(Icons.event_available_rounded),
                      label: const Text('Συναντήσεις γονέων'),
                    ),
                  ),
                ),

              // Students label
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: Text(
                    _coveringOf(classes, _selectedClassId) == null ? 'Μαθητές' : 'Μαθητές προς αντικατάσταση σήμερα',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
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

  void _openMoment(List<dynamic> classes, {required bool forClass}) {
    final classId = _selectedClassId;
    if (classId == null) return;
    Map? klass;
    for (final raw in classes) {
      if (raw is Map && raw['id'] == classId) klass = raw;
    }
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ClassMomentScreen(
        schoolId: widget.schoolId,
        classId: classId,
        className: klass?['name']?.toString() ?? '',
        forClass: forClass,
      ),
    ));
  }

}

Map<String, dynamic>? _coveringOf(List<dynamic> classes, String? classId) {
  if (classId == null) return null;
  for (final raw in classes) {
    if (raw is! Map || raw['id'] != classId) continue;
    final covering = raw['covering'];
    if (covering is Map) return Map<String, dynamic>.from(covering);
  }
  return null;
}

String _coverText(Map<String, dynamic> covering) {
  final name = covering['teacherName']?.toString() ?? 'εκπαιδευτικό';
  final reason = covering['reason']?.toString() ?? '';
  final because = reason.isEmpty ? '' : ' λόγω $reason';
  return 'Σήμερα αντικαθιστάς τον/την $name$because. Η ημερήσια ενημέρωση αυτών των παιδιών περνάει μόνο για αυτή την ημέρα.';
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

class _StudentPhoto extends StatelessWidget {
  final Map<String, dynamic> student;
  final String name;
  final List<Color> colors;
  const _StudentPhoto({required this.student, required this.name, required this.colors});

  @override
  Widget build(BuildContext context) {
    final avatarUrl = student['avatarUrl'] as String?;
    final letter = Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
        ),
      ),
    );
    if (avatarUrl == null || avatarUrl.isEmpty) return letter;
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: AppImage(
        avatarUrl,
        width: 50,
        height: 50,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => letter,
      ),
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
            _StudentPhoto(student: student, name: name, colors: colors),
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
