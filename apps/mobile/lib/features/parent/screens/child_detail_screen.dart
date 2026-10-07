import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/person_face.dart';

final _childReportsProvider =
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

final _todayMenuProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final today = _isoDate(DateTime.now());
  try {
    final resp = await dio.get('/schools/$schoolId/daily-menus/$today');
    return resp.data as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

String _isoDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class ChildDetailScreen extends ConsumerWidget {
  final Map<String, dynamic> child;

  const ChildDetailScreen({super.key, required this.child});

  static const _gradients = [
    [Color(0xFF77328D), Color(0xFFE95926)],
    [Color(0xFF0EA5E9), Color(0xFF6366F1)],
    [Color(0xFFEC4899), Color(0xFFF43F5E)],
    [Color(0xFF10B981), Color(0xFF059669)],
  ];

  static const _moodEmojis = {
    'χαρούμενος': '😊', 'happy': '😊', 'ήρεμος': '😌', 'calm': '😌',
    'κουρασμένος': '😴', 'tired': '😴', 'λυπημένος': '😢', 'sad': '😢',
    'αγχωμένος': '😰', 'anxious': '😰', 'ενθουσιασμένος': '🤩',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user!;
    final schoolId = user.schoolId ?? '';
    final studentId = child['id'] as String? ?? '';
    final name = child['fullName'] as String? ?? '';
    final photo = child['avatarUrl'] as String?;
    final firstName = name.split(' ').first;
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    final className = enrollments.isNotEmpty
        ? (enrollments.first['class']?['name'] as String? ?? '')
        : '';
    final colorIndex = name.isNotEmpty ? name.codeUnitAt(0) % _gradients.length : 0;
    final colors = _gradients[colorIndex];

    final reportsAsync =
        ref.watch(_childReportsProvider((schoolId: schoolId, studentId: studentId)));
    final menuAsync = ref.watch(_todayMenuProvider(schoolId));

    final todayStr = _isoDate(DateTime.now());

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F5FF),
        body: CustomScrollView(
          slivers: [
            // Gradient header
            SliverAppBar(
              expandedHeight: 200,
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
                        const SizedBox(height: 40),
                        PersonFace(
                          name: name,
                          photoUrl: photo,
                          size: 80,
                          radius: 26,
                          fontSize: 36,
                          background: Colors.white.withOpacity(0.25),
                          foreground: Colors.white,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          firstName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (className.isNotEmpty)
                          Text(
                            className,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.8),
                              fontSize: 13,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Today's diary
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Row(
                  children: [
                    Icon(Icons.today_rounded, color: colors[0], size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Ενημέρωση Σήμερα',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: colors[0],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: reportsAsync.when(
                  loading: () => _loadingCard(),
                  error: (e, _) => _emptyCard('Σφάλμα φόρτωσης'),
                  data: (reports) {
                    final todayReport = reports.firstWhere(
                      (r) {
                        final d = r['reportDate'] as String? ?? '';
                        return d.startsWith(todayStr);
                      },
                      orElse: () => null,
                    );
                    if (todayReport == null) {
                      return _emptyCard('Δεν υπάρχει ενημέρωση για σήμερα ακόμα');
                    }
                    return _DiaryCard(report: todayReport, colors: colors);
                  },
                ),
              ),
            ),

            // Today's menu
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Row(
                  children: [
                    Icon(Icons.restaurant_rounded, color: colors[0], size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Διατροφολόγιο Σήμερα',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: colors[0],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: menuAsync.when(
                  loading: () => _loadingCard(),
                  error: (_, __) => _emptyCard('Δεν υπάρχει καταχωρημένο μενού'),
                  data: (menu) => menu == null
                      ? _emptyCard('Δεν υπάρχει καταχωρημένο μενού για σήμερα')
                      : _MenuCard(menu: menu, colors: colors),
                ),
              ),
            ),

            // Recent diary
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                child: Row(
                  children: [
                    Icon(Icons.history_rounded, color: colors[0], size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Πρόσφατες Ενημερώσεις',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: colors[0],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            reportsAsync.when(
              loading: () => SliverToBoxAdapter(child: _loadingCard()),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
              data: (reports) {
                final recent = reports.where((r) {
                  final d = r['reportDate'] as String? ?? '';
                  return !d.startsWith(todayStr);
                }).take(10).toList();

                if (recent.isEmpty) {
                  return SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: _emptyCard('Δεν υπάρχουν προηγούμενες ενημερώσεις'),
                    ),
                  );
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                      child: _DiaryCard(report: recent[i], colors: colors),
                    ),
                    childCount: recent.length,
                  ),
                );
              },
            ),

            // Class instructions
            Builder(builder: (context) {
              final enrollments2 = child['enrollments'] as List<dynamic>? ?? [];
              final instructions = enrollments2.isNotEmpty
                  ? (enrollments2.first['class']?['instructions'] as List<dynamic>? ?? [])
                  : <dynamic>[];
              if (instructions.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
              return SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Icon(Icons.assignment_rounded, color: colors[0], size: 20),
                        const SizedBox(width: 8),
                        Text('Οδηγίες από το Σχολείο',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors[0])),
                      ]),
                      const SizedBox(height: 12),
                      ...instructions.map((instr) {
                        final i = instr as Map<String, dynamic>;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFBEB),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFFDE68A)),
                          ),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(
                                child: Text(i['title'] as String? ?? '',
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF92400E))),
                              ),
                              if ((i['category'] as String?)?.isNotEmpty == true)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF59E0B).withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(i['category'] as String,
                                      style: const TextStyle(fontSize: 10, color: Color(0xFFB45309), fontWeight: FontWeight.w600)),
                                ),
                            ]),
                            const SizedBox(height: 4),
                            Text(i['content'] as String? ?? '',
                                style: const TextStyle(fontSize: 13, color: Color(0xFF78350F))),
                          ]),
                        );
                      }),
                    ],
                  ),
                ),
              );
            }),

            // Event enrollments
            Builder(builder: (context) {
              final eventEnrollments = child['eventEnrollments'] as List<dynamic>? ?? [];
              if (eventEnrollments.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
              final pending = eventEnrollments.where((e) =>
                  (e['status'] as String?) == 'pending_consent' ||
                  (e['status'] as String?) == 'pending_payment').toList();
              return SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Icon(Icons.event_rounded, color: colors[0], size: 20),
                        const SizedBox(width: 8),
                        Text('Εκδηλώσεις',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors[0])),
                        if (pending.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFFF59E0B), borderRadius: BorderRadius.circular(20)),
                            child: Text('${pending.length} εκκρεμεί',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                          ),
                        ],
                      ]),
                      const SizedBox(height: 12),
                      ...eventEnrollments.take(5).map((enr) {
                        final e = enr as Map<String, dynamic>;
                        final event = e['event'] as Map<String, dynamic>? ?? {};
                        final status = e['status'] as String? ?? '';
                        const statusColors = {
                          'pending_consent': (Color(0xFFF59E0B), Color(0xFFFFFBEB)),
                          'pending_payment': (Color(0xFF2563EB), Color(0xFFEFF6FF)),
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
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Row(children: [
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(event['title'] as String? ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF111827))),
                              if ((event['eventDate'] as String?) != null)
                                Text(_formatDate(event['eventDate'] as String),
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                            ])),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: sc.$2, borderRadius: BorderRadius.circular(8)),
                              child: Text(statusLabels[status] ?? status,
                                  style: TextStyle(color: sc.$1, fontSize: 11, fontWeight: FontWeight.w600)),
                            ),
                          ]),
                        );
                      }),
                    ],
                  ),
                ),
              );
            }),

            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
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

  Widget _loadingCard() => Container(
        height: 80,
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: const Center(child: CircularProgressIndicator()),
      );

  Widget _emptyCard(String msg) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline_rounded, color: Color(0xFFCBD5E1), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                msg,
                style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
              ),
            ),
          ],
        ),
      );
}

