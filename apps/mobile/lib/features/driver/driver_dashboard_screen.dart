import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';
import '../../features/messages/conversation_ui.dart';
import 'driver_route_screen.dart';

class DriverDashboardScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const DriverDashboardScreen({super.key, required this.schoolId});

  @override
  ConsumerState<DriverDashboardScreen> createState() => _DriverDashboardScreenState();
}

class _DriverDashboardScreenState extends ConsumerState<DriverDashboardScreen>
    with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _dashboard;
  bool _loading = true;
  String? _error;

  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.04).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
    _load();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final resp = await ref.read(dioProvider).get('/schools/${widget.schoolId}/bus-tracking/dashboard');
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      if (!mounted) return;
      setState(() { _dashboard = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = apiErrorText(e); _loading = false; });
    }
  }

  void _startRoute({bool afternoon = false}) {
    final d = _dashboard;
    final route = afternoon ? (d?['afternoonRoute']) : (d?['morningRoute']);
    final serviceId = (route is Map ? route['serviceId']?.toString() : null)
        ?? d?['activeServiceId']?.toString();
    if (serviceId == null) return;
    final busName = (route is Map ? route['name']?.toString() : null) ?? 'Σχολικό';
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DriverRouteScreen(
          schoolId: widget.schoolId,
          serviceId: serviceId,
          busName: busName,
          isAfternoon: afternoon,
        ),
      ),
    ).then((_) => _load());
  }

  static String _appBarTitle(Map<String, dynamic>? morning, Map<String, dynamic>? afternoon) {
    final hasMorning = morning != null;
    final hasAfternoon = afternoon != null;
    if (hasMorning && hasAfternoon) return 'Οι Διαδρομές μου';
    if (hasMorning) return 'Πρωινή Παραλαβή';
    if (hasAfternoon) return 'Απογευματινή Παράδοση';
    return 'Σήμερα';
  }

  List<Widget> _buildRouteCards(
    Map<String, dynamic>? morning,
    Map<String, dynamic>? afternoon,
    String today,
  ) {
    if (morning == null && afternoon == null) return [];
    final morningDone = morning?['status'] == 'completed';
    final afternoonDone = afternoon?['status'] == 'completed';
    final widgets = <Widget>[];

    if (morning != null) {
      widgets.add(_RouteCard(
        label: 'Πρωινή Παραλαβή',
        badge: 'ΠΡΩΙΝΟ',
        badgeColor: const Color(0xFF77328D),
        date: today,
        startTime: morning['startTime']?.toString(),
        stopsCount: morning['stopsCount'] as int? ?? 0,
        studentsCount: morning['studentsCount'] as int? ?? 0,
        pulseAnim: _pulseAnim,
        completed: morningDone,
        onStart: morningDone ? null : () => _startRoute(afternoon: false),
      ));
      widgets.add(const SizedBox(height: 12));
    }

    if (afternoon != null) {
      if (morningDone || morning == null) {
        widgets.add(_RouteCard(
          label: 'Απογευματινή Παράδοση',
          badge: 'ΑΠΟΓΕΥΜΑ',
          badgeColor: const Color(0xFFD97706),
          date: today,
          startTime: afternoon['startTime']?.toString(),
          stopsCount: afternoon['stopsCount'] as int? ?? 0,
          studentsCount: afternoon['studentsCount'] as int? ?? 0,
          pulseAnim: _pulseAnim,
          completed: afternoonDone,
          onStart: afternoonDone ? null : () => _startRoute(afternoon: true),
        ));
        widgets.add(const SizedBox(height: 12));
      } else {
        widgets.add(_SecondaryRouteRow(
          label: 'Απογευματινή Παράδοση',
          subtitle: afternoon['startTime'] != null
              ? 'Για τις ${afternoon['startTime']}'
              : 'Αργότερα σήμερα',
          icon: Icons.directions_bus_outlined,
          iconColor: const Color(0xFFD97706),
          locked: true,
          onTap: null,
        ));
        widgets.add(const SizedBox(height: 8));
      }
    }

    if (morningDone && afternoonDone) {
      widgets.add(const _DayCompleteCard());
    }

    return widgets;
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final firstName = (user?.fullName ?? 'Οδηγέ').split(' ').first;
    final d = _dashboard;
    final morning = d?['morningRoute'] != null ? Map<String, dynamic>.from(d!['morningRoute'] as Map) : null;
    final afternoon = d?['afternoonRoute'] != null ? Map<String, dynamic>.from(d!['afternoonRoute'] as Map) : null;
    final busName = morning?['name']?.toString() ?? afternoon?['name']?.toString() ?? 'Σχολικό';
    final busNumber = morning?['busNumber']?.toString() ?? afternoon?['busNumber']?.toString() ?? '';

    final conversations = ref.watch(conversationsProvider(widget.schoolId));
    final unread = conversations.asData?.value
            .where((c) => c is Map && c['unread'] == true)
            .length ?? 0;
    final userId = user?.id ?? '';

    String today = '';
    try {
      today = DateFormat('EEEE, d MMMM', 'el').format(DateTime.now());
    } catch (_) {
      today = DateFormat('EEEE, d MMMM').format(DateTime.now());
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        title: Text(_appBarTitle(morning, afternoon), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.chat_bubble_outline_rounded),
            ),
            tooltip: 'Μηνύματα',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => DriverMessagesScreen(schoolId: widget.schoolId, userId: userId),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  color: const Color(0xFF77328D),
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                    children: [
                      _GreetingCard(firstName: firstName, busName: busName, busNumber: busNumber),
                      const SizedBox(height: 16),
                      ..._buildRouteCards(morning, afternoon, today),
                      if (morning == null && afternoon == null && d != null)
                        _EmptyState(onRetry: _load),
                    ],
                  ),
                ),
    );
  }
}

