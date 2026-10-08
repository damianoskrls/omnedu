import 'package:flutter/material.dart';
import '../../../core/widgets/person_face.dart';
import '../../medications/medications_screen.dart';
import 'bulletin_screen.dart';
import 'school_posts_screen.dart';
import 'child_detail_screen.dart';
import 'parent_child_pages.dart';
import 'parent_meetings_screen.dart';
import 'thematic_screen.dart';

class ChildHubScreen extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ChildHubScreen({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context) {
    final name = child['fullName'] as String? ?? 'Παιδί';
    final photo = child['avatarUrl'] as String?;
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    final klass = enrollments.isNotEmpty ? enrollments.first['class'] : null;
    final className = klass is Map ? (klass['name'] as String? ?? '') : '';
    final classId = klass is Map ? (klass['id'] as String? ?? '') : '';
    final teachers = <String>[];
    if (klass is Map) {
      final list = klass['teachers'] as List? ?? [];
      for (final teacher in list) {
        if (teacher is! Map) continue;
        final user = teacher['user'];
        final teacherName = user is Map ? user['fullName']?.toString() ?? '' : '';
        if (teacherName.isNotEmpty && !teachers.contains(teacherName)) teachers.add(teacherName);
      }
    }

    final tiles = <_Tile>[
      _Tile('Ημερήσιο Δελτίο', Icons.menu_book_rounded, const Color(0xFF77328D), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => BulletinScreen(schoolId: schoolId, child: child)));
      }),
      _Tile('Στιγμές', Icons.photo_camera_rounded, const Color(0xFFBE185D), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SchoolPostsScreen(
              schoolId: schoolId,
              studentId: child['id']?.toString(),
              title: 'Στιγμές',
            ),
          ),
        );
      }),
      _Tile('Συναντήσεις', Icons.event_available_rounded, const Color(0xFF0F766E), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ParentMeetingsScreen(
              schoolId: schoolId,
              classId: classId,
              className: className,
              studentId: child['id']?.toString() ?? '',
              studentName: name,
            ),
          ),
        );
      }),
      _Tile('Διαθεματικό', Icons.auto_stories_rounded, const Color(0xFF642678), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ParentThematicScreen(schoolId: schoolId, classId: classId, className: className),
          ),
        );
      }),
      _Tile('Φαγητό', Icons.restaurant_rounded, const Color(0xFFE95926), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => MealsScreen(schoolId: schoolId, childName: name)));
      }),
      _Tile('Οφειλές & πληρωμές', Icons.account_balance_wallet_rounded, const Color(0xFFB45309), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => ChildBillingScreen(schoolId: schoolId, child: child)));
      }),
      _Tile('Δραστηριότητες', Icons.palette_rounded, const Color(0xFF0F766E), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => ChildActivitiesScreen(schoolId: schoolId, child: child)));
      }),
      _Tile('Εκδρομές', Icons.hiking_rounded, const Color(0xFFE95926), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => ChildEventsScreen(schoolId: schoolId, child: child)));
      }),
      _Tile('Φάρμακα', Icons.medication_rounded, const Color(0xFFBE185D), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => MedicationsScreen(schoolId: schoolId, forParent: true, studentId: child['id']?.toString()),
          ),
        );
      }),
      _Tile('Ερωτηματολόγια', Icons.fact_check_rounded, const Color(0xFF1D4ED8), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => QuestionnairesScreen(schoolId: schoolId, child: child)));
      }),
      _Tile('Παροχές & σχολικό', Icons.directions_bus_rounded, const Color(0xFF0369A1), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => ServicesScreen(schoolId: schoolId, child: child)));
      }),
      _Tile('Εκπαιδευτικοί', Icons.groups_rounded, const Color(0xFF77328D), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => TeachersScreen(schoolId: schoolId, child: child)));
      }),
      _Tile('Ειδοποιήσεις', Icons.notifications_rounded, const Color(0xFFDB2777), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => AlertsScreen(schoolId: schoolId)));
      }),
      _Tile('Ιστορικό ημέρας', Icons.history_rounded, const Color(0xFF475569), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => ChildDetailScreen(child: child)));
      }),
    ];

    final teacherLine = teachers.isEmpty ? '' : 'Εκπαιδευτικός ${teachers.join(', ')}';
    final classLine = className.isEmpty ? '' : 'Τάξη $className';

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      body: CustomScrollView(
        slivers: [
          SliverPersistentHeader(
            pinned: true,
            delegate: _ChildHeaderDelegate(
              name: name,
              photoUrl: photo,
              classLine: classLine,
              teacherLine: teacherLine,
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => RegulationsScreen(schoolId: schoolId)));
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3E8F7),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.gavel_rounded, color: Color(0xFF642678)),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Κανονισμοί', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF2C2422))),
                          SizedBox(height: 2),
                          Text('Λειτουργίας και οικονομικός, για αυτό το σχολικό έτος', style: TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: Color(0xFF77328D)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.35,
            children: tiles.map((t) => _TileCard(tile: t)).toList(),
          ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChildHeaderDelegate extends SliverPersistentHeaderDelegate {
  final String name;
  final String? photoUrl;
  final String classLine;
  final String teacherLine;

  const _ChildHeaderDelegate({
    required this.name,
    required this.photoUrl,
    required this.classLine,
    required this.teacherLine,
  });

  @override
  double get minExtent => 64;

  @override
  double get maxExtent => 188;

  @override
  bool shouldRebuild(covariant _ChildHeaderDelegate oldDelegate) {
    return oldDelegate.name != name || oldDelegate.photoUrl != photoUrl || oldDelegate.classLine != classLine || oldDelegate.teacherLine != teacherLine;
  }

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final span = maxExtent - minExtent;
    final t = span <= 0 ? 1.0 : (shrinkOffset / span).clamp(0.0, 1.0);
    final expandedOpacity = (1 - t * 1.6).clamp(0.0, 1.0);
    final collapsedOpacity = ((t - 0.35) / 0.65).clamp(0.0, 1.0);

    return ColoredBox(
      color: const Color(0xFF77328D),
      child: Stack(
        children: [
          IgnorePointer(
            ignoring: expandedOpacity < 0.2,
            child: Opacity(
            opacity: expandedOpacity,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(56, 8, 16, 10),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  PersonFace(
                    name: name,
                    photoUrl: photoUrl,
                    size: 64,
                    radius: 22,
                    fontSize: 22,
                    background: Colors.white,
                    foreground: const Color(0xFF77328D),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  if (classLine.isNotEmpty)
                    Text(classLine, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                  if (teacherLine.isNotEmpty)
                    Text(teacherLine, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFF3E8F7), fontSize: 13)),
                ],
              ),
            ),
          ),
          ),
          IgnorePointer(
            ignoring: collapsedOpacity < 0.2,
            child: Opacity(
            opacity: collapsedOpacity,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(left: 52, right: 16),
                child: Row(
                  children: [
                    PersonFace(
                      name: name,
                      photoUrl: photoUrl,
                      size: 36,
                      radius: 12,
                      fontSize: 14,
                      background: Colors.white,
                      foreground: const Color(0xFF77328D),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
            ),
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _Tile(this.label, this.icon, this.color, this.onTap);
}

class _TileCard extends StatelessWidget {
  final _Tile tile;
  const _TileCard({required this.tile});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: tile.onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(tile.icon, color: tile.color),
              const Spacer(),
              Text(tile.label, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF1F2937))),
            ],
          ),
        ),
      ),
    );
  }
}
