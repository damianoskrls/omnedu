import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/person_face.dart';
import '../../medications/medications_screen.dart';
import '../parent_children.dart';
import 'bus_closure.dart';
import 'child_hub_screen.dart';
import 'day_history.dart';
import 'parent_meetings_screen.dart';
import 'school_posts_screen.dart';
import 'teacher_absences_screen.dart';
import 'thematic_screen.dart';

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
      if (data is! List) return [];
      return data.where((row) => row is! Map || row['postType']?.toString() != 'found').take(3).toList();
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
    final cards = _childMaps(childrenAsync.asData?.value ?? const []);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myChildrenProvider(schoolId));
          ref.invalidate(childDayReportsProvider);
          ref.invalidate(childReportRangeProvider);
          ref.invalidate(dayHistoryMenuProvider);
          ref.invalidate(_recentPostsProvider(schoolId));
          ref.invalidate(schoolPostsProvider((schoolId: schoolId, type: 'found', studentId: null)));
          ref.invalidate(monthThematicProvider(schoolId));
          ref.invalidate(parentMeetingsProvider(schoolId));
          ref.invalidate(teacherAbsencesProvider(schoolId));
          ref.invalidate(medicationsProvider(schoolId));
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
              child: AbsenceHomeNotice(
                absences: absencesAsync.asData?.value ?? const [],
                children: cards,
              ),
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
                      if (cards.any(childHasBus)) BusClosedNotice(schoolId: schoolId),
                      daySectionTitle(Icons.today_rounded, 'Ενημέρωση Σήμερα', dayHistoryColors),
                      for (final child in cards)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                          child: ChildTodayUpdate(schoolId: schoolId, child: child),
                        ),
                      daySectionTitle(Icons.restaurant_rounded, 'Διατροφολόγιο Σήμερα', dayHistoryColors),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                        child: SharedTodayMenu(schoolId: schoolId, children: cards),
                      ),
                      daySectionTitle(Icons.history_rounded, 'Πρόσφατες Ενημερώσεις', dayHistoryColors),
                      for (final child in cards)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                          child: ChildRecentUpdates(schoolId: schoolId, child: child),
                        ),
                      if (cards.any(childHasInstructions)) ...[
                        daySectionTitle(Icons.assignment_rounded, 'Οδηγίες από το Σχολείο', dayHistoryColors),
                        for (final child in cards) ChildInstructionCards(child: child),
                      ],
                      if (cards.any(childHasEvents)) ...[
                        daySectionTitle(
                          Icons.event_rounded,
                          'Εκδηλώσεις',
                          dayHistoryColors,
                          badge: () {
                            final pending = cards.fold<int>(0, (sum, child) => sum + childPendingEvents(child));
                            return pending > 0 ? '$pending εκκρεμεί' : null;
                          }(),
                        ),
                        for (final child in cards) ChildEventCards(schoolId: schoolId, child: child),
                      ],
                      ParentMedicationSection(schoolId: schoolId),
                      _GroupedExtras(children: cards, plans: plans, meetings: meetings),
                    ],
                  );
                },
              ),
            ),

            SliverToBoxAdapter(child: _FoundNoticesHome(schoolId: schoolId)),

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
                          children: posts.map((p) {
                            final post = Map<String, dynamic>.from(p as Map);
                            return _PostMini(
                              post: post,
                              schoolId: schoolId,
                              children: _childrenForPost(cards, post),
                            );
                          }).toList(),
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

List<Map<String, dynamic>> _childMaps(List<dynamic> children) {
  return children.whereType<Map>().map((raw) => Map<String, dynamic>.from(raw)).toList();
}

Map<String, dynamic>? _classOf(Map<String, dynamic> child) {
  final enrollments = child['enrollments'] as List? ?? [];
  if (enrollments.isEmpty || enrollments.first is! Map) return null;
  final klass = enrollments.first['class'];
  return klass is Map ? Map<String, dynamic>.from(klass) : null;
}

List<String> _audienceIds(dynamic raw) {
  if (raw is List) return raw.map((item) => item.toString()).where((item) => item.isNotEmpty).toList();
  if (raw is! String || raw.trim().isEmpty) return const [];
  try {
    final parsed = jsonDecode(raw);
    if (parsed is List) return parsed.map((item) => item.toString()).where((item) => item.isNotEmpty).toList();
  } catch (_) {}
  return const [];
}