class _DiaryCard extends StatelessWidget {
  final Map<String, dynamic> report;
  final List<Color> colors;
  const _DiaryCard({required this.report, required this.colors});

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

    final mealBreakfast = report['mealBreakfast'] as String?;
    final mealLunch = report['mealLunch'] as String?;
    final nap1 = report['napDurationMinutes'] as int? ?? 0;
    final nap2 = report['nap2DurationMinutes'] as int? ?? 0;
    final bathroomCount = report['bathroomCount'] as int? ?? 0;
    final diaperChanges = report['diaperChanges'] as int? ?? 0;
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
          BoxShadow(
            color: colors[0].withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Date + Mood
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: colors[0].withOpacity(0.1),
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

          // Notes
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colors[0].withOpacity(0.05),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '"$notes"',
                style: TextStyle(color: colors[0].withOpacity(0.9), fontSize: 13, height: 1.5, fontStyle: FontStyle.italic),
              ),
            ),
          ],

          // Divider before details
          if (hasDetails) ...[
            const SizedBox(height: 12),
            const Divider(color: Color(0xFFF3F4F6), height: 1),
            const SizedBox(height: 10),
          ],

          // Meals
          if (hasMeals)
            _detailRow('🍽', 'Φαγητό', [
              if (mealBreakfast != null) 'Πρωινό: ${_mealLabels[mealBreakfast] ?? mealBreakfast}',
              if (mealLunch != null) 'Μεσημ.: ${_mealLabels[mealLunch] ?? mealLunch}',
            ].join(' • ')),

          // Bathroom
          if (hasBathroom)
            _detailRow('🚽', 'Τουαλέτα', [
              if (bathroomCount > 0) 'Κακά ✓',
              if (diaperChanges > 0) 'Τσίσα ✓',
            ].join(' • ')),

          // Sleep
          if (hasSleep)
            _detailRow('😴', 'Ύπνος', [
              if (nap1 > 0) '1η: ${_napLabel(nap1)}',
              if (nap2 > 0) '2η: ${_napLabel(nap2)}',
            ].join(' • ')),

          // Activities
          if (hasActivities)
            _detailRow('🎨', 'Δραστηριότητες', activities.join(', ')),

          // Teacher
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
          Expanded(
            child: Text(value, style: const TextStyle(color: Color(0xFF4B5563), fontSize: 12)),
          ),
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

