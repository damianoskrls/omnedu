import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/medications/medications_screen.dart';
import '../../features/messages/conversation_ui.dart';
import '../../features/parent/screens/assignments_screen.dart';
import '../../features/parent/screens/celebration_detail_screen.dart';
import '../../features/parent/screens/events_screen.dart';
import '../../features/parent/screens/school_posts_screen.dart';
import '../../features/parent/screens/teacher_absences_screen.dart';
import '../../features/teacher/screens/assignments_screen.dart';
import '../../features/teacher/screens/teacher_leaves_screen.dart';
import '../../features/parent/screens/parent_meetings_screen.dart';
import '../../features/parent/screens/billing_screen.dart';
import '../../features/parent/screens/bulletin_screen.dart';
import '../../features/parent/screens/parent_child_pages.dart';
import '../../features/parent/screens/thematic_screen.dart';
import '../../features/teacher/screens/teacher_meetings_screen.dart';
import '../../features/teacher/screens/teacher_thematic_screen.dart';
import '../api/api_client.dart';
import '../utils/system_insets.dart';
import '../widgets/app_image.dart';
import '../providers/auth_provider.dart';
import '../storage/secure_storage.dart';
import 'ios_notices.dart';
import 'open_conversation.dart';
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
  final _recentText = <String, DateTime>{};
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _start();
  }

  Future<void> _start() async {
    await _prepare();
    await _rememberIosSession();
    try {
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
            data: {
              'token': token,
              'platform': !kIsWeb && Platform.isIOS ? 'ios' : 'android',
              'deviceId': deviceId,
            },
          );
        } catch (_) {}
      },
      onOpened: (data) {
        if (!mounted) return;
        if (_driverSkips(ref, data)) return;
        openNotification(context, ref, {
          'type': data['type'] ?? 'broadcast',
          'title': data['title'] ?? 'Ονειροχώρα',
          'data': data,
        });
      },
      onForeground: (title, body, data) {
        if (_driverSkips(ref, data)) return;
        if (_viewingMessage(data)) {
          final conv = data['conversationId']?.toString() ?? '';
          if (conv.isNotEmpty) {
            ref.invalidate(messagesProvider(ConvKey(widget.schoolId, conv)));
          }
          return;
        }
        _show({
          'id': 'live-${DateTime.now().microsecondsSinceEpoch}',
          'title': title,
          'body': body,
          'type': data['type'],
          'data': data,
        });
      },
    );
    } catch (_) {}
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
      await _plugin
          .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(alert: true, badge: true, sound: true);
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
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      _rememberIosSession();
      checkIosNotices();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _rememberIosSession() async {
    if (!mounted) return;
    final user = ref.read(authProvider).user;
    final storage = ref.read(secureStorageProvider);
    final access = await storage.getAccessToken() ?? '';
    final refresh = await storage.getRefreshToken() ?? '';
    await publishIosNoticeSession(
      access: access,
      refresh: refresh,
      schoolId: user?.schoolId ?? widget.schoolId,
      role: user?.role ?? '',
    );
  }

  Future<void> _poll() async {
    if (!mounted || widget.schoolId.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      _shown.addAll(prefs.getStringList(_shownKey) ?? const []);
      await _rememberIosSession();
      final dio = ref.read(dioProvider);
      final resp = await dio.get('/schools/${widget.schoolId}/notifications/inbox');
      final list = resp.data is List ? resp.data as List : const [];
      for (final item in list) {
        if (item is! Map) continue;
        final notice = Map<String, dynamic>.from(item);
        final id = notice['id'] as String? ?? '';
        if (id.isEmpty || notice['isRead'] == true || _shown.contains(id)) continue;
        if (ref.read(authProvider).user?.isDriver == true && notice['type']?.toString() != 'message') continue;
        if (notice['type']?.toString() == 'message') ref.invalidate(conversationsProvider(widget.schoolId));
        if (_viewingMessage(notice)) {
          _shown.add(id);
          dio.post('/schools/${widget.schoolId}/notifications/inbox/$id/read').then((_) {}, onError: (_) {});
          final raw = notice['data'];
          final conv = raw is Map ? raw['conversationId']?.toString() ?? '' : '';
          if (conv.isNotEmpty) ref.invalidate(messagesProvider(ConvKey(widget.schoolId, conv)));
          continue;
        }
        final sentAt = DateTime.tryParse(notice['sentAt']?.toString() ?? '');
        if (sentAt != null && DateTime.now().difference(sentAt.toLocal()) > const Duration(hours: 12)) {
          _shown.add(id);
          continue;
        }
        final displayed = await _show(notice);
        if (displayed) _shown.add(id);
      }
      final kept = _shown.toList();
      await prefs.setStringList(_shownKey, kept.length > 200 ? kept.sublist(kept.length - 200) : kept);
      if (mounted) ref.invalidate(inboxProvider(widget.schoolId));
    } catch (_) {}
  }

  Future<bool> _show(Map<String, dynamic> notice) async {
    final id = notice['id'] as String? ?? '';
    final title = notice['title'] as String? ?? 'Ονειροχώρα';
    final body = _noticeBody(notice);
    final key = '$title|$body';
    final last = _recentText[key];
    final now = DateTime.now();
    if (last != null && now.difference(last) < const Duration(minutes: 2)) return true;
    _recentText[key] = now;
    const details = AndroidNotificationDetails(
      'oneirochora',
      'Ονειροχώρα',
      channelDescription: 'Μηνύματα, δελτία και πληρωμές',
      importance: Importance.max,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      presentBanner: true,
      presentList: true,
      interruptionLevel: InterruptionLevel.active,
    );
    await _plugin.show(
      id: id.hashCode & 0x7fffffff,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(android: details, iOS: iosDetails),
      payload: jsonEncode({
        'id': id,
        'type': notice['type'],
        'title': title,
        'body': notice['body'],
        'sentAt': notice['sentAt'],
        'data': notice['data'] ?? {},
      }),
    );
    return true;
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

bool _driverSkips(WidgetRef ref, Object? data) {
  if (ref.read(authProvider).user?.isDriver != true) return false;
  final type = data is Map ? data['type']?.toString() ?? '' : '';
  return type != 'message' && type != 'new_message';
}

bool _viewingMessage(Map<dynamic, dynamic> notice) {
  final open = openConversationId.value;
  if (open == null || open.isEmpty) return false;
  final type = notice['type']?.toString() ?? '';
  if (type != 'message') return false;
  final raw = notice['data'];
  final conv = raw is Map ? raw['conversationId']?.toString() ?? '' : '';
  return conv.isNotEmpty && conv == open;
}

bool _isRegulation(Map<String, dynamic> notice, Map<String, dynamic> data) {
  final type = notice['type']?.toString() ?? '';
  final title = (notice['title']?.toString() ?? '').toLowerCase();
  final screen = data['screen']?.toString() ?? '';
  return type == 'regulation' || screen == 'regulations' || title.contains('κανονισμ');
}

String _noticeBody(Map<String, dynamic> notice) {
  final raw = notice['data'];
  final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
  final body = notice['body']?.toString() ?? '';
  if (!_isRegulation(notice, data)) return body;
  if (body.length <= 220 && body.contains('Πάτα')) return body;
  return 'Ανέβηκε κανονισμός. Πάτα για να τον διαβάσεις.';
}

Future<void> openNotification(BuildContext context, WidgetRef ref, Map<String, dynamic> notice) async {
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
    if (ref.read(authProvider).user?.isOwner == true) return;
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

  if (type == 'questionnaire') {
    final studentId = data['studentId']?.toString() ?? '';
    if (studentId.isEmpty) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => QuestionnairesScreen(
          schoolId: schoolId,
          child: {'id': studentId, 'fullName': data['studentName'] ?? 'Παιδί'},
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

  if (type == 'leave') {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => TeacherLeavesScreen(schoolId: schoolId)));
    return;
  }

  if (type == 'medication') {
    final role = ref.read(authProvider).user?.role;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MedicationsScreen(
          schoolId: schoolId,
          forParent: role == 'parent',
          studentId: data['studentId']?.toString(),
        ),
      ),
    );
    return;
  }

  if (_isRegulation(notice, data)) {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RegulationsScreen(
          schoolId: schoolId,
          academicYear: data['academicYear']?.toString() ?? '',
        ),
      ),
    );
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

  if (type == 'assignment') {
    final role = ref.read(authProvider).user?.role;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => role == 'parent'
            ? ParentAssignmentsScreen(schoolId: schoolId, studentId: data['studentId']?.toString())
            : TeacherAssignmentsScreen(schoolId: schoolId, initialClassId: data['classId']?.toString()),
      ),
    );
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

  await Navigator.push(context, MaterialPageRoute(builder: (_) => NoticeDetailScreen(notice: notice)));
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
          final notices = list.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
          return _NoticeList(notices: notices, iconFor: _icon, onOpen: (notice) => openNotification(context, ref, notice));
        },
      ),
    );
  }

  IconData _icon(Map<String, dynamic> notice) {
    final raw = notice['data'];
    final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final type = notice['type'] as String?;
    if (type == 'regulation' || _isRegulation(notice, data)) return Icons.gavel_rounded;
    if (type == 'message') return Icons.chat_bubble_rounded;
    if (type == 'daily_report') return Icons.menu_book_rounded;
    if (type == 'payment') return Icons.payments_rounded;
    if (type == 'celebration') return Icons.celebration_rounded;
    if (type == 'school_event' || type == 'event_post') return Icons.photo_library_rounded;
    if (type == 'school_post' && data['postType']?.toString() == 'found') return Icons.checkroom_rounded;
    if (type == 'school_post') return Icons.newspaper_rounded;
    if (type == 'teacher_absence') return Icons.person_off_rounded;
    if (type == 'leave') return Icons.beach_access_rounded;
    if (type == 'medication') return Icons.medication_rounded;
    if (type == 'thematic') return Icons.auto_stories_rounded;
    if (type == 'assignment') return Icons.assignment_rounded;
    if (type == 'parent_meeting' || type == 'parent_meeting_request' || type == 'parent_meeting_accepted') {
      return Icons.event_available_rounded;
    }
    return Icons.notifications_rounded;
  }
}