List<Map<String, dynamic>> _childrenForPost(List<Map<String, dynamic>> children, Map<String, dynamic> post) {
  final type = post['audienceType']?.toString() ?? 'all';
  if (type == 'teachers') return const [];
  if (type != 'class' && type != 'level') return children;
  final ids = _audienceIds(post['audienceIds']).toSet();
  if (ids.isEmpty) return children;
  return children.where((child) {
    final klass = _classOf(child);
    if (klass == null) return false;
    final key = type == 'level' ? klass['levelId']?.toString() : klass['id']?.toString();
    return key != null && ids.contains(key);
  }).toList();
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

class _GroupedExtras extends StatelessWidget {
  final List<Map<String, dynamic>> children;
  final List<dynamic> plans;
  final List<dynamic> meetings;
  const _GroupedExtras({required this.children, required this.plans, required this.meetings});

  @override
  Widget build(BuildContext context) {
    final month = thematicMonthLabel(thematicMonthKey(DateTime.now()));
    final meetingRows = <MapEntry<Map<String, dynamic>, Map<String, dynamic>>>[];
    for (final child in children) {
      final meeting = acceptedMeetingFor(meetings, child['id']?.toString());
      if (meeting != null) meetingRows.add(MapEntry(child, meeting));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (meetingRows.isNotEmpty) ...[
          daySectionTitle(Icons.event_available_rounded, 'Επερχόμενη συνάντηση', dayHistoryColors),
          for (final row in meetingRows)
            _childLine(
              row.key,
              '${meetingDay(row.value['meetingDate'])} στις ${row.value['acceptedSlot'] ?? ''}',
            ),
        ],
        daySectionTitle(Icons.auto_stories_rounded, 'Διαθεματικό $month', dayHistoryColors),
        for (final child in children)
          _childLine(child, _thematicTitle(_thematicFor(plans, child))),
      ],
    );
  }

  String _thematicTitle(Map<String, dynamic>? thematic) {
    if (thematic == null) return 'Δεν έχει ανέβει ακόμα για αυτόν τον μήνα.';
    final title = thematic['title']?.toString().trim() ?? '';
    return title.isNotEmpty ? title : 'Διαθεματικό';
  }

  Widget _childLine(Map<String, dynamic> child, String value) {
    final mention = ChildMention.fromMap(child);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF0E6F4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (mention != null) ...[
            ChildMentions(people: [mention]),
            const SizedBox(height: 8),
          ],
          Text(value, style: const TextStyle(fontSize: 13, color: Color(0xFF374151))),
        ],
      ),
    );
  }
}

class _FoundNoticesHome extends ConsumerWidget {
  final String schoolId;
  const _FoundNoticesHome({required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notices = ref.watch(schoolPostsProvider((schoolId: schoolId, type: 'found', studentId: null)));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Ενημερώσεις',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF2C2422)),
                ),
              ),
              GestureDetector(
                onTap: () => _openAll(context),
                child: const Text('Όλες', style: TextStyle(fontSize: 13, color: Color(0xFF77328D), fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: notices.when(
            loading: () => const LinearProgressIndicator(color: Color(0xFF77328D)),
            error: (_, __) => const Text('Οι ενημερώσεις δεν φορτώθηκαν.', style: TextStyle(color: Color(0xFF6B7280))),
            data: (posts) {
              if (posts.isEmpty) {
                return const Text(
                  'Όταν βρεθεί κάτι στο σχολείο, η φωτογραφία και το μήνυμα της γραμματείας εμφανίζονται εδώ.',
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
                );
              }
              return Column(
                children: [
                  for (final raw in posts.take(3))
                    if (raw is Map)
                      _FoundNoticeCard(
                        post: Map<String, dynamic>.from(raw),
                        onTap: () => Navigator.push(context, MaterialPageRoute(
                          builder: (_) => SchoolPostScreen(schoolId: schoolId, postId: raw['id']?.toString() ?? ''),
                        )),
                      ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  void _openAll(BuildContext context) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => SchoolPostsScreen(schoolId: schoolId, title: 'Ενημερώσεις', noticeType: 'found'),
    ));
  }
}

class _FoundNoticeCard extends StatelessWidget {
  final Map<String, dynamic> post;
  final VoidCallback onTap;
  const _FoundNoticeCard({required this.post, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final title = post['title']?.toString() ?? 'Εύρημα';
    final content = post['content']?.toString() ?? '';
    final urls = post['mediaUrls'] is List ? (post['mediaUrls'] as List).map((item) => item.toString()).toList() : <String>[];
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: urls.isEmpty
                      ? const ColoredBox(
                          color: Color(0xFFFFF1EA),
                          child: SizedBox(width: 64, height: 64, child: Icon(Icons.checkroom_rounded, color: Color(0xFFE95926))),
                        )
                      : AppImage(urls.first, width: 64, height: 64, fit: BoxFit.cover),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                      if (content.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(content, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, height: 1.35, color: Color(0xFF6B7280))),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PostMini extends StatelessWidget {
  final Map<String, dynamic> post;
  final String schoolId;
  final List<Map<String, dynamic>> children;
  const _PostMini({required this.post, required this.schoolId, required this.children});

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
    final mentions = children.map(ChildMention.fromMap).whereType<ChildMention>().toList();

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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (mentions.isNotEmpty) ...[
              ChildMentions(people: mentions),
              const SizedBox(height: 10),
            ],
            Row(
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
