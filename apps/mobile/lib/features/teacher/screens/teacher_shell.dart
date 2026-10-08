import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/notifications/notification_center.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/app_top_bar.dart';
import 'teacher_home_screen.dart';
import 'teacher_events_screen.dart';
import 'messages_screen.dart';

class TeacherShell extends ConsumerStatefulWidget {
  final String? initialClassId;
  const TeacherShell({super.key, this.initialClassId});

  @override
  ConsumerState<TeacherShell> createState() => _TeacherShellState();
}

class _TeacherShellState extends ConsumerState<TeacherShell> {
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user!;
    final schoolId = user.schoolId ?? '';

    final pages = [
      TeacherHomeScreen(schoolId: schoolId),
      TeacherEventsScreen(schoolId: schoolId),
      InboxScreen(schoolId: schoolId, embedded: true),
      TeacherMessagesScreen(schoolId: schoolId, userId: user.id),
    ];
    final rawIndex = ref.watch(shellTabProvider);
    final index = rawIndex >= 0 && rawIndex < pages.length ? rawIndex : 0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: const Color(0xFFF0F4FF),
        extendBody: false,
        body: Stack(
          children: [
            IndexedStack(index: index, children: pages),
            NotificationWatcher(schoolId: schoolId),
          ],
        ),
        bottomNavigationBar: _FloatingNavBar(
          selectedIndex: index < 2 ? index : -1,
          onTap: (i) => ref.read(shellTabProvider.notifier).state = i,
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData? icon;
  final IconData? activeIcon;
  final String? asset;
  final String? activeAsset;
  final String label;
  const _NavItem({
    this.icon,
    this.activeIcon,
    this.asset,
    this.activeAsset,
    required this.label,
  });
}

class _FloatingNavBar extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _FloatingNavBar({required this.selectedIndex, required this.onTap});

  static const _items = [
    _NavItem(
      asset: 'assets/images/nav_home_owl.png',
      activeAsset: 'assets/images/nav_home_owl_active.png',
      label: 'Αρχική',
    ),
    _NavItem(icon: Icons.event_outlined, activeIcon: Icons.event_rounded, label: 'Εκδηλώσεις'),
  ];

  @override
  Widget build(BuildContext context) {
    final bottomInset = systemBottomInset(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, bottomInset + 16),
      child: Container(
        height: 70,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(36),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4F46E5).withOpacity(0.18),
              blurRadius: 32,
              offset: const Offset(0, 10),
            ),
            BoxShadow(
              color: Colors.black.withOpacity(0.07),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: _items.asMap().entries.map((e) {
            final i = e.key;
            final item = e.value;
            final selected = i == selectedIndex;
            return Expanded(
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onTap(i);
                },
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeInOut,
                  margin: EdgeInsets.symmetric(
                    horizontal: selected ? 4 : 6,
                    vertical: selected ? 8 : 10,
                  ),
                  decoration: selected
                      ? BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF4F46E5).withOpacity(0.35),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        )
                      : null,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _navGlyph(item, selected),
                      if (selected) ...[
                        const SizedBox(height: 2),
                        Text(
                          item.label,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

Widget _navGlyph(_NavItem item, bool selected) {
  final color = selected ? Colors.white : const Color(0xFFBBB8D4);
  final asset = selected ? item.activeAsset : item.asset;
  if (asset != null) {
    return ColorFiltered(
      key: ValueKey(selected),
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
      child: Image.asset(
        asset,
        height: 30,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
  return Icon(
    selected ? item.activeIcon : item.icon,
    key: ValueKey(selected),
    size: 22,
    color: color,
  );
}
