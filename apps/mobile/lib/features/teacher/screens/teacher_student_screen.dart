import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';

String _isoDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

final _studentReportsProvider =
    FutureProvider.family<List<dynamic>, ({String schoolId, String studentId})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/daily-reports/student/${key.studentId}',
      queryParameters: {'limit': 10},
    );
    return resp.data is List ? resp.data as List<dynamic> : [];
  },
);

class TeacherStudentScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> student;
  final String schoolId;

  const TeacherStudentScreen({
    super.key,
    required this.student,
    required this.schoolId,
  });

  @override
  ConsumerState<TeacherStudentScreen> createState() => _TeacherStudentScreenState();
}

class _TeacherStudentScreenState extends ConsumerState<TeacherStudentScreen> {
  static const _gradients = [
    [Color(0xFF4F46E5), Color(0xFF7C3AED)],
    [Color(0xFF0EA5E9), Color(0xFF6366F1)],
    [Color(0xFFEC4899), Color(0xFFF43F5E)],
    [Color(0xFF10B981), Color(0xFF059669)],
  ];

  static const _moods = [
    ('χαρούμενος', '😊', 'Χαρούμενος'),
    ('ήρεμος', '😌', 'Ήρεμος'),
    ('κουρασμένος', '😴', 'Κουρασμένος'),
    ('λυπημένος', '😢', 'Λυπημένος'),
    ('αγχωμένος', '😰', 'Αγχωμένος'),
    ('ενθουσιασμένος', '🤩', 'Ενθουσιασμένος'),
  ];

  static const _mealOptions = [
    ('all', 'Όλο'),
    ('most', 'Τα πιο πολλά'),
    ('half', 'Τα μισά'),
    ('little', 'Λίγο'),
    ('none', 'Καθόλου'),
  ];

  static const _napOptions = [
    (0, 'Καθόλου'),
    (30, '30\''),
    (60, '1 ώρα'),
    (90, '1½ ώρα'),
    (120, '2 ώρες'),
  ];

  static const _activityList = [
    'Γλώσσα',
    'Αγγλικά',
    'Μαθηματικά',
    'Φυσικές Επιστήμες',
    'Τ.Π.Ε.',
    'Θεατρικό Παιχνίδι',
    'Εικαστικά',
    'Μουσική',
    'Περιβάλλον & Αειφόρος Ανάπτυξη',
    'Προσ. & Κοιν. Ανάπτυξη',
    'Φυσική Αγωγή',
  ];