class _GreetingCard extends StatelessWidget {
  final String firstName;
  final String busName;
  final String busNumber;
  const _GreetingCard({required this.firstName, required this.busName, required this.busNumber});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF8B4DA8), Color(0xFF5B1E73)],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [BoxShadow(color: const Color(0xFF77328D).withOpacity(0.28), blurRadius: 20, offset: const Offset(0, 6))],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Καλημέρα,', style: TextStyle(color: Colors.white70, fontSize: 15)),
                Text('$firstName!', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 28, height: 1.1)),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.directions_bus_rounded, color: Colors.white, size: 14),
                      const SizedBox(width: 5),
                      Text(
                        busNumber.isNotEmpty ? '$busName #$busNumber' : busName,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Image.asset(
            'assets/images/school_bus.png',
            height: 72,
            errorBuilder: (_, __, ___) => const Icon(Icons.directions_bus_rounded, color: Colors.white38, size: 56),
          ),
        ],
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final String label;
  final String badge;
  final Color badgeColor;
  final String date;
  final String? startTime;
  final int stopsCount;
  final int studentsCount;
  final Animation<double> pulseAnim;
  final bool completed;
  final VoidCallback? onStart;

  const _RouteCard({
    required this.label,
    required this.badge,
    required this.badgeColor,
    required this.date,
    required this.startTime,
    required this.stopsCount,
    required this.studentsCount,
    required this.pulseAnim,
    this.completed = false,
    this.onStart,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(badge, style: TextStyle(color: badgeColor, fontWeight: FontWeight.w800, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(date, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _StatTile(icon: Icons.schedule_rounded, iconColor: const Color(0xFF6B7280), label: 'ΕΝΑΡΞΗ', value: startTime ?? '—')),
              const SizedBox(width: 10),
              Expanded(child: _StatTile(icon: Icons.location_on_outlined, iconColor: const Color(0xFFDB2777), label: 'ΣΤΑΣΕΙΣ', value: '$stopsCount')),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _StatTile(icon: Icons.school_rounded, iconColor: const Color(0xFFD97706), label: 'ΜΑΘΗΤΕΣ', value: '$studentsCount')),
              const SizedBox(width: 10),
              Expanded(child: _StatTile(icon: Icons.circle, iconColor: const Color(0xFF059669), label: 'ΚΑΤΑΣΤΑΣΗ', value: 'Ενεργό')),
            ],
          ),
          const SizedBox(height: 18),
          if (completed)
            Container(
              width: double.infinity,
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 22),
                  SizedBox(width: 8),
                  Text('Ολοκληρώθηκε', style: TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.w700, fontSize: 16)),
                ],
              ),
            )
          else
            ScaleTransition(
              scale: pulseAnim,
              child: SizedBox(
                width: double.infinity,
                height: 58,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFE95926),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  icon: const Icon(Icons.play_arrow_rounded, size: 24),
                  label: const Text('Έναρξη Διαδρομής', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                  onPressed: onStart,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  const _StatTile({required this.icon, required this.iconColor, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFF6F3FA), borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 18),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontWeight: FontWeight.w600, fontSize: 10, letterSpacing: 0.5)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF111827))),
        ],
      ),
    );
  }
}

