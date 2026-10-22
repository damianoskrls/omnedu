import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/app_top_bar.dart';
import '../../../core/widgets/person_face.dart';
import '../parent_children.dart';
import 'billing_screen.dart';
import 'bus_closure.dart';
import 'party_invitation_screen.dart';
import 'child_hub_screen.dart';
import 'day_history.dart';
import 'parent_meetings_screen.dart';
import 'school_posts_screen.dart';
import 'teacher_absences_screen.dart';
import 'thematic_screen.dart';

final _receivedInvitationsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    try {
      final resp = await dio.get('/schools/$schoolId/party-invitations/received');
      final data = resp.data;
      if (data is! List) return [];
      final now = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);
      return data.where((row) {
        if (row is! Map) return false;
        final eventDateStr = row['eventDate']?.toString();
        if (eventDateStr == null || eventDateStr.isEmpty) return true;
        final eventDate = DateTime.tryParse(eventDateStr);
        if (eventDate == null) return true;
        final eventDay = DateTime(eventDate.year, eventDate.month, eventDate.day);
        return !eventDay.isBefore(now);
      }).toList();
    } catch (_) {
      return [];
    }
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

// Returns the most recent school day on or before [from] (Mon–Fri).
DateTime _prevSchoolDay(DateTime from) {
  var d = from;
  while (d.weekday == DateTime.saturday || d.weekday == DateTime.sunday) {
    d = d.subtract(const Duration(days: 1));
  }
  return d;
}

final _recentPostsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    try {
      final resp = await dio.get('/schools/$schoolId/posts');
      final data = resp.data;
      if (data is! List) return [];
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      // Show last 2 school days (skipping weekends).
      final day1 = _prevSchoolDay(today);
      final day2 = _prevSchoolDay(day1.subtract(const Duration(days: 1)));
      const _celebTypes = {'birthday', 'nameday', 'celebration'};
      return data.where((row) {
        if (row is! Map) return false;
        final t = row['postType']?.toString() ?? '';
        if (t == 'found') return false;
        final dt = DateTime.tryParse(row['publishedAt']?.toString() ?? '');
        if (dt == null) return false;
        final postDay = DateTime(dt.year, dt.month, dt.day);
        // Birthday/nameday/celebration: only same day.
        if (_celebTypes.contains(t)) return !postDay.isBefore(today);
        // All other posts: only from the last 2 school days.
        return !postDay.isBefore(day2);
      }).take(3).toList();
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
    final chargesAsync = ref.watch(myChargesProvider(schoolId));
    final invitationsAsync = ref.watch(_receivedInvitationsProvider(schoolId));
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
          ref.invalidate(myChargesProvider(schoolId));
          ref.invalidate(_receivedInvitationsProvider(schoolId));
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
                  final invitations = (invitationsAsync.asData?.value ?? const [])
                      .whereType<Map>()
                      .map((row) => Map<String, dynamic>.from(row))
                      .toList();
                  final posts = (postsAsync.asData?.value ?? const [])
                      .whereType<Map>()
                      .map((row) => Map<String, dynamic>.from(row))
                      .toList();
                  final _now = DateTime.now();
                  final isWeekend = _now.weekday == DateTime.saturday || _now.weekday == DateTime.sunday;
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
                      _UpcomingMeetings(children: cards, meetings: meetings, schoolId: schoolId),
                      _UpcomingPartyInvitations(schoolId: schoolId, invitations: invitations),
                      if (!isWeekend) ...[
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
                      ],
                      daySectionTitle(Icons.history_rounded, 'Πρόσφατες Ενημερώσεις', dayHistoryColors),
                      for (final child in cards)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                          child: ChildRecentUpdates(schoolId: schoolId, child: child, latestOnly: true),
                        ),
                      _FoundNoticesHome(schoolId: schoolId, embedded: true),
                      if (cards.any(childHasInstructions)) ...[
                        daySectionTitle(Icons.assignment_rounded, 'Οδηγίες από το Σχολείο', dayHistoryColors),
                        for (final child in cards) ChildInstructionCards(child: child),
                      ],
                      if (cards.any(childHasEvents) || posts.isNotEmpty) ...[
                        daySectionTitle(
                          Icons.event_rounded,
                          'Εκδηλώσεις',
                          dayHistoryColors,
                          badge: () {
                            final pending = cards.fold<int>(0, (sum, child) => sum + childPendingEvents(child));
                            return pending > 0 ? '$pending εκκρεμεί' : null;
                          }(),
                        ),
                        for (final child in cards)
                          if (childHasEvents(child))
                            ChildEventCards(schoolId: schoolId, child: child, maxItems: 1),
                        if (cards.any(childHasEvents))
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                            child: SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: () => ref.read(shellTabProvider.notifier).state = 2,
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF77328D),
                                  side: const BorderSide(color: Color(0xFF77328D)),
                                  minimumSize: const Size.fromHeight(44),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                                child: const Text('Εμφάνιση όλων', style: TextStyle(fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ),
                        if (posts.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                            child: Column(
                              children: [
                                for (final post in posts)
                                  _PostMini(
                                    post: post,
                                    schoolId: schoolId,
                                    children: _childrenForPost(cards, post),
                                  ),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(
                                    onPressed: () => Navigator.push(context, MaterialPageRoute(
                                      builder: (_) => SchoolPostsScreen(schoolId: schoolId),
                                    )),
                                    child: const Text('Όλα τα νέα', style: TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                      _FinancialPendingSection(charges: chargesAsync.asData?.value ?? const []),
                      _GroupedExtras(schoolId: schoolId, children: cards, plans: plans),
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

class _UpcomingMeetings extends StatelessWidget {
  final List<Map<String, dynamic>> children;
  final List<dynamic> meetings;
  final String schoolId;
  const _UpcomingMeetings({required this.children, required this.meetings, required this.schoolId});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final rows = <MapEntry<Map<String, dynamic>, Map<String, dynamic>>>[];
    for (final child in children) {
      final meeting = acceptedMeetingFor(meetings, child['id']?.toString());
      if (meeting != null) {
        final dateStr = meeting['meetingDate'] as String? ?? '';
        final date = DateTime.tryParse(dateStr);
        if (date != null && !date.isBefore(today)) {
          rows.add(MapEntry(child, meeting));
        }
      }
    }
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        daySectionTitle(Icons.event_available_rounded, 'Επερχόμενη συνάντηση', dayHistoryColors),
        for (final row in rows)
          GestureDetector(
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => ParentMeetingsScreen(
                schoolId: schoolId,
                classId: '',
                className: '',
                studentId: row.key['id']?.toString() ?? '',
                studentName: row.key['fullName']?.toString() ?? '',
              ),
            )),
            child: _HomeChildLine(
              row.key,
              '${meetingDay(row.value['meetingDate'])} στις ${row.value['acceptedSlot'] ?? ''}',
              trailing: const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF9CA3AF)),
            ),
          ),
      ],
    );
  }
}

