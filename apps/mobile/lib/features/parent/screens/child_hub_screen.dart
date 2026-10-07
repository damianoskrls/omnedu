import 'package:flutter/material.dart';
import '../../../core/widgets/person_face.dart';
import 'bulletin_screen.dart';
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

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        title: const Text('Παιδί'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              children: [
                PersonFace(
                  name: name,
                  photoUrl: photo,
                  size: 84,
                  radius: 28,
                  fontSize: 28,
                  background: const Color(0xFF77328D),
                  foreground: Colors.white,
                ),
                const SizedBox(height: 12),
                Text(name, textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
                if (className.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(className, style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
                ],
                if (teachers.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(teachers.join(', '), textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF6B7280))),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
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
