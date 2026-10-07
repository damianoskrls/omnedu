import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/messages/conversation_ui.dart';
import '../../features/parent/screens/celebration_detail_screen.dart';
import '../../features/parent/screens/events_screen.dart';
import '../../features/parent/screens/school_posts_screen.dart';
import '../../features/parent/screens/teacher_absences_screen.dart';
import '../../features/parent/screens/parent_meetings_screen.dart';
import '../../features/parent/screens/billing_screen.dart';
import '../../features/parent/screens/bulletin_screen.dart';
import '../../features/parent/screens/thematic_screen.dart';
import '../../features/teacher/screens/teacher_meetings_screen.dart';
import '../../features/teacher/screens/teacher_thematic_screen.dart';
import '../api/api_client.dart';
import '../providers/auth_provider.dart';
import 'phone_push.dart';

const _shownKey = 'shown_notification_ids';
final _plugin = FlutterLocalNotificationsPlugin();
bool _pluginReady = false;

final inboxProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/notifications/inbox');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class NotificationWatcher extends ConsumerStatefulWidget {
  final String schoolId;
  const NotificationWatcher({super.key, required this.schoolId});

  @override
  ConsumerState<NotificationWatcher> createState() => _NotificationWatcherState();
}

class _NotificationWatcherState extends ConsumerState<NotificationWatcher> with WidgetsBindingObserver {
  Timer? _timer;
  final _shown = <String>{};
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _start();
  }

  Future<void> _start() async {
    await _prepare();
    await startPhonePush(
      onToken: (token) async {
        if (!mounted || widget.schoolId.isEmpty) return;
        try {
          final prefs = await SharedPreferences.getInstance();
          final existing = prefs.getString('push_device_id');
          final deviceId = (existing != null && existing.isNotEmpty)
              ? existing
              : DateTime.now().microsecondsSinceEpoch.toString();
          if (existing == null || existing.isEmpty) await prefs.setString('push_device_id', deviceId);
          await ref.read(dioProvider).post(
            '/schools/${widget.schoolId}/notifications/device',
            data: {'token': token, 'platform': 'android', 'deviceId': deviceId},
          );
        } catch (_) {}
      },
      onOpened: (data) {
        if (!mounted) return;
        openNotification(context, ref, {
          'type': data['type'] ?? 'broadcast',
          'title': data['title'] ?? 'Ονειροχώρα',
          'data': data,
        });
      },
      onForeground: (title, body) {
        _show({
          'id': 'live-${DateTime.now().microsecondsSinceEpoch}',
          'title': title,
          'body': body,
        });
      },
    );
    await _poll();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => _poll());
  }

  Future<void> _prepare() async {
    if (!_pluginReady) {
      const android = AndroidInitializationSettings('@mipmap/ic_launcher');
      const ios = DarwinInitializationSettings();
      await _plugin.initialize(
        settings: const InitializationSettings(android: android, iOS: ios),
        onDidReceiveNotificationResponse: (response) {
          final payload = response.payload;
          if (payload != null && mounted) _openPayload(payload);
        },
      );
      await _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      _pluginReady = true;
      final launch = await _plugin.getNotificationAppLaunchDetails();
      final payload = launch?.notificationResponse?.payload;
      if (launch?.didNotificationLaunchApp == true && payload != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _openPayload(payload);
        });
      }
    }
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _shown.addAll(prefs.getStringList(_shownKey) ?? const []);
    _loaded = true;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _poll();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _poll() async {
    if (!mounted || widget.schoolId.isEmpty) return;
    try {
      final dio = ref.read(dioProvider);
      final resp = await dio.get('/schools/${widget.schoolId}/notifications/inbox');
      final list = resp.data is List ? resp.data as List : const [];
      for (final item in list) {
        if (item is! Map) continue;
        final notice = Map<String, dynamic>.from(item);
        final id = notice['id'] as String? ?? '';
        if (id.isEmpty || notice['isRead'] == true || _shown.contains(id)) continue;
        _shown.add(id);
        if (!PhonePushConfig.ready) await _show(notice);
      }
      final prefs = await SharedPreferences.getInstance();
      final kept = _shown.toList();
      await prefs.setStringList(_shownKey, kept.length > 200 ? kept.sublist(kept.length - 200) : kept);
      if (mounted) ref.invalidate(inboxProvider(widget.schoolId));
    } catch (_) {}
  }

  Future<void> _show(Map<String, dynamic> notice) async {
    final id = notice['id'] as String? ?? '';
    final title = notice['title'] as String? ?? 'Ονειροχώρα';
    final body = notice['body'] as String? ?? '';
    const details = AndroidNotificationDetails(
      'oneirochora',
      'Ονειροχώρα',
      channelDescription: 'Μηνύματα, δελτία και πληρωμές',
      importance: Importance.max,
      priority: Priority.high,
    );
    await _plugin.show(
      id: id.hashCode & 0x7fffffff,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(android: details, iOS: DarwinNotificationDetails()),
      payload: jsonEncode({
        'id': id,
        'type': notice['type'],
        'title': title,
        'data': notice['data'] ?? {},
      }),
    );
  }

  void _openPayload(String payload) {
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map) openNotification(context, ref, Map<String, dynamic>.from(decoded));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