class _NoticeList extends StatefulWidget {
  final List<Map<String, dynamic>> notices;
  final IconData Function(Map<String, dynamic> notice) iconFor;
  final void Function(Map<String, dynamic> notice) onOpen;
  const _NoticeList({required this.notices, required this.iconFor, required this.onOpen});

  @override
  State<_NoticeList> createState() => _NoticeListState();
}

class _NoticeListState extends State<_NoticeList> {
  static const _preview = 8;
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final shown = _all ? widget.notices : widget.notices.take(_preview).toList();
    final hidden = widget.notices.length - shown.length;
    return ListView.separated(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
      itemCount: shown.length + (hidden > 0 ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, index) {
        if (index >= shown.length) {
          return FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF77328D),
              minimumSize: const Size.fromHeight(52),
            ),
            onPressed: () => setState(() => _all = true),
            child: Text('Εμφάνιση όλων των ειδοποιήσεων ($hidden ακόμα)'),
          );
        }
        final notice = shown[index];
        final unread = notice['isRead'] != true;
        final when = _noticeWhen(notice);
        return Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => widget.onOpen(notice),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    backgroundColor: unread ? const Color(0xFFF3E8F7) : const Color(0xFFF3F4F6),
                    child: Icon(widget.iconFor(notice), color: const Color(0xFF77328D)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(notice['title'] as String? ?? 'Ειδοποίηση', style: const TextStyle(fontWeight: FontWeight.w800)),
                        if (when.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(when, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF), height: 1.2)),
                        ],
                        const SizedBox(height: 4),
                        Text(_noticeBody(notice), maxLines: 2, overflow: TextOverflow.ellipsis),
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
  }
}

