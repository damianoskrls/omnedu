import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/person_face.dart';
import 'child_hub_screen.dart';
import 'parent_meetings_screen.dart';
import 'school_posts_screen.dart';
import 'thematic_screen.dart';

final myChildrenProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/students/my-children');
    final data = resp.data;
    return data is List ? data : [];
  },
);

final todayReportsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/daily-reports/feed', queryParameters: {'limit': 40});
  final data = resp.data;
  return data is List ? data : [];
});

final todayMenuProvider = FutureProvider.family<Map<String, dynamic>?, String>((ref, schoolId) async {
  final day = _dayKey(DateTime.now());
  final dio = ref.read(dioProvider);
  try {
    final resp = await dio.get('/schools/$schoolId/daily-menus', queryParameters: {'from': day, 'to': day});
    final data = resp.data;
    if (data is List && data.isNotEmpty && data.first is Map) {
      return Map<String, dynamic>.from(data.first as Map);
    }
  } catch (_) {}
  return null;
});

String _dayKey(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

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
    final reportsAsync = ref.watch(todayReportsProvider(schoolId));
    final menuAsync = ref.watch(todayMenuProvider(schoolId));
    final postsAsync = ref.watch(_recentPostsProvider(schoolId));
    final thematicAsync = ref.watch(monthThematicProvider(schoolId));
    final meetingsAsync = ref.watch(parentMeetingsProvider(schoolId));
    final user = ref.watch(authProvider).user;
    final firstName = user?.fullName.split(' ').first ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myChildrenProvider(schoolId));
          ref.invalidate(todayReportsProvider(schoolId));
          ref.invalidate(todayMenuProvider(schoolId));
          ref.invalidate(_recentPostsProvider(schoolId));
          ref.invalidate(monthThematicProvider(schoolId));
          ref.invalidate(parentMeetingsProvider(schoolId));
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
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Text(
                  'Σήμερα, ${_dayKey(DateTime.now()).split('-').reversed.join('/')}',
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF2C2422)),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: childrenAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text('Σφάλμα: $e', style: const TextStyle(color: Colors.red)),
                ),
                data: (children) {
                  if (children.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 20),
                      child: Text('Δεν βρέθηκαν παιδιά.', style: TextStyle(color: Color(0xFF9CA3AF))),
                    );
                  }
                  final reports = reportsAsync.asData?.value ?? const [];
                  final menu = menuAsync.asData?.value;
                  final plans = thematicAsync.asData?.value ?? const [];
                  final meetings = meetingsAsync.asData?.value ?? const [];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: children.map((raw) {
                        final child = Map<String, dynamic>.from(raw as Map);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _TodayChildCard(
                            child: child,
                            report: _reportFor(reports, child['id']?.toString(), _dayKey(DateTime.now())),
                            menu: menu,
                            thematic: _thematicFor(plans, child),
                            meeting: acceptedMeetingFor(meetings, child['id']?.toString()),
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ChildHubScreen(schoolId: schoolId, child: child),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
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

Map<String, dynamic>? _reportFor(List<dynamic> reports, String? studentId, String day) {
  for (final raw in reports) {
    if (raw is! Map) continue;
    final report = Map<String, dynamic>.from(raw);
    final student = report['student'];
    final id = student is Map ? student['id']?.toString() : null;
    final date = report['reportDate']?.toString() ?? '';
    if (id == studentId && date.startsWith(day)) return report;
  }
  return null;
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

class _TodayChildCard extends StatelessWidget {
  final Map<String, dynamic> child;
  final Map<String, dynamic>? report;
  final Map<String, dynamic>? menu;
  final Map<String, dynamic>? thematic;
  final Map<String, dynamic>? meeting;
  final VoidCallback onTap;
  const _TodayChildCard({required this.child, required this.report, required this.menu, required this.thematic, required this.meeting, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final name = child['fullName']?.toString() ?? '';
    final photo = child['avatarUrl']?.toString();
    final enrollments = child['enrollments'] as List? ?? [];
    final klass = enrollments.isNotEmpty && enrollments.first is Map ? enrollments.first['class'] : null;
    final className = klass is Map ? klass['name']?.toString() ?? '' : '';
    final bulletin = _bulletinLines(report);
    final meals = _mealLines(report, menu);
    final events = _eventLines(child);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  PersonFace(name: name, photoUrl: photo, size: 52, radius: 16, fontSize: 18, background: const Color(0xFF77328D), foreground: Colors.white),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF2C2422))),
                        if (className.isNotEmpty)
                          Text(className, style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Color(0xFFD1D5DB)),
                ],
              ),
              const SizedBox(height: 12),
              _LineBlock(title: 'Ενημέρωση', lines: bulletin.isEmpty ? const ['Δεν έχει ανέβει δελτίο σήμερα.'] : bulletin),
              _LineBlock(title: 'Τι έφαγε', lines: meals.isEmpty ? const ['Δεν έχει καταχωρηθεί φαγητό για σήμερα.'] : meals),
              if (events.isNotEmpty) _LineBlock(title: 'Εκδηλώσεις', lines: events),
              if (meeting != null)
                _LineBlock(
                  title: 'Επερχόμενη συνάντηση',
                  lines: [
                    '${meetingDay(meeting!['meetingDate'])} στις ${meeting!['acceptedSlot'] ?? ''}',
                  ],
                ),
              _LineBlock(
                title: 'Διαθεματικό ${thematicMonthLabel(thematicMonthKey(DateTime.now()))}',
                lines: [
                  thematic == null
                      ? 'Δεν έχει ανέβει ακόμα για αυτόν τον μήνα.'
                      : (thematic!['title']?.toString().trim().isNotEmpty == true
                          ? thematic!['title'].toString()
                          : 'Διαθεματικό'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<String> _bulletinLines(Map<String, dynamic>? report) {
    if (report == null) return [];
    final lines = <String>[];
    final mood = report['mood']?.toString() ?? '';
    final notes = report['notes']?.toString() ?? '';
    if (mood.isNotEmpty) lines.add('Διάθεση: $mood');
    if (notes.isNotEmpty) lines.add(notes);
    final nap = report['napDurationMinutes'];
    if (nap is num && nap > 0) lines.add('Ύπνος: ${nap.toInt()} λεπτά');
    return lines;
  }

  List<String> _mealLines(Map<String, dynamic>? report, Map<String, dynamic>? menu) {
    final lines = <String>[];
    void add(String label, dynamic value) {
      final text = value?.toString().trim() ?? '';
      if (text.isNotEmpty) lines.add('$label: $text');
    }
    add('Πρωινό', report?['mealBreakfast']);
    add('Μεσημεριανό', report?['mealLunch']);
    add('Σνακ', report?['mealSnack']);
    if (lines.isNotEmpty) return lines;
    add('Πρωινό', menu?['breakfast']);
    add('Δεκατιανό', menu?['midMorning']);
    add('Μεσημεριανό', menu?['lunch']);
    add('Απογευματινό', menu?['afternoon']);
    return lines;
  }

  List<String> _eventLines(Map<String, dynamic> child) {
    final lines = <String>[];
    final events = child['eventEnrollments'] as List? ?? [];
    final today = DateTime.now();
    for (final raw in events) {
      if (raw is! Map) continue;
      final event = raw['event'];
      if (event is! Map) continue;
      final title = event['title']?.toString() ?? '';
      final when = event['eventDate']?.toString();
      if (title.isEmpty) continue;
      if (when != null && when.isNotEmpty) {
        final date = DateTime.tryParse(when);
        if (date != null && date.isBefore(DateTime(today.year, today.month, today.day))) continue;
        lines.add(date == null ? title : '$title · ${date.day}/${date.month}');
      } else {
        lines.add(title);
      }
      if (lines.length == 3) break;
    }
    final activities = child['activityRegistrations'] as List? ?? [];
    for (final raw in activities) {
      if (lines.length == 3) break;
      if (raw is! Map) continue;
      final activity = raw['activity'];
      if (activity is! Map) continue;
      final title = activity['title']?.toString() ?? '';
      if (title.isNotEmpty) lines.add(title);
    }
    return lines;
  }
}

class _LineBlock extends StatelessWidget {
  final String title;
  final List<String> lines;
  const _LineBlock({required this.title, required this.lines});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
          const SizedBox(height: 2),
          ...lines.map((line) => Text(line, style: const TextStyle(fontSize: 13, height: 1.35, color: Color(0xFF374151)))),
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