  String? _selectedMood;
  String? _mealBreakfast;
  String? _mealLunch;
  int _nap1 = 0;
  int _nap2 = 0;
  bool _poop = false;
  bool _pee = false;
  final Set<String> _selectedActivities = {};
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  bool _todayDone = false;

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/schools/${widget.schoolId}/daily-reports', data: {
        'studentId': widget.student['id'],
        'reportDate': _isoDate(DateTime.now()),
        if (_selectedMood != null) 'mood': _selectedMood,
        if (_mealBreakfast != null) 'mealBreakfast': _mealBreakfast,
        if (_mealLunch != null) 'mealLunch': _mealLunch,
        'napDurationMinutes': _nap1,
        'nap2DurationMinutes': _nap2,
        'bathroomCount': _poop ? 1 : 0,
        'diaperChanges': _pee ? 1 : 0,
        'activities': _selectedActivities.toList(),
        if (_notesCtrl.text.trim().isNotEmpty) 'notes': _notesCtrl.text.trim(),
      });
      setState(() {
        _submitting = false;
        _todayDone = true;
      });
      ref.invalidate(_studentReportsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Η ενημέρωση αποθηκεύτηκε! ✓'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Σφάλμα: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.student['fullName'] as String? ?? '';
    final firstName = name.split(' ').first;
    final enrollments = widget.student['enrollments'] as List<dynamic>? ?? [];
    final className = enrollments.isNotEmpty
        ? (enrollments.first['class']?['name'] as String? ?? '')
        : '';
    final colorIndex = name.isNotEmpty ? name.codeUnitAt(0) % _gradients.length : 0;
    final colors = _gradients[colorIndex];
    final studentId = widget.student['id'] as String? ?? '';

    final reportsAsync = ref.watch(
      _studentReportsProvider((schoolId: widget.schoolId, studentId: studentId)),
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF0F4FF),
        body: CustomScrollView(
          slivers: [
            // Header
            SliverAppBar(
              expandedHeight: 180,
              pinned: true,
              backgroundColor: colors[0],
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: colors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: SafeArea(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 36),
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.25),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
                          ),
                          child: Center(
                            child: Text(
                              name.isNotEmpty ? name[0].toUpperCase() : '?',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 30),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(firstName, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                        if (className.isNotEmpty)
                          Text(className, style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Auto-detect today's report
            SliverToBoxAdapter(
              child: reportsAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (reports) {
                  final todayStr = _isoDate(DateTime.now());
                  final todayReport = reports.firstWhere(
                    (r) => (r['reportDate'] as String? ?? '').startsWith(todayStr),
                    orElse: () => null,
                  );
                  if (todayReport != null && !_todayDone) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) setState(() => _todayDone = true);
                    });
                  }
                  return const SizedBox.shrink();
                },
              ),
            ),

            // Section label
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Row(
                  children: [
                    Icon(Icons.edit_note_rounded, color: colors[0], size: 22),
                    const SizedBox(width: 8),
                    Text(
                      'Ενημέρωση Σήμερα',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors[0]),
                    ),
                  ],
                ),
              ),
            ),

            // Form or done card
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: _todayDone ? _buildDoneCard(colors) : _buildForm(colors),
              ),
            ),

            // History
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Row(
                  children: [
                    Icon(Icons.history_rounded, color: colors[0], size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Ιστορικό Ενημερώσεων',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors[0]),
                    ),
                  ],
                ),
              ),
            ),

            reportsAsync.when(
              loading: () => const SliverToBoxAdapter(
                  child: SizedBox(height: 60, child: Center(child: CircularProgressIndicator()))),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
              data: (reports) {
                final todayStr = _isoDate(DateTime.now());
                final history = reports
                    .where((r) => !(r['reportDate'] as String? ?? '').startsWith(todayStr))
                    .toList();
                if (history.isEmpty) {
                  return SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                        child: const Text('Δεν υπάρχουν προηγούμενες ενημερώσεις',
                            style: TextStyle(color: Color(0xFF9CA3AF))),
                      ),
                    ),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                      child: _HistoryCard(report: history[i], colors: colors),
                    ),
                    childCount: history.length,
                  ),
                );
              },
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 110)),
          ],
        ),
      ),
    );
  }

  Widget _buildDoneCard(List<Color> colors) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 28),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Η ενημέρωση έγινε!',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF1E1B4B))),
                SizedBox(height: 4),
                Text('Ο γονέας θα δει την ενημέρωση στην εφαρμογή του',
                    style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(List<Color> colors) {
    return Column(
      children: [
        // Mood
        _buildSection(
          'Διάθεση',
          Icons.emoji_emotions_outlined,
          colors,
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _moods.map((m) {
              final isSelected = _selectedMood == m.$1;
              return GestureDetector(
                onTap: () => setState(() => _selectedMood = isSelected ? null : m.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: isSelected
                        ? LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight)
                        : null,
                    color: isSelected ? null : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: isSelected ? Colors.transparent : const Color(0xFFE5E7EB)),
                    boxShadow: isSelected
                        ? [BoxShadow(color: colors[0].withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 3))]
                        : [],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(m.$2, style: const TextStyle(fontSize: 17)),
                      const SizedBox(width: 5),
                      Text(m.$3,
                          style: TextStyle(
                            color: isSelected ? Colors.white : const Color(0xFF6B7280),
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          )),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),

        // Meals
        _buildSection(
          'Διατροφή',
          Icons.restaurant_rounded,
          colors,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildMealRow('Πρωινό 🥛', _mealBreakfast,
                  (v) => setState(() => _mealBreakfast = v), colors),
              const SizedBox(height: 16),
              _buildMealRow('Μεσημεριανό 🍽', _mealLunch,
                  (v) => setState(() => _mealLunch = v), colors),
            ],
          ),
        ),

        // Bathroom
        _buildSection(
          'Υγιεινή: Τουαλέτα',
          Icons.wc_rounded,
          colors,
          Row(
            children: [
              _buildToggleChip('Κακά 💩', _poop, (v) => setState(() => _poop = v), colors),
              const SizedBox(width: 12),
              _buildToggleChip('Τσίσα 💧', _pee, (v) => setState(() => _pee = v), colors),
            ],
          ),
        ),

        // Sleep
        _buildSection(
          'Κοιμήθηκα',
          Icons.bedtime_rounded,
          colors,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildNapRow('1η φορά 😴', _nap1, (v) => setState(() => _nap1 = v), colors),
              const SizedBox(height: 16),
              _buildNapRow('2η φορά 💤', _nap2, (v) => setState(() => _nap2 = v), colors),
            ],
          ),
        ),

        // Activities
        _buildSection(
          'Δραστηριότητες',
          Icons.school_rounded,
          colors,
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _activityList.map((act) {
              final isSelected = _selectedActivities.contains(act);
              return GestureDetector(
                onTap: () => setState(() {
                  if (isSelected) {
                    _selectedActivities.remove(act);
                  } else {
                    _selectedActivities.add(act);
                  }
                }),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: isSelected
                        ? LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight)
                        : null,
                    color: isSelected ? null : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: isSelected ? Colors.transparent : const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isSelected) ...[
                        const Icon(Icons.check_rounded, color: Colors.white, size: 13),
                        const SizedBox(width: 4),
                      ],
                      Text(act,
                          style: TextStyle(
                            color: isSelected ? Colors.white : const Color(0xFF6B7280),
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          )),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),

        // Notes
        _buildSection(
          'Σημείωση προς γονέα',
          Icons.sticky_note_2_outlined,
          colors,
          TextField(
            controller: _notesCtrl,
            maxLines: 4,
            textInputAction: TextInputAction.newline,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E1B4B)),
            decoration: InputDecoration(
              hintText: 'Η δασκάλα μου είπε να σας πω...',
              hintStyle: const TextStyle(color: Color(0xFFD1D5DB), fontSize: 13),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: colors[0], width: 2),
              ),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
        ),

        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: colors[0],
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Αποστολή Ενημέρωσης',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  Widget _buildSection(String title, IconData icon, List<Color> colors, Widget child) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
              color: colors[0].withOpacity(0.07),
              blurRadius: 14,
              offset: const Offset(0, 3))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, color: colors[0], size: 17),
            const SizedBox(width: 8),
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF374151))),
          ]),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _buildMealRow(String label, String? value, ValueChanged<String?> onChange,
      List<Color> colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Color(0xFF6B7280), fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _mealOptions.map((opt) {
              final isSelected = value == opt.$1;
              return GestureDetector(
                onTap: () => onChange(isSelected ? null : opt.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: isSelected
                        ? LinearGradient(
                            colors: colors,
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight)
                        : null,
                    color: isSelected ? null : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: isSelected ? Colors.transparent : const Color(0xFFE5E7EB)),
                  ),
                  child: Text(opt.$2,
                      style: TextStyle(
                        color: isSelected ? Colors.white : const Color(0xFF6B7280),
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      )),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildNapRow(
      String label, int value, ValueChanged<int> onChange, List<Color> colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Color(0xFF6B7280), fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _napOptions.map((opt) {
              final isSelected = value == opt.$1;
              return GestureDetector(
                onTap: () => onChange(opt.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: isSelected
                        ? LinearGradient(
                            colors: colors,
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight)
                        : null,
                    color: isSelected ? null : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: isSelected ? Colors.transparent : const Color(0xFFE5E7EB)),
                  ),
                  child: Text(opt.$2,
                      style: TextStyle(
                        color: isSelected ? Colors.white : const Color(0xFF6B7280),
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      )),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildToggleChip(
      String label, bool value, ValueChanged<bool> onChange, List<Color> colors) {
    return GestureDetector(
      onTap: () => onChange(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          gradient: value
              ? LinearGradient(
                  colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight)
              : null,
          color: value ? null : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(20),
          border:
              Border.all(color: value ? Colors.transparent : const Color(0xFFE5E7EB)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              value ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
              size: 18,
              color: value ? Colors.white : const Color(0xFF9CA3AF),
            ),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                  color: value ? Colors.white : const Color(0xFF6B7280),
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                )),
          ],
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final Map<String, dynamic> report;
  final List<Color> colors;
  const _HistoryCard({required this.report, required this.colors});

  static const _moodEmojis = {
    'χαρούμενος': '😊', 'happy': '😊', 'ήρεμος': '😌', 'calm': '😌',
    'κουρασμένος': '😴', 'tired': '😴', 'λυπημένος': '😢', 'sad': '😢',
    'αγχωμένος': '😰', 'ενθουσιασμένος': '🤩',
  };

  static const _mealLabels = {
    'all': 'Όλο', 'most': 'Τα περισσότερα', 'half': 'Τα μισά',
    'little': 'Λίγο', 'none': 'Καθόλου',
  };

  @override
  Widget build(BuildContext context) {
    final mood = report['mood'] as String?;
    final notes = report['notes'] as String?;
    final date = report['reportDate'] as String?;
    final emoji = mood != null ? (_moodEmojis[mood.toLowerCase()] ?? '😐') : '😐';
    final mealB = report['mealBreakfast'] as String?;
    final mealL = report['mealLunch'] as String?;
    final nap1 = report['napDurationMinutes'] as int? ?? 0;
    final nap2 = report['nap2DurationMinutes'] as int? ?? 0;
    final bathroomCount = report['bathroomCount'] as int? ?? 0;
    final diaperChanges = report['diaperChanges'] as int? ?? 0;
    final rawActs = report['activities'];
    final acts = rawActs is List ? rawActs.cast<String>() : <String>[];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 24)),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: colors[0].withOpacity(0.1), borderRadius: BorderRadius.circular(7)),
                child: Text(date != null ? _formatDate(date) : '',
                    style: TextStyle(color: colors[0], fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(notes, style: const TextStyle(color: Color(0xFF4B5563), fontSize: 13, height: 1.4)),
          ],
          if (mealB != null || mealL != null) ...[
            const SizedBox(height: 6),
            Text(
              [
                if (mealB != null) 'Πρωινό: ${_mealLabels[mealB] ?? mealB}',
                if (mealL != null) 'Μεσημ.: ${_mealLabels[mealL] ?? mealL}',
              ].join(' • '),
              style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
            ),
          ],
          if (bathroomCount > 0 || diaperChanges > 0) ...[
            const SizedBox(height: 4),
            Text(
              '🚽 ${[if (bathroomCount > 0) 'Κακά ✓', if (diaperChanges > 0) 'Τσίσα ✓'].join(' · ')}',
              style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
            ),
          ],
          if (nap1 > 0 || nap2 > 0) ...[
            const SizedBox(height: 4),
            Text(
              '😴 ${[if (nap1 > 0) '1η: ${_napLabel(nap1)}', if (nap2 > 0) '2η: ${_napLabel(nap2)}'].join(' · ')}',
              style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
            ),
          ],
          if (acts.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '🎨 ${acts.join(', ')}',
              style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
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

  String _napLabel(int minutes) {
    if (minutes == 0) return 'Καθόλου';
    if (minutes < 60) return '$minutes\'';
    if (minutes == 60) return '1 ώρα';
    if (minutes == 90) return '1½ ώρα';
    return '${minutes ~/ 60} ώρες';
  }
}
