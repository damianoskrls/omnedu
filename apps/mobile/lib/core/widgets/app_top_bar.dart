import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/messages/conversation_ui.dart';
import '../../features/parent/screens/account_settings_screen.dart';
import '../notifications/notification_center.dart';
import '../providers/auth_provider.dart';
import 'person_face.dart';

final shellTabProvider = StateProvider<int>((ref) => 0);

class AppTopBar extends ConsumerWidget {
  final GlobalKey<NavigatorState> navigatorKey;
  const AppTopBar({super.key, required this.navigatorKey});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authProvider, (previous, next) {
      final previousUser = previous?.user;
      final nextUser = next.user;
      if (previousUser?.id != nextUser?.id || previousUser?.role != nextUser?.role) {
        ref.read(shellTabProvider.notifier).state = 0;
      }
    });
    final user = ref.watch(authProvider).user;
    if (user == null) return const SizedBox.shrink();
    final schoolId = user.schoolId ?? '';
    final owner = user.isOwner;
    final staff = user.usesStaffShell && !owner;
    final notificationsIndex = staff ? 2 : 4;
    final messagesIndex = staff ? 3 : 5;
    final current = ref.watch(shellTabProvider);
    final inbox = owner || schoolId.isEmpty ? const AsyncValue<List<dynamic>>.data([]) : ref.watch(inboxProvider(schoolId));
    final conversations = owner || schoolId.isEmpty ? const AsyncValue<List<dynamic>>.data([]) : ref.watch(conversationsProvider(schoolId));
    final notes = inbox.maybeWhen(
      data: (rows) => rows.where((row) => row is Map && row['isRead'] != true).length,
      orElse: () => 0,
    );
    final messages = conversations.maybeWhen(
      data: (rows) => unreadConversationCount(rows, user.id),
      orElse: () => 0,
    );

    void open(int index) {
      HapticFeedback.lightImpact();
      navigatorKey.currentState?.popUntil((route) => route.isFirst);
      ref.read(shellTabProvider.notifier).state = index;
    }

    return Material(
      color: Colors.white,
      child: SafeArea(
        bottom: false,
        child: Container(
          height: 58,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFF0E8F4))),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.asset('assets/images/school_logo.png', width: 36, height: 36, fit: BoxFit.contain),
              ),
              const Spacer(),
              if (!owner) ...[
                _TopAction(
                  icon: current == notificationsIndex ? Icons.notifications_rounded : Icons.notifications_outlined,
                  active: current == notificationsIndex,
                  count: notes,
                  onTap: () => open(notificationsIndex),
                ),
                const SizedBox(width: 4),
                _TopAction(
                  icon: current == messagesIndex ? Icons.chat_bubble_rounded : Icons.chat_bubble_outline_rounded,
                  active: current == messagesIndex,
                  count: messages,
                  onTap: () => open(messagesIndex),
                ),
                const SizedBox(width: 8),
              ],
              GestureDetector(
                onTap: () => _accountSheet(ref),
                child: PersonFace(
                  name: user.fullName,
                  photoUrl: user.avatarUrl,
                  size: 36,
                  radius: 18,
                  fontSize: 15,
                  background: const Color(0xFFF3E8F7),
                  foreground: const Color(0xFF77328D),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _accountSheet(WidgetRef ref) {
    final navContext = navigatorKey.currentContext;
    if (navContext == null) return;
    showModalBottomSheet(
      context: navContext,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 12),
              ListTile(
                leading: const Icon(Icons.manage_accounts_rounded, color: Color(0xFF77328D)),
                title: const Text('Ρυθμίσεις λογαριασμού', style: TextStyle(fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(sheetContext);
                  Navigator.of(navContext).push(MaterialPageRoute(builder: (_) => const AccountSettingsScreen()));
                },
              ),
              ..._roleSwitches(ref, sheetContext, navContext),
              ListTile(
                leading: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
                title: const Text('Αποσύνδεση', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(sheetContext);
                  ref.read(authProvider.notifier).logout();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _roleSwitches(WidgetRef ref, BuildContext sheetContext, BuildContext navContext) {
    final user = ref.read(authProvider).user;
    if (user == null) return const [];
    final others = user.memberships.where((membership) {
      final owner = membership.userId ?? user.id;
      return owner != user.id || membership.schoolId != user.schoolId || membership.role != user.role;
    });
    return [
      for (final membership in others)
        ListTile(
          leading: Icon(_roleIcon(membership.role), color: const Color(0xFF77328D)),
          title: Text(
            'Αλλαγή σε ${_roleAccusative(membership.role)}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Text(membership.schoolName),
          onTap: () async {
            Navigator.pop(sheetContext);
            final notifier = ref.read(authProvider.notifier);
            try {
              await notifier.switchContext(membership.schoolId, membership.role, userId: membership.userId);
            } catch (_) {
              if (navContext.mounted) {
                ScaffoldMessenger.of(navContext).showSnackBar(
                  const SnackBar(content: Text('Η αλλαγή ρόλου δεν ολοκληρώθηκε')),
                );
              }
            }
          },
        ),
    ];
  }
}

String _roleAccusative(String role) {
  switch (role) {
    case 'parent':
      return 'γονέα';
    case 'teacher':
      return 'εκπαιδευτικό';
    case 'school_admin':
      return 'διαχειριστή';
    case 'owner':
      return 'ιδιοκτήτη';
    default:
      return 'άλλο ρόλο';
  }
}

IconData _roleIcon(String role) {
  switch (role) {
    case 'parent':
      return Icons.family_restroom_rounded;
    case 'teacher':
      return Icons.school_rounded;
    default:
      return Icons.admin_panel_settings_rounded;
  }
}

class _TopAction extends StatelessWidget {
  final IconData icon;
  final bool active;
  final int count;
  final VoidCallback onTap;
  const _TopAction({required this.icon, required this.active, required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final label = count > 9 ? '9+' : '$count';
    return IconButton(
      onPressed: onTap,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(icon, color: active ? const Color(0xFF77328D) : const Color(0xFF6B7280)),
          if (count > 0)
            Positioned(
              right: -8,
              top: -6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                decoration: BoxDecoration(color: const Color(0xFFE95926), borderRadius: BorderRadius.circular(10)),
                alignment: Alignment.center,
                child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
              ),
            ),
        ],
      ),
    );
  }
}
