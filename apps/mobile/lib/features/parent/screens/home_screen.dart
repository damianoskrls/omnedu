import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/app_image.dart';
import 'child_detail_screen.dart';
import 'school_posts_screen.dart';

final myChildrenProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/students/my-children');
    final data = resp.data;
    return data is List ? data : [];
  },
);

final diaryFeedHomeProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/daily-reports/feed');
    final data = resp.data;
    return data is List ? data.take(5).toList() : [];
  },
);

final _recentPostsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    try {
      final resp = await dio.get('/schools/$schoolId/posts');
      final data = resp.data;
      return data is List ? data.take(3).toList() : [];
    } catch (_) {
      return [];
    }
  },
);

final _upcomingActivitiesProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    try {
      final resp = await dio.get('/schools/$schoolId/activities');
      final data = resp.data;
      if (data is List) {
        final now = DateTime.now();
        return data.where((a) {
          final endsOn = a['endsOn'] as String?;
          if (endsOn == null) return true;
          try {
            return DateTime.parse(endsOn).isAfter(now);
          } catch (_) {
            return true;
          }
        }).take(5).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  },
);

void _showLogout(BuildContext context, WidgetRef ref) {
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
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            ListTile(
              leading: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
              title: const Text(
                'Αποσύνδεση',
                style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
              ),
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

class HomeScreen extends ConsumerWidget {
  final String schoolId;
  const HomeScreen({super.key, required this.schoolId});

  static const _gradients = [
    [Color(0xFF4F46E5), Color(0xFF7C3AED)],
    [Color(0xFF0EA5E9), Color(0xFF6366F1)],
    [Color(0xFFEC4899), Color(0xFFF43F5E)],
    [Color(0xFF10B981), Color(0xFF059669)],
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(myChildrenProvider(schoolId));
    final diaryAsync = ref.watch(diaryFeedHomeProvider(schoolId));
    final activitiesAsync = ref.watch(_upcomingActivitiesProvider(schoolId));
    final postsAsync = ref.watch(_recentPostsProvider(schoolId));
    final user = ref.watch(authProvider).user;
    final firstName = user?.fullName.split(' ').first ?? '';
    final schoolName = user?.memberships.isNotEmpty == true
        ? user!.memberships.first.schoolName
        : 'Ονειροχώρα';

    return Scaffold(
      backgroundColor: const Color(0xFFF6F5FF),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myChildrenProvider(schoolId));
          ref.invalidate(diaryFeedHomeProvider(schoolId));
          ref.invalidate(_upcomingActivitiesProvider(schoolId));
          ref.invalidate(_recentPostsProvider(schoolId));
        },
        child: CustomScrollView(
          slivers: [
            // School logo row
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 56, 20, 0),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF4F46E5).withOpacity(0.35),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          'Ο',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      schoolName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E1B4B),
                        letterSpacing: -0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Greeting card
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
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
                            'Δείτε τι κάνουν τα παιδιά σας σήμερα',
                            style: TextStyle(fontSize: 13, color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _showLogout(context, ref),
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

            // Children section label
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Text(
                  'Παιδιά μου',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
                ),
              ),
            ),

            // Children horizontal list
            SliverToBoxAdapter(
              child: childrenAsync.when(
                loading: () => const SizedBox(
                  height: 130,
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text('Σφάλμα: $e', style: const TextStyle(color: Colors.red)),
                ),
                data: (children) => children.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20),
                        child: Text('Δεν βρέθηκαν παιδιά.', style: TextStyle(color: Color(0xFF9CA3AF))),
                      )
                    : SizedBox(
                        height: 130,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          separatorBuilder: (_, __) => const SizedBox(width: 12),
                          itemCount: children.length,
                          itemBuilder: (_, i) => _ChildCard(
                            child: children[i],
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ChildDetailScreen(child: children[i]),
                              ),
                            ),
                          ),
                        ),
                      ),
              ),
            ),

            // Upcoming activities section
            SliverToBoxAdapter(
              child: activitiesAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (activities) {
                  if (activities.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(20, 28, 20, 12),
                        child: Text(
                          'Δραστηριότητες & Εκδρομές',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
                        ),
                      ),
                      SizedBox(
                        height: 90,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          separatorBuilder: (_, __) => const SizedBox(width: 10),
                          itemCount: activities.length,
                          itemBuilder: (_, i) => _ActivityCard(activity: activities[i]),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

            // Recent school posts section
            SliverToBoxAdapter(
              child: postsAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (posts) {
                  if (posts.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                        child: Row(
                          children: [
                            const Text(
                              'Νέα & Εκδηλώσεις',
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
                            ),
                            const Spacer(),
                            GestureDetector(
                              onTap: () => Navigator.push(context, MaterialPageRoute(
                                builder: (_) => SchoolPostsScreen(schoolId: schoolId),
                              )),
                              child: const Text('Όλα',
                                  style: TextStyle(fontSize: 13, color: Color(0xFF4F46E5), fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Column(
                          children: posts.map((p) => _PostMini(
                            post: p as Map<String, dynamic>,
                            schoolId: schoolId,
                          )).toList(),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

            // Recent diary label
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Text(
                  'Πρόσφατο Ημερολόγιο',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
                ),
              ),
            ),

            // Diary feed
            SliverToBoxAdapter(
              child: diaryAsync.when(
                loading: () => const SizedBox(height: 80, child: Center(child: CircularProgressIndicator())),
                error: (_, __) => const SizedBox.shrink(),
                data: (reports) => reports.isEmpty
                    ? Container(
                        margin: const EdgeInsets.symmetric(horizontal: 20),
                        padding: const EdgeInsets.all(28),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Column(
                          children: [
                            Icon(Icons.auto_stories_rounded, size: 40, color: Color(0xFFDDD9FF)),
                            SizedBox(height: 8),
                            Text('Καμία καταχώρηση ακόμα',
                                style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 14)),
                          ],
                        ),
                      )
                    : Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Column(
                          children: reports
                              .map((r) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: _DiaryMini(report: r),
                                  ))
                              .toList(),
                        ),
                      ),
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 110)),
          ],
        ),
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  final Map<String, dynamic> child;
  final VoidCallback? onTap;
  const _ChildCard({required this.child, this.onTap});

  static const _gradients = [
    [Color(0xFF4F46E5), Color(0xFF7C3AED)],
    [Color(0xFF0EA5E9), Color(0xFF6366F1)],
    [Color(0xFFEC4899), Color(0xFFF43F5E)],
    [Color(0xFF10B981), Color(0xFF059669)],
  ];

  @override
  Widget build(BuildContext context) {
    final name = child['fullName'] as String? ?? '';
    final firstName = name.split(' ').first;
    final avatarUrl = child['avatarUrl'] as String?;
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    final className = enrollments.isNotEmpty
        ? (enrollments.first['class']?['name'] as String? ?? '')
        : '';
    final colorIndex = name.isNotEmpty ? name.codeUnitAt(0) % _gradients.length : 0;
    final colors = _gradients[colorIndex];

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 120,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: colors[0].withOpacity(0.15),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(height: 16),
            if (avatarUrl != null && avatarUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: AppImage(
                  avatarUrl,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => _letterAvatar(name, colors),
                ),
              )
            else
              _letterAvatar(name, colors),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                firstName,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF1E1B4B)),
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
            if (className.isNotEmpty) ...[
              const SizedBox(height: 4),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 10),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: colors[0].withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  className,
                  style: TextStyle(color: colors[0], fontSize: 10, fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
            const SizedBox(height: 14),
          ],
        ),
      ),
    );
  }

  Widget _letterAvatar(String name, List<Color> colors) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 24),
        ),
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  final Map<String, dynamic> activity;
  const _ActivityCard({required this.activity});

  static const _typeIcons = {
    'excursion': (Icons.directions_bus_rounded, Color(0xFF0EA5E9)),
    'sport': (Icons.sports_soccer_rounded, Color(0xFF10B981)),
    'art': (Icons.palette_rounded, Color(0xFFEC4899)),
    'music': (Icons.music_note_rounded, Color(0xFF8B5CF6)),
    'language': (Icons.translate_rounded, Color(0xFFF59E0B)),
    'other': (Icons.star_rounded, Color(0xFF6366F1)),
  };

  @override
  Widget build(BuildContext context) {
    final title = activity['title'] as String? ?? '';
    final type = activity['activityType'] as String? ?? 'other';
    final startsOn = activity['startsOn'] as String?;
    final (icon, color) = _typeIcons[type] ?? _typeIcons['other']!;

    String dateLabel = '';
    if (startsOn != null) {
      try {
        final d = DateTime.parse(startsOn);
        const months = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
        dateLabel = '${d.day} ${months[d.month - 1]}';
      } catch (_) {}
    }

    return Container(
      width: 160,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.12),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 16),
              ),
              if (dateLabel.isNotEmpty) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Text(dateLabel, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E1B4B)),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _DiaryMini extends StatelessWidget {
  final Map<String, dynamic> report;
  const _DiaryMini({required this.report});

  static const _moodEmojis = {
    'χαρούμενος': '😊', 'happy': '😊', 'ήρεμος': '😌', 'calm': '😌',
    'κουρασμένος': '😴', 'tired': '😴', 'λυπημένος': '😢', 'sad': '😢',
    'αγχωμένος': '😰', 'ενθουσιασμένος': '🤩',
  };

  @override
  Widget build(BuildContext context) {
    final student = report['student'] as Map<String, dynamic>?;
    final name = student?['fullName'] as String? ?? '';
    final mood = report['mood'] as String?;
    final notes = report['notes'] as String?;
    final date = report['reportDate'] as String?;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.split(' ').first,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF1E1B4B)),
                ),
                const SizedBox(height: 2),
                if (notes != null && notes.isNotEmpty)
                  Text(notes,
                      style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis)
                else if (date != null)
                  Text(_formatDate(date), style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
              ],
            ),
          ),
          if (mood != null)
            Text(_moodEmojis[mood.toLowerCase()] ?? '😐', style: const TextStyle(fontSize: 22)),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day}/${d.month}/${d.year}';
    } catch (_) {
      return iso;
    }
  }
}