Future<void> openNotification(BuildContext context, WidgetRef ref, Map<String, dynamic> notice, {bool fromList = false}) async {
  final id = notice['id'] as String?;
  final schoolId = ref.read(authProvider).user?.schoolId ?? '';
  final userId = ref.read(authProvider).user?.id ?? '';
  final type = notice['type'] as String? ?? '';
  final raw = notice['data'];
  final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
  if (id != null && id.isNotEmpty && schoolId.isNotEmpty) {
    try {
      await ref.read(dioProvider).post('/schools/$schoolId/notifications/inbox/$id/read');
      ref.invalidate(inboxProvider(schoolId));
    } catch (_) {}
  }
  if (!context.mounted || schoolId.isEmpty) return;

  if (type == 'message') {
    final convId = data['conversationId'] as String? ?? '';
    if (convId.isEmpty) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatScreen(
          schoolId: schoolId,
          convId: convId,
          title: (data['title'] as String?) ?? (notice['title'] as String? ?? 'Συνομιλία'),
          subtitle: '',
          currentUserId: userId,
        ),
      ),
    );
    return;
  }

  if (type == 'daily_report') {
    final studentId = data['studentId'] as String? ?? '';
    if (studentId.isEmpty) return;
    final date = DateTime.tryParse(data['date'] as String? ?? '');
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BulletinScreen(
          schoolId: schoolId,
          child: {'id': studentId, 'fullName': data['studentName'] ?? 'Παιδί'},
          initialDay: date,
        ),
      ),
    );
    return;
  }

  if (type == 'payment') {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => BillingScreen(schoolId: schoolId)));
    return;
  }

  if (type == 'event_post' || type == 'school_event') {
    final eventId = data['eventId'] as String? ?? '';
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => eventId.isEmpty
            ? ParentEventsScreen(schoolId: schoolId)
            : ParentEventScreen(schoolId: schoolId, eventId: eventId),
      ),
    );
    return;
  }

  if (type == 'celebration') {
    final celebrationId = data['celebrationId'] as String? ?? '';
    if (celebrationId.isEmpty) {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => ParentEventsScreen(schoolId: schoolId)));
      return;
    }
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CelebrationDetailScreen(schoolId: schoolId, celebrationId: celebrationId),
      ),
    );
    return;
  }

  if (type == 'teacher_absence') {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => TeacherAbsencesScreen(schoolId: schoolId)));
    return;
  }

  if (type == 'school_post') {
    final postId = data['postId'] as String? ?? '';
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => postId.isEmpty
            ? SchoolPostsScreen(schoolId: schoolId)
            : SchoolPostScreen(schoolId: schoolId, postId: postId),
      ),
    );
    return;
  }

  if (type == 'parent_meeting' || type == 'parent_meeting_request' || type == 'parent_meeting_accepted') {
    final classId = data['classId'] as String? ?? '';
    final className = data['className'] as String? ?? '';
    final meetingId = data['meetingId'] as String?;
    final role = ref.read(authProvider).user?.role;
    if (role == 'teacher') {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => TeacherMeetingsScreen(schoolId: schoolId, classId: classId, className: className),
        ),
      );
    } else {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ParentMeetingsScreen(
            schoolId: schoolId,
            classId: classId,
            className: className,
            studentId: data['studentId'] as String? ?? '',
            studentName: data['studentName'] as String? ?? 'Παιδί',
            meetingId: meetingId,
          ),
        ),
      );
    }
    return;
  }

  if (type == 'thematic') {
    final classId = data['classId'] as String? ?? '';
    if (classId.isEmpty) return;
    final className = data['className'] as String? ?? '';
    final month = data['month'] as String?;
    final role = ref.read(authProvider).user?.role;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => role == 'teacher'
            ? TeacherThematicScreen(schoolId: schoolId, classId: classId, className: className, initialMonth: month)
            : ParentThematicScreen(schoolId: schoolId, classId: classId, className: className, initialMonth: month),
      ),
    );
    return;
  }

  if (fromList) return;
  await Navigator.push(context, MaterialPageRoute(builder: (_) => InboxScreen(schoolId: schoolId)));
}

