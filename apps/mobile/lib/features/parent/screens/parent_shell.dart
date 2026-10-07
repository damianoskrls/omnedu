import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/auth_provider.dart';
import 'home_screen.dart';
import 'diary_feed_screen.dart';
import 'activities_screen.dart';
import 'events_screen.dart';
import 'billing_screen.dart';
import 'parent_messages_screen.dart';

class ParentShell extends ConsumerStatefulWidget {
  const ParentShell({super.key});

  @override
  ConsumerState<ParentShell> createState() => _ParentShellState();
}

class _ParentShellState extends ConsumerState<ParentShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user!;
    final schoolId = user.schoolId ?? '';

    final pages = [
      HomeScreen(schoolId: schoolId),
      DiaryFeedScreen(schoolId: schoolId, parentId: user.id),
      ActivitiesScreen(schoolId: schoolId),
      ParentEventsScreen(schoolId: schoolId),
      BillingScreen(schoolId: schoolId),
      ParentMessagesScreen(schoolId: schoolId, userId: user.id),
    ];

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F3FA),
        extendBody: true,
        body: IndexedStack(index: _index, children: pages),
        bottomNavigationBar: _FloatingNavBar(
          selectedIndex: _index,
          onTap: (i) => setState(() => _index = i),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem({required this.icon, required this.activeIcon, required this.label});
}

class _FloatingNavBar extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _FloatingNavBar({required this.selectedIndex, required this.onTap});

  static const _items = [
    _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'Αρχική'),
    _NavItem(icon: Icons.menu_book_outlined, activeIcon: Icons.menu_book_rounded, label: 'Ημερολόγιο'),
    _NavItem(icon: Icons.sports_soccer_outlined, activeIcon: Icons.sports_soccer_rounded, label: 'Δραστηριότητες'),
    _NavItem(icon: Icons.event_outlined, activeIcon: Icons.event_rounded, label: 'Εκδηλώσεις'),
    _NavItem(icon: Icons.account_balance_wallet_outlined, activeIcon: Icons.account_balance_wallet_rounded, label: 'Πληρωμές'),
    _NavItem(icon: Icons.chat_bubble_outline_rounded, activeIcon: Icons.chat_bubble_rounded, label: 'Μηνύματα'),
  ];

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, bottomInset + 16),
      child: Container(
        height: 70,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(36),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF77328D).withOpacity(0.18),
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
                            colors: [Color(0xFF77328D), Color(0xFFE95926)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF77328D).withOpacity(0.35),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        )
                      : null,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: Icon(
                          selected ? item.activeIcon : item.icon,
                          key: ValueKey(selected),
                          size: selected ? 22 : 22,
                          color: selected ? Colors.white : const Color(0xFFBBB8D4),
                        ),
                      ),
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
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
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
