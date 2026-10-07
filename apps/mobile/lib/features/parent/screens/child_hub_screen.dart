import 'package:flutter/material.dart';
import 'bulletin_screen.dart';
import 'child_detail_screen.dart';
import 'parent_child_pages.dart';

class ChildHubScreen extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ChildHubScreen({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context) {
    final name = child['fullName'] as String? ?? 'Παιδί';
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    final className = enrollments.isNotEmpty ? (enrollments.first['class']?['name'] as String? ?? '') : '';

    final tiles = <_Tile>[
      _Tile('Ημερήσιο Δελτίο', Icons.menu_book_rounded, const Color(0xFF77328D), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => BulletinScreen(schoolId: schoolId, child: child)));
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
      _Tile('Κανονισμοί', Icons.gavel_rounded, const Color(0xFF642678), () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => RegulationsScreen(schoolId: schoolId)));
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            if (className.isNotEmpty)
              Text(className, style: const TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF77328D), Color(0xFFE95926)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text(
              'Ό,τι αφορά το παιδί σας: δελτίο ημέρας, φαγητό, σχολικό, οφειλές, δραστηριότητες και κανονισμοί.',
              style: TextStyle(color: Colors.white, height: 1.4),
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
