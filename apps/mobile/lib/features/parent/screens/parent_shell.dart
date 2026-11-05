import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/notifications/notification_center.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/app_top_bar.dart';
import '../home/parent_home_tokens.dart';
import '../home/parent_icons.dart';
import 'home_screen.dart';
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
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user!;
    final schoolId = user.schoolId ?? '';

    final pages = [
      HomeScreen(schoolId: schoolId),
      ActivitiesScreen(schoolId: schoolId),
      ParentEventsScreen(schoolId: schoolId),
      BillingScreen(schoolId: schoolId),
      InboxScreen(schoolId: schoolId, embedded: true),
      ParentMessagesScreen(schoolId: schoolId, userId: user.id),
    ];
    final rawIndex = ref.watch(shellTabProvider);
    final index = rawIndex >= 0 && rawIndex < pages.length ? rawIndex : 0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: ParentHomeTokens.background,
        extendBody: false,
        body: Stack(
          children: [
            IndexedStack(index: index, children: pages),
            NotificationWatcher(schoolId: schoolId),
          ],
        ),
        bottomNavigationBar: _ParentBottomNav(
          selectedIndex: index < 4 ? index : -1,
          onTap: (i) => ref.read(shellTabProvider.notifier).state = i,
        ),
      ),
    );
  }
}

class _ParentBottomNav extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _ParentBottomNav({required this.selectedIndex, required this.onTap});

  static const _items = [
    (ParentIconData.home, 'Αρχική'),
    (ParentIconData.activities, 'Δραστηριότητες'),
    (ParentIconData.events, 'Εκδηλώσεις'),
    (ParentIconData.billing, 'Οικονομικά'),
  ];

  @override
  Widget build(BuildContext context) {
    final bottomInset = systemBottomInset(context);
    return Material(
      color: ParentHomeTokens.surface,
      elevation: 0,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: ParentHomeTokens.border)),
        ),
        padding: EdgeInsets.fromLTRB(8, 6, 8, bottomInset + 6),
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              for (var i = 0; i < _items.length; i++)
                Expanded(
                  child: _NavTab(
                    icon: _items[i].$1,
                    label: _items[i].$2,
                    selected: i == selectedIndex,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onTap(i);
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavTab extends StatelessWidget {
  final ParentIconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _NavTab({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = selected ? ParentHomeTokens.primary : ParentHomeTokens.textSecondary;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: selected ? ParentHomeTokens.lilac.withValues(alpha: 0.85) : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ParentIcon(
                icon,
                size: 22,
                color: color,
                accent: selected ? ParentHomeTokens.lilac : ParentHomeTokens.border,
              ),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: color,
                  height: 1.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
