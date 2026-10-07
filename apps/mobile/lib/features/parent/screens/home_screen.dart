import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/person_face.dart';
import 'child_hub_screen.dart';
import 'day_history.dart';
import 'parent_meetings_screen.dart';
import 'school_posts_screen.dart';
import 'teacher_absences_screen.dart';
import 'thematic_screen.dart';

final myChildrenProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/students/my-children');
    final data = resp.data;
    return data is List ? data : [];
  },
);

final monthThematicProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  try {
    final resp = await dio.get(
      '/schools/$schoolId/thematic-plans',
      queryParameters: {'month': thematicMonthKey(DateTime.now())},
    );
    return resp.data is List ? resp.data as List<dynamic> : [];
  } catch (_) {
    return [];
  }
});

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

class HomeScreen extends ConsumerWidget {
  final String schoolId;
  const HomeScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(myChildrenProvider(schoolId));
    final postsAsync = ref.watch(_recentPostsProvider(schoolId));
    final thematicAsync = ref.watch(monthThematicProvider(schoolId));
    final meetingsAsync = ref.watch(parentMeetingsProvider(schoolId));
    final absencesAsync = ref.watch(teacherAbsencesProvider(schoolId));
    final user = ref.watch(authProvider).user;
    final firstName = user?.fullName.split(' ').first ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myChildrenProvider(schoolId));
          ref.invalidate(childDayReportsProvider);
          ref.invalidate(dayHistoryMenuProvider);
          ref.invalidate(_recentPostsProvider(schoolId));
          ref.invalidate(monthThematicProvider(schoolId));
          ref.invalidate(parentMeetingsProvider(schoolId));
          ref.invalidate(teacherAbsencesProvider(schoolId));
        },
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF77328D), Color(0xFFE95926)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF77328D).withOpacity(0.4),
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
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: AbsenceHomeNotice(absences: absencesAsync.asData?.value ?? const []),
            ),

            SliverToBoxAdapter(
              child: childrenAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text('Σφάλμα: $e', style: const TextStyle(color: Colors.red)),
                ),
                data: (children) {
                  if (children.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.fromLTRB(20, 24, 20, 0),
                      child: Text('Δεν βρέθηκαν παιδιά.', style: TextStyle(color: Color(0xFF9CA3AF))),
                    );
                  }
                  final plans = thematicAsync.asData?.value ?? const [];
                  final meetings = meetingsAsync.asData?.value ?? const [];
                  final cards = children.map((raw) => Map<String, dynamic>.from(raw as Map)).toList();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        height: 148,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
                          itemCount: cards.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 12),
                          itemBuilder: (context, index) {
                            final child = cards[index];
                            return _ChildEntryCard(
                              child: child,
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ChildHubScreen(schoolId: schoolId, child: child),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      for (var i = 0; i < cards.length; i++) ...[
                        if (cards.length > 1)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
                            child: Text(
                              cards[i]['fullName']?.toString() ?? '',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF2C2422)),
                            ),
                          ),
                        DayHistoryPanel(
                          schoolId: schoolId,
                          child: cards[i],
                          showMenu: i == 0,
                        ),
                        _HomeExtras(
                          thematic: _thematicFor(plans, cards[i]),
                          meeting: acceptedMeetingFor(meetings, cards[i]['id']?.toString()),
                        ),
                      ],
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
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF2C2422)),
                            ),
                            const Spacer(),
                            GestureDetector(
                              onTap: () => Navigator.push(context, MaterialPageRoute(
                                builder: (_) => SchoolPostsScreen(schoolId: schoolId),
                              )),
                              child: const Text('Όλα',
                                  style: TextStyle(fontSize: 13, color: Color(0xFF77328D), fontWeight: FontWeight.w600)),
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

            const SliverToBoxAdapter(child: SizedBox(height: 110)),
          ],
        ),
      ),
    );
  }
}

Map<String, dynamic>? _thematicFor(List<dynamic> plans, Map<String, dynamic> child) {
  final enrollments = child['enrollments'] as List? ?? [];
  final klass = enrollments.isNotEmpty && enrollments.first is Map ? enrollments.first['class'] : null;
  final classId = klass is Map ? klass['id']?.toString() : null;
  if (classId == null || classId.isEmpty) return null;
  Map<String, dynamic>? covering;
  final month = thematicMonthKey(DateTime.now());
  for (final raw in plans) {
    if (raw is! Map || raw['classId']?.toString() != classId) continue;
    final plan = Map<String, dynamic>.from(raw);
    if (plan['month'] == month) return plan;
    covering ??= plan;
  }
  return covering;
}

class _ChildEntryCard extends StatelessWidget {
  final Map<String, dynamic> child;
  final VoidCallback onTap;
  const _ChildEntryCard({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final name = child['fullName']?.toString() ?? '';
    final photo = child['avatarUrl']?.toString();
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Ink(
          width: 156,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE7D4F0)),
            gradient: const LinearGradient(
              colors: [Color(0xFFFFFFFF), Color(0xFFFFF7F4)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
            child: Column(
              children: [
                PersonFace(
                  name: name,
                  photoUrl: photo,
                  size: 64,
                  radius: 22,
                  fontSize: 22,
                  background: const Color(0xFF77328D),
                  foreground: Colors.white,
                ),
                const SizedBox(height: 10),
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, height: 1.2, color: Color(0xFF2C2422)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeExtras extends StatelessWidget {
  final Map<String, dynamic>? thematic;
  final Map<String, dynamic>? meeting;
  const _HomeExtras({required this.thematic, required this.meeting});

  @override
  Widget build(BuildContext context) {
    final title = thematic == null
        ? 'Δεν έχει ανέβει ακόμα για αυτόν τον μήνα.'
        : (thematic!['title']?.toString().trim().isNotEmpty == true ? thematic!['title'].toString() : 'Διαθεματικό');
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        children: [
          if (meeting != null)
            _extraRow(
              Icons.event_available_rounded,
              'Επερχόμενη συνάντηση',
              '${meetingDay(meeting!['meetingDate'])} στις ${meeting!['acceptedSlot'] ?? ''}',
            ),
          _extraRow(
            Icons.auto_stories_rounded,
            'Διαθεματικό ${thematicMonthLabel(thematicMonthKey(DateTime.now()))}',
            title,
          ),
        ],
      ),
    );
  }

  Widget _extraRow(IconData icon, String label, String value) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF0E6F4)),
      ),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFFE95926), size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 13, color: Color(0xFF374151))),
              ],
            ),
          ),
        ],
      ),
    );
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
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF2C2422))),
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