class InboxScreen extends ConsumerWidget {
  final String schoolId;
  final bool embedded;
  const InboxScreen({super.key, required this.schoolId, this.embedded = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(inboxProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        automaticallyImplyLeading: !embedded,
        title: const Text('Ειδοποιήσεις'),
        actions: [
          IconButton(onPressed: () => ref.invalidate(inboxProvider(schoolId)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: inbox.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (error, _) => const Center(child: Text('Οι ειδοποιήσεις δεν φορτώθηκαν.')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Δεν υπάρχουν ειδοποιήσεις ακόμα. Μήνυμα, δελτίο και οφειλή εμφανίζονται εδώ και στο κινητό.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, index) {
              final notice = Map<String, dynamic>.from(list[index] as Map);
              final unread = notice['isRead'] != true;
              final rawData = notice['data'];
              final imageUrl = rawData is Map ? rawData['imageUrl']?.toString() : null;
              return Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => openNotification(context, ref, notice, fromList: true),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          backgroundColor: unread ? const Color(0xFFF3E8F7) : const Color(0xFFF3F4F6),
                          child: Icon(_icon(notice['type'] as String?), color: const Color(0xFF77328D)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(notice['title'] as String? ?? 'Ειδοποίηση', style: const TextStyle(fontWeight: FontWeight.w800)),
                              const SizedBox(height: 2),
                              Text(notice['body'] as String? ?? ''),
                              if (imageUrl != null && imageUrl.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
                                    child: Image.network(imageUrl, height: 140, width: double.infinity, fit: BoxFit.cover),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (unread) const Padding(padding: EdgeInsets.only(left: 8, top: 6), child: Icon(Icons.circle, size: 10, color: Color(0xFFE95926))),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  IconData _icon(String? type) {
    if (type == 'message') return Icons.chat_bubble_rounded;
    if (type == 'daily_report') return Icons.menu_book_rounded;
    if (type == 'payment') return Icons.payments_rounded;
    if (type == 'celebration') return Icons.celebration_rounded;
    if (type == 'school_event' || type == 'event_post') return Icons.photo_library_rounded;
    if (type == 'school_post') return Icons.newspaper_rounded;
    if (type == 'teacher_absence') return Icons.person_off_rounded;
    if (type == 'thematic') return Icons.auto_stories_rounded;
    if (type == 'parent_meeting' || type == 'parent_meeting_request' || type == 'parent_meeting_accepted') {
      return Icons.event_available_rounded;
    }
    return Icons.notifications_rounded;
  }
}