class _UpcomingPartyInvitations extends StatelessWidget {
  final String schoolId;
  final List<Map<String, dynamic>> invitations;
  const _UpcomingPartyInvitations({required this.schoolId, required this.invitations});

  @override
  Widget build(BuildContext context) {
    if (invitations.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        daySectionTitle(Icons.cake_rounded, 'Προσκλήσεις Πάρτυ', dayHistoryColors),
        for (final inv in invitations.take(3))
          GestureDetector(
            onTap: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => PartyInvitationScreen(
                schoolId: schoolId,
                invitationId: inv['id']?.toString() ?? '',
              ),
            )),
            child: Container(
              margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFCE7F3)),
                boxShadow: [BoxShadow(color: const Color(0xFFDB2777).withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2))],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFDF2F8),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text('🎂', style: TextStyle(fontSize: 18)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          inv['title']?.toString() ?? 'Πρόσκληση Πάρτυ',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
                        ),
                        if ((inv['eventDate']?.toString() ?? '').isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            '📅 ${inv['eventDate']}',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFFDB2777)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _GroupedExtras extends StatelessWidget {
  final String schoolId;
  final List<Map<String, dynamic>> children;
  final List<dynamic> plans;
  const _GroupedExtras({required this.schoolId, required this.children, required this.plans});

  @override
  Widget build(BuildContext context) {
    final month = thematicMonthLabel(thematicMonthKey(DateTime.now()));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        daySectionTitle(Icons.auto_stories_rounded, 'Διαθεματικό $month', dayHistoryColors),
        for (final child in children) Builder(builder: (ctx) {
          final plan = _thematicFor(plans, child);
          final enrollments = child['enrollments'] as List? ?? [];
          final klass = enrollments.isNotEmpty && enrollments.first is Map ? enrollments.first['class'] : null;
          final classId = klass is Map ? klass['id']?.toString() ?? '' : '';
          final className = klass is Map ? klass['name']?.toString() ?? '' : '';
          final intro = (plan?['introduction'] as String? ?? '').trim();
          final snippet = intro.length > 90 ? '${intro.substring(0, 90)}…' : intro;
          return _HomeChildLine(
            child,
            _thematicTitle(plan),
            subtitle: plan != null && snippet.isNotEmpty ? snippet : null,
            onTap: plan != null && classId.isNotEmpty
                ? () => Navigator.push(ctx, MaterialPageRoute(
                    builder: (_) => ParentThematicScreen(
                      schoolId: schoolId,
                      classId: classId,
                      className: className,
                      initialMonth: plan['month']?.toString(),
                    ),
                  ))
                : null,
          );
        }),
      ],
    );
  }

  String _thematicTitle(Map<String, dynamic>? thematic) {
    if (thematic == null) return 'Δεν έχει ανέβει ακόμα για αυτόν τον μήνα.';
    final title = thematic['title']?.toString().trim() ?? '';
    return title.isNotEmpty ? title : 'Διαθεματικό';
  }
}