class NoticeDetailScreen extends StatelessWidget {
  final Map<String, dynamic> notice;
  const NoticeDetailScreen({super.key, required this.notice});

  @override
  Widget build(BuildContext context) {
    final raw = notice['data'];
    final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final title = notice['title']?.toString().trim() ?? '';
    final body = (notice['body']?.toString().trim().isNotEmpty == true ? notice['body']?.toString() : data['body']?.toString())?.trim() ?? '';
    final imageUrl = data['imageUrl']?.toString() ?? '';
    final when = _noticeWhen(notice);
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Ειδοποίηση'),
        actions: [
          IconButton(
            tooltip: 'Κλείσιμο',
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
              children: [
                if (when.isNotEmpty)
                  Text(when, style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
                if (title.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF2C2422), height: 1.25)),
                ],
                if (imageUrl.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: AppImage(imageUrl, width: double.infinity, fit: BoxFit.contain),
                  ),
                ],
                if (body.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(body, style: const TextStyle(fontSize: 16, height: 1.45, color: Color(0xFF2C2422))),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + systemBottomInset(context)),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D)),
                onPressed: () => Navigator.pop(context),
                child: const Text('Κλείσιμο', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _noticeWhen(Map<String, dynamic> notice) {
  final parsed = DateTime.tryParse(notice['sentAt']?.toString() ?? '');
  if (parsed == null) return '';
  final time = parsed.toLocal();
  final date = '${time.day.toString().padLeft(2, '0')}/${time.month.toString().padLeft(2, '0')}/${time.year}';
  final clock = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  return '$date · $clock';
}