class _PostMini extends StatelessWidget {
  final Map<String, dynamic> post;
  final String schoolId;
  const _PostMini({required this.post, required this.schoolId});

  static const _typeColors = {
    'excursion': (Color(0xFFECFDF5), Color(0xFF059669), 'Εκδρομή'),
    'theater': (Color(0xFFFAF5FF), Color(0xFF7C3AED), 'Θέατρο'),
    'event': (Color(0xFFFFF7ED), Color(0xFFEA580C), 'Εκδήλωση'),
    'general': (Color(0xFFEFF6FF), Color(0xFF2563EB), 'Γενικό'),
  };

  @override
  Widget build(BuildContext context) {
    final title = post['title'] as String? ?? '';
    final postType = post['postType'] as String? ?? 'general';
    final publishedAt = post['publishedAt'] as String?;
    final rawUrls = post['mediaUrls'];
    final mediaUrls = rawUrls is List ? rawUrls.cast<String>() : <String>[];
    final (bg, fg, label) = _typeColors[postType] ?? _typeColors['general']!;

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
        builder: (_) => SchoolPostsScreen(schoolId: schoolId),
      )),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 3))],
        ),
        child: Row(
          children: [
            if (mediaUrls.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: AppImage(mediaUrls.first, width: 54, height: 54, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _TypeIcon(bg: bg, fg: fg)),
              )
            else
              _TypeIcon(bg: bg, fg: fg),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(5)),
                    child: Text(label, style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 4),
                  Text(title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E1B4B))),
                ],
              ),
            ),
            if (publishedAt != null) ...[
              const SizedBox(width: 8),
              Text(_shortDate(publishedAt), style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
            ],
          ],
        ),
      ),
    );
  }

  String _shortDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      const m = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      return '${d.day} ${m[d.month]}';
    } catch (_) {
      return '';
    }
  }
}

class _TypeIcon extends StatelessWidget {
  final Color bg;
  final Color fg;
  const _TypeIcon({required this.bg, required this.fg});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 54,
      height: 54,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Icon(Icons.photo_library_outlined, color: fg, size: 22),
    );
  }
}