class _MenuCard extends StatelessWidget {
  final Map<String, dynamic> menu;
  final List<Color> colors;
  const _MenuCard({required this.menu, required this.colors});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Πρωινό', Icons.free_breakfast_rounded, menu['breakfast']),
      ('Δεκατιανό', Icons.apple_rounded, menu['midMorning']),
      ('Μεσημεριανό', Icons.lunch_dining_rounded, menu['lunch']),
      ('Απογευματινό', Icons.icecream_rounded, menu['afternoon']),
    ];

    final hasItems = items.any((i) => i.$3 != null && (i.$3 as String).isNotEmpty);
    if (!hasItems) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: const Text(
          'Δεν υπάρχει καταχωρημένο μενού για σήμερα',
          style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: colors[0].withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          ...items.where((i) => i.$3 != null && (i.$3 as String).isNotEmpty).map((item) {
            final isLast = items.where((i) => i.$3 != null && (i.$3 as String).isNotEmpty).last == item;
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: BoxDecoration(
                border: isLast
                    ? null
                    : const Border(bottom: BorderSide(color: Color(0xFFF3F4F6), width: 1)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: colors[0].withOpacity(0.1),
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
                            color: Color(0xFF9CA3AF),
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          item.$3 as String,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF1E1B4B),
                            fontWeight: FontWeight.w500,
                          ),
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
              decoration: BoxDecoration(
                color: colors[0].withOpacity(0.05),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
              ),
              child: Text(
                '📝 ${menu['notes']}',
                style: TextStyle(color: colors[0], fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}