class _SecondaryRouteRow extends StatelessWidget {
  final String label;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final bool locked;
  final VoidCallback? onTap;
  const _SecondaryRouteRow({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    this.locked = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = locked ? const Color(0xFFD1D5DB) : iconColor;
    return Material(
      color: locked ? const Color(0xFFFAFAFA) : Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: locked ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: effectiveColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(locked ? Icons.lock_outline_rounded : icon, color: effectiveColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: locked ? const Color(0xFF9CA3AF) : const Color(0xFF111827))),
                    Text(
                      locked ? 'Διαθέσιμη μετά την παραλαβή' : subtitle,
                      style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
                    ),
                  ],
                ),
              ),
              if (!locked) const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF)),
            ],
          ),
        ),
      ),
    );
  }
}

class _DayCompleteCard extends StatelessWidget {
  const _DayCompleteCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF86EFAC)),
      ),
      child: const Column(
        children: [
          Text('🎉', style: TextStyle(fontSize: 36)),
          SizedBox(height: 10),
          Text('Τέλος ημέρας!', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF15803D))),
          SizedBox(height: 4),
          Text('Και οι δύο διαδρομές ολοκληρώθηκαν.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF6B7280), fontSize: 14)),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onRetry;
  const _EmptyState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            const Icon(Icons.directions_bus_rounded, size: 64, color: Color(0xFFD1D5DB)),
            const SizedBox(height: 16),
            const Text(
              'Ο διαχειριστής δεν σε έχει συνδέσει ακόμα με σχολικό.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF6B7280), fontSize: 15),
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Ανανέωση')),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: Color(0xFFEF4444)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF6B7280))),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Δοκίμασε ξανά')),
          ],
        ),
      ),
    );
  }
}

class DriverMessagesScreen extends ConsumerWidget {
  final String schoolId;
  final String userId;
  const DriverMessagesScreen({super.key, required this.schoolId, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations = ref.watch(conversationsProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Μηνύματα'),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(conversationsProvider(schoolId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: conversations.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (error, _) => Center(child: Text(apiErrorText(error))),
        data: (list) {
          if (list.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Δεν υπάρχουν μηνύματα. Οι γονείς των παιδιών του σχολικού μπορούν να σου γράψουν εδώ.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(conversationsProvider(schoolId).future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, index) {
                final conv = Map<String, dynamic>.from(list[index] as Map);
                return ConversationTile(
                  conv: conv,
                  userId: userId,
                  onTap: () => openChat(context, ref, schoolId: schoolId, userId: userId, conv: conv),
                  onDelete: () => confirmRemoveConversation(
                    context, ref,
                    schoolId: schoolId,
                    conversationId: conv['id']?.toString() ?? '',
                    startedByMe: conv['startedByMe'] == true,
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
