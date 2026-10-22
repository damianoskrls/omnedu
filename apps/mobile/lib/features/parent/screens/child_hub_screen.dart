import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/person_face.dart';
import '../../messages/conversation_ui.dart';
import '../../medications/medications_screen.dart';
import 'bulletin_screen.dart';
import 'school_posts_screen.dart';
import 'child_detail_screen.dart';
import 'bus_closure.dart';
import 'bus_map_screen.dart';
import 'parent_child_pages.dart';
import 'parent_meetings_screen.dart';
import 'thematic_screen.dart';
import 'assignments_screen.dart';

class ChildHubScreen extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ChildHubScreen({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context) {
    final name = child['fullName'] as String? ?? 'Παιδί';
    final photo = child['avatarUrl'] as String?;
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    Map<String, dynamic>? enrollment;
    for (final row in enrollments) {
      if (row is! Map) continue;
      final year = row['academicYear'];
      if (year is Map && year['isCurrent'] == true) {
        enrollment = Map<String, dynamic>.from(row);
        break;
      }
    }
    if (enrollment == null && enrollments.isNotEmpty && enrollments.first is Map) {
      enrollment = Map<String, dynamic>.from(enrollments.first as Map);
    }
    final klass = enrollment?['class'];
    final classMap = klass is Map ? Map<String, dynamic>.from(klass) : null;
    final className = classMap?['name']?.toString() ?? '';
    final classId = classMap?['id']?.toString() ?? '';
    final levelMap = classMap?['level'];
    final levelName = levelMap is Map ? levelMap['name']?.toString() ?? '' : '';
    final teachers = <_HeaderTeacher>[];
    final seenTeachers = <String>{};
    final teacherList = classMap?['teachers'];
    if (teacherList is List) {
      for (final teacher in teacherList) {
        if (teacher is! Map) continue;
        final user = teacher['user'];
        if (user is! Map) continue;
        final id = user['id']?.toString() ?? '';
        final teacherName = user['fullName']?.toString() ?? '';
        if (id.isEmpty || teacherName.isEmpty || !seenTeachers.add(id)) continue;
        teachers.add(_HeaderTeacher(id: id, name: teacherName, avatarUrl: user['avatarUrl']?.toString(), className: className));
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
      _Tile('Εργασίες', Icons.assignment_rounded, const Color(0xFF77328D), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ParentAssignmentsScreen(
              schoolId: schoolId,
              studentId: child['id']?.toString(),
              childName: name,
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

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      body: CustomScrollView(
        slivers: [
          SliverPersistentHeader(
            pinned: true,
            delegate: _ChildHeaderDelegate(
              schoolId: schoolId,
              name: name,
              photoUrl: photo,
              className: className,
              levelName: levelName,
              teachers: teachers,
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
          _BusWhereButton(schoolId: schoolId, child: child),
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
            mainAxisSpacing: 14,
            crossAxisSpacing: 14,
            childAspectRatio: 0.95,
            children: tiles.asMap().entries.map((e) => _AnimatedTileCard(tile: e.value, index: e.key)).toList(),
          ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _BusWhereButton extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const _BusWhereButton({required this.schoolId, required this.child});

  Map<String, dynamic>? _bus(Map<String, dynamic> data) {
    final services = data['studentServices'];
    if (services is! List) return null;
    for (final raw in services) {
      if (raw is! Map) continue;
      final row = Map<String, dynamic>.from(raw);
      final catalog = row['service'];
      final service = catalog is Map ? Map<String, dynamic>.from(catalog) : const <String, dynamic>{};
      final type = service['serviceType']?.toString() ?? '';
      final name = service['name']?.toString() ?? '';
      if (type == 'bus' || name.toLowerCase().contains('σχολ')) return row;
    }
    return null;
  }

  /// Returns true if [now] is within 60 minutes of [timeStr] (HH:mm).
  bool _nearRouteTime(DateTime now, String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return true; // no schedule → always show on weekdays
    final parts = timeStr.split(':');
    if (parts.length < 2) return true;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return true;
    final route = DateTime(now.year, now.month, now.day, h, m);
    return now.difference(route).abs().inMinutes <= 60;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id']?.toString() ?? '';
    final bus = _bus(child);
    if (bus == null) return const SizedBox.shrink();

    // Only show on weekdays
    final now = DateTime.now();
    if (now.weekday >= DateTime.saturday) return const SizedBox.shrink();

    // Only show within ±1 hour of pickup or dropoff time
    final stop = bus['stop'];
    final stopMap = stop is Map ? Map<String, dynamic>.from(stop) : const <String, dynamic>{};
    final pickupTime = stopMap['pickupTime']?.toString();
    final dropoffTime = stopMap['dropoffTime']?.toString();
    final nearRoute = _nearRouteTime(now, pickupTime) || _nearRouteTime(now, dropoffTime);
    if (!nearRoute) return const SizedBox.shrink();

    final closure = ref.watch(busClosureTodayProvider(schoolId)).asData?.value;
    if (closure != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: BusClosedCard(reason: closure['reason']?.toString() ?? ''),
      );
    }
    final catalog = bus['service'];
    final name = catalog is Map ? catalog['name']?.toString().trim() ?? '' : '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: const Color(0xFFE95926),
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => BusMapScreen(
                  schoolId: schoolId,
                  studentId: studentId,
                  busName: name.isEmpty ? 'Σχολικό' : name,
                ),
              ),
            );
          },
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(
              children: [
                Icon(Icons.directions_bus_rounded, color: Colors.white, size: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Δες πού είναι το σχολικό',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: Colors.white),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderTeacher {
  final String id;
  final String name;
  final String? avatarUrl;
  final String className;
  const _HeaderTeacher({required this.id, required this.name, required this.avatarUrl, required this.className});
}

class _ChildHeaderDelegate extends SliverPersistentHeaderDelegate {
  final String schoolId;
  final String name;
  final String? photoUrl;
  final String className;
  final String levelName;
  final List<_HeaderTeacher> teachers;

  const _ChildHeaderDelegate({
    required this.schoolId,
    required this.name,
    required this.photoUrl,
    required this.className,
    required this.levelName,
    required this.teachers,
  });

  @override
  double get minExtent => 64;

  @override
  double get maxExtent => teachers.isEmpty ? 196 : 248;

  @override
  bool shouldRebuild(covariant _ChildHeaderDelegate oldDelegate) {
    return oldDelegate.name != name || oldDelegate.photoUrl != photoUrl || oldDelegate.className != className || oldDelegate.levelName != levelName || oldDelegate.teachers.length != teachers.length;
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
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: IgnorePointer(
              ignoring: expandedOpacity < 0.2,
              child: Opacity(
                opacity: expandedOpacity,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(56, 4, 56, 10),
                  child: SizedBox(
                    width: double.infinity,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.center,
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
                        if (className.isNotEmpty)
                          Text('Τάξη $className', maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                        if (levelName.isNotEmpty)
                          Text('Βαθμίδα $levelName', maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFF3E8F7), fontWeight: FontWeight.w600, fontSize: 13)),
                        if (teachers.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              for (final teacher in teachers) _TeacherChip(schoolId: schoolId, teacher: teacher),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: IgnorePointer(
              ignoring: collapsedOpacity < 0.2,
              child: Opacity(
                opacity: collapsedOpacity,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 56),
                  child: Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
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
                        ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: (MediaQuery.sizeOf(context).width - 158).clamp(48.0, 2000.0)),
                          child: Text(
                            name.split(' ').first,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            child: Center(
              child: IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TeacherChip extends ConsumerWidget {
  final String schoolId;
  final _HeaderTeacher teacher;
  const _TeacherChip({required this.schoolId, required this.teacher});

  Future<void> _open(BuildContext context, WidgetRef ref) async {
    final parentId = ref.read(authProvider).user?.id;
    if (parentId == null) return;
    try {
      final created = await openScopedConversation(
        ref,
        schoolId: schoolId,
        kind: 'teacher',
        withUserId: teacher.id,
        participantIds: [parentId, teacher.id],
      );
      final id = created?['id'] as String?;
      if (id == null || !context.mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            schoolId: schoolId,
            convId: id,
            title: teacher.name,
            subtitle: teacher.className.isEmpty ? 'Εκπαιδευτικός' : 'Τάξη ${teacher.className}',
            currentUserId: parentId,
            startedByMe: conversationStartedByMe(created, parentId),
          ),
        ),
      );
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: Colors.white.withOpacity(0.18),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => _open(context, ref),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 10, 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              PersonFace(name: teacher.name, photoUrl: teacher.avatarUrl, size: 28, radius: 14, fontSize: 12, background: Colors.white, foreground: const Color(0xFF77328D)),
              const SizedBox(width: 6),
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width - 96),
                child: Text(teacher.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
              ),
            ],
          ),
        ),
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

class _AnimatedTileCard extends StatefulWidget {
  final _Tile tile;
  final int index;
  const _AnimatedTileCard({super.key, required this.tile, required this.index});

  @override
  State<_AnimatedTileCard> createState() => _AnimatedTileCardState();
}

class _AnimatedTileCardState extends State<_AnimatedTileCard>
    with TickerProviderStateMixin {
  late final AnimationController _tapCtrl;
  late final AnimationController _enterCtrl;
  bool _pressed = false;

  static final _iconBounce = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.78), weight: 35),
    TweenSequenceItem(tween: Tween(begin: 0.78, end: 1.14), weight: 35),
    TweenSequenceItem(tween: Tween(begin: 1.14, end: 1.0), weight: 30),
  ]);

  @override
  void initState() {
    super.initState();
    _tapCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 320));
    _enterCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
    Future.delayed(Duration(milliseconds: 55 * widget.index), () {
      if (mounted) _enterCtrl.forward();
    });
  }

  @override
  void dispose() {
    _tapCtrl.dispose();
    _enterCtrl.dispose();
    super.dispose();
  }

  void _handleTap() {
    _tapCtrl.forward(from: 0);
    widget.tile.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.tile.color;
    final enterCurve = CurvedAnimation(parent: _enterCtrl, curve: Curves.easeOutCubic);
    final iconAnim = _iconBounce.animate(CurvedAnimation(parent: _tapCtrl, curve: Curves.easeInOut));

    return FadeTransition(
      opacity: enterCurve,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.20), end: Offset.zero)
            .animate(enterCurve),
        child: GestureDetector(
          onTapDown: (_) => setState(() => _pressed = true),
          onTapUp: (_) {
            setState(() => _pressed = false);
            _handleTap();
          },
          onTapCancel: () => setState(() => _pressed = false),
          child: AnimatedScale(
            scale: _pressed ? 0.94 : 1.0,
            duration: const Duration(milliseconds: 120),
            curve: Curves.easeOut,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: color.withOpacity(0.13),
                    blurRadius: 18,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AnimatedBuilder(
                    animation: iconAnim,
                    builder: (ctx, child) => Transform.scale(
                      scale: _tapCtrl.isAnimating ? iconAnim.value : 1.0,
                      child: child,
                    ),
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            color.withOpacity(0.09),
                            color.withOpacity(0.20),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Icon(widget.tile.icon, color: color, size: 34),
                    ),
                  ),
                  const SizedBox(height: 11),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Text(
                      widget.tile.label,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14.5,
                        color: Color(0xFF111827),
                        height: 1.25,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