class _HomeChildLine extends StatelessWidget {
  final Map<String, dynamic> child;
  final String value;
  final Widget? trailing;
  final VoidCallback? onTap;
  final String? subtitle;
  const _HomeChildLine(this.child, this.value, {this.trailing, this.onTap, this.subtitle});

  @override
  Widget build(BuildContext context) {
    final mention = ChildMention.fromMap(child);
    final card = Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF0E6F4)),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (mention != null) ...[
                        ChildMentions(people: [mention]),
                        const SizedBox(height: 8),
                      ],
                      Text(value, style: const TextStyle(fontSize: 13, color: Color(0xFF374151))),
                      if (subtitle != null) ...[
                        const SizedBox(height: 4),
                        Text(subtitle!, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), height: 1.4)),
                        const SizedBox(height: 2),
                        const Text('Δείτε περισσότερα', style: TextStyle(fontSize: 12, color: Color(0xFF77328D), fontWeight: FontWeight.w600)),
                      ],
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
                if (onTap != null) const Icon(Icons.chevron_right, color: Color(0xFF77328D), size: 18),
              ],
            ),
          ),
        ),
      ),
    );
    return card;
  }
}

class _FoundNoticesHome extends ConsumerWidget {
  final String schoolId;
  final bool embedded;
  const _FoundNoticesHome({required this.schoolId, this.embedded = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notices = ref.watch(schoolPostsProvider((schoolId: schoolId, type: 'found', studentId: null)));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!embedded)
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
                if (embedded) return const SizedBox.shrink();
                return const Text(
                  'Όταν βρεθεί κάτι στο σχολείο, η φωτογραφία και το μήνυμα της γραμματείας εμφανίζονται εδώ.',
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
                );
              }
              return Column(
                children: [
                  if (embedded)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => _openAll(context),
                        child: const Text('Όλες οι ενημερώσεις', style: TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
                      ),
                    ),
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

// ── Οικονομικές Εκκρεμότητες ──────────────────────────────────────────────

enum _FinancialItemType { event, monthly }

class _FinancialItem {
  final String childName;
  final String label;
  final double amount;
  final _FinancialItemType type;
  // Extra detail fields for the bottom sheet
  final String? eventDate;
  final String? description;
  final int? billingMonth;
  final int? billingYear;

  const _FinancialItem({
    required this.childName,
    required this.label,
    required this.amount,
    required this.type,
    this.eventDate,
    this.description,
    this.billingMonth,
    this.billingYear,
  });
}

class _FinancialPendingSection extends StatelessWidget {
  final List<dynamic> charges;
  const _FinancialPendingSection({required this.charges});

  static const _months = [
    '', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
    'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
  ];
  static const _shortMonths = [
    '', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν',
    'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ',
  ];
  static String _shortMonthName(int m) => (m >= 1 && m <= 12) ? _shortMonths[m] : '';

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final items = <_FinancialItem>[];

    for (final entry in charges) {
      if (entry is! Map) continue;
      final student = entry['student'] as Map? ?? {};
      final name = student['fullName'] as String? ?? '';

      // Pending event payments
      final events = entry['events'] as List? ?? [];
      for (final ev in events) {
        if (ev is! Map) continue;
        if (ev['status'] != 'pending_payment') continue;
        final event = ev['event'] as Map? ?? {};
        final cost = double.tryParse(event['costPerChild']?.toString() ?? '0') ?? 0;
        if (cost <= 0) continue;
        final title = event['title'] as String? ?? 'Εκδήλωση';
        items.add(_FinancialItem(
          childName: name,
          label: title,
          amount: cost,
          type: _FinancialItemType.event,
          eventDate: event['eventDate'] as String?,
          description: event['description'] as String?,
        ));
      }

      // Overdue monthly fee: only from the 10th of the month onward
      if (now.day >= 10) {
        final monthly = entry['monthly'] as List? ?? [];
        for (final m in monthly) {
          if (m is! Map) continue;
          final year = m['year'] as int? ?? 0;
          final month = m['month'] as int? ?? 0;
          if (year != now.year || month != now.month) continue;
          final totalDue = double.tryParse(m['totalDue']?.toString() ?? '0') ?? 0;
          final paidAmount = double.tryParse(m['paidAmount']?.toString() ?? '0') ?? 0;
          final owed = totalDue - paidAmount;
          if (owed > 0.01) {
            items.add(_FinancialItem(
              childName: name,
              label: 'Δίδακτρα ${_shortMonthName(month)}',
              amount: owed,
              type: _FinancialItemType.monthly,
              billingMonth: month,
              billingYear: year,
            ));
          }
        }
      }
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        daySectionTitle(Icons.account_balance_wallet_rounded, 'Οικονομικές Εκκρεμότητες', dayHistoryColors),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Column(
            children: items
                .map((item) => _FinancialItemTile(
                      item: item,
                      fullMonths: _months,
                    ))
                .toList(),
          ),
        ),
      ],
    );
  }
}

class _FinancialItemTile extends StatelessWidget {
  final _FinancialItem item;
  final List<String> fullMonths;
  const _FinancialItemTile({super.key, required this.item, required this.fullMonths});

  String _formatDate(String? raw) {
    if (raw == null) return '';
    final d = DateTime.tryParse(raw);
    if (d == null) return '';
    return '${d.day} ${(d.month >= 1 && d.month <= 12) ? fullMonths[d.month] : ''} ${d.year}';
  }

  void _showDetail(BuildContext context) {
    final isEvent = item.type == _FinancialItemType.event;
    final dateStr = isEvent ? _formatDate(item.eventDate) : '';
    final monthLabel = (!isEvent && item.billingMonth != null && item.billingMonth! >= 1 && item.billingMonth! <= 12)
        ? '${fullMonths[item.billingMonth!]} ${item.billingYear ?? ''}'
        : '';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            // Title row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isEvent ? Icons.event_rounded : Icons.calendar_month_rounded,
                    size: 22,
                    color: const Color(0xFFDC2626),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    item.label,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            const SizedBox(height: 16),
            // Detail rows
            _DetailRow(icon: Icons.person_outline_rounded, label: 'Παιδί', value: item.childName),
            if (isEvent && dateStr.isNotEmpty)
              _DetailRow(icon: Icons.calendar_today_outlined, label: 'Ημερομηνία', value: dateStr),
            if (!isEvent && monthLabel.isNotEmpty)
              _DetailRow(icon: Icons.calendar_month_outlined, label: 'Περίοδος', value: monthLabel),
            if (isEvent && item.description != null && item.description!.isNotEmpty)
              _DetailRow(icon: Icons.info_outline_rounded, label: 'Περιγραφή', value: item.description!),
            const SizedBox(height: 8),
            // Amount
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Column(
                children: [
                  const Text('Εκκρεμεί πληρωμή', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 4),
                  Text(
                    '€${item.amount.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF6B7280),
                  side: const BorderSide(color: Color(0xFFE5E7EB)),
                  minimumSize: const Size.fromHeight(44),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Κλείσιμο'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEvent = item.type == _FinancialItemType.event;
    return GestureDetector(
      onTap: () => _showDetail(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFECACA)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFDC2626).withOpacity(0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isEvent ? Icons.event_rounded : Icons.calendar_month_rounded,
                size: 18,
                color: const Color(0xFFDC2626),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
                  ),
                  if (item.childName.isNotEmpty)
                    Text(item.childName, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                ],
              ),
            ),
            Text(
              '€${item.amount.toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFFDC2626)),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFFD1D5DB)),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _DetailRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF9CA3AF)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 13, color: Color(0xFF374151), fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
