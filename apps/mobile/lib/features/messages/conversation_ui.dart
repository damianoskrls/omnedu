import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/utils/system_insets.dart';

const brandPurple = Color(0xFF77328D);

final conversationsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/conversations');
    final data = resp.data;
    return data is List ? data : [];
  },
);

final messagesProvider = FutureProvider.family<List<dynamic>, ConvKey>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/conversations/${key.convId}/messages',
      queryParameters: const {'take': 40},
    );
    final data = resp.data;
    return data is List ? data : (data is Map && data['messages'] is List ? data['messages'] : []);
  },
);

class ConvKey {
  final String schoolId;
  final String convId;
  const ConvKey(this.schoolId, this.convId);
  @override
  bool operator ==(Object other) => other is ConvKey && other.schoolId == schoolId && other.convId == convId;
  @override
  int get hashCode => Object.hash(schoolId, convId);
}

List<Map<String, dynamic>> otherParticipants(Map<String, dynamic> conv, String userId) {
  final participants = conv['participants'] as List<dynamic>? ?? [];
  return participants
      .whereType<Map>()
      .map((person) => Map<String, dynamic>.from(person))
      .where((person) {
        final id = person['userId'] ?? person['user']?['id'];
        return id != userId;
      })
      .toList();
}

bool _hasRole(Map<String, dynamic> person, String role) {
  final memberships = person['user']?['schoolMemberships'] as List<dynamic>? ?? [];
  return memberships.any((row) => row is Map && row['role'] == role);
}

String conversationTitle(Map<String, dynamic> conv, String userId) {
  final others = otherParticipants(conv, userId);
  if (others.length == 1) {
    final person = others.first;
    final name = person['user']?['fullName'] as String? ?? '';
    final teacher = _hasRole(person, 'teacher');
    final admin = _hasRole(person, 'school_admin');
    if (teacher && !admin) return name.isEmpty ? 'Δασκάλα' : name;
    if (admin && !teacher) return 'Διαχείριση';
    if (_hasRole(person, 'parent')) return name.isEmpty ? 'Γονέας' : name;
    if (name.isNotEmpty) return name;
  }
  if (others.isNotEmpty && others.every((person) => _hasRole(person, 'school_admin'))) {
    return 'Διαχείριση';
  }
  final parents = others.where((person) => _hasRole(person, 'parent')).toList();
  final named = (parents.isEmpty ? others : parents)
      .map((person) => person['user']?['fullName'] as String? ?? '')
      .where((name) => name.isNotEmpty)
      .toList();
  if (named.isEmpty) return 'Συνομιλία';
  return named.join(', ');
}

String conversationDetail(Map<String, dynamic> conv, String userId) {
  final about = conv['about'] as List<dynamic>? ?? [];
  final labels = <String>[];
  for (final row in about) {
    if (row is! Map) continue;
    final student = (row['studentName'] as String?)?.trim() ?? '';
    final klass = (row['className'] as String?)?.trim() ?? '';
    final label = [student, klass].where((part) => part.isNotEmpty).join(' · ');
    if (label.isNotEmpty && !labels.contains(label)) labels.add(label);
  }
  if (labels.isNotEmpty) return labels.join(', ');
  return conversationSubtitle(conv, userId);
}

String conversationSubtitle(Map<String, dynamic> conv, String userId) {
  final others = otherParticipants(conv, userId);
  if (others.isNotEmpty && others.every((person) => _hasRole(person, 'school_admin'))) {
    return 'Σχολείο';
  }
  if (others.any((person) => _hasRole(person, 'teacher'))) return 'Δασκάλα';
  if (others.any((person) => _hasRole(person, 'parent'))) return 'Γονέας';
  return '';
}

void showAppMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      behavior: SnackBarBehavior.floating,
      margin: EdgeInsets.fromLTRB(16, 0, 16, 24 + systemBottomInset(context)),
      content: Text(message),
    ),
  );
}

String apiErrorText(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    final message = data is Map ? data['message'] : null;
    if (message is List && message.isNotEmpty) return message.map((item) => '$item').join('\n');
    if (message is String && message.isNotEmpty && message.length < 180) return message;
    final code = error.response?.statusCode;
    if (code == 403) return 'Δεν έχεις πρόσβαση σε αυτή τη συνομιλία.';
    if (code == 400) return 'Το μήνυμα δεν στάλθηκε. Δοκίμασε ξανά.';
    if (code != null) return 'Η συνομιλία δεν φορτώθηκε ($code).';
  }
  return 'Η συνομιλία δεν φορτώθηκε. Δοκίμασε ξανά.';
}

Future<String?> openScopedConversation(
  WidgetRef ref, {
  required String schoolId,
  required String kind,
  String? withUserId,
  List<String>? participantIds,
}) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.post('/schools/$schoolId/conversations', data: {
    'kind': kind,
    if (withUserId != null) 'withUserId': withUserId,
    if (participantIds != null && participantIds.isNotEmpty) 'participantIds': participantIds,
  });
  final data = resp.data;
  if (data is Map && data['id'] is String) return data['id'] as String;
  return null;
}

class ConversationTile extends StatelessWidget {
  final Map<String, dynamic> conv;
  final String userId;
  final VoidCallback onTap;
  final String? detail;
  const ConversationTile({super.key, required this.conv, required this.userId, required this.onTap, this.detail});

  @override
  Widget build(BuildContext context) {
    final lastMessages = conv['messages'] as List<dynamic>? ?? [];
    final lastMsg = lastMessages.isNotEmpty && lastMessages.first is Map
        ? Map<String, dynamic>.from(lastMessages.first as Map)
        : null;
    final title = conversationTitle(conv, userId);
    final fromApi = conversationDetail(conv, userId);
    final subtitle = (detail != null && detail!.isNotEmpty && (fromApi.isEmpty || fromApi == 'Γονέας' || fromApi == 'Δασκάλα'))
        ? detail!
        : (fromApi.isNotEmpty ? fromApi : (detail ?? ''));
    final admin = title == 'Διαχείριση';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: admin ? const Color(0xFFF3E8F7) : const Color(0xFFFFF1EC),
              child: Icon(admin ? Icons.apartment_outlined : Icons.person_outline, color: admin ? brandPurple : const Color(0xFFE95926), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  if (subtitle.isNotEmpty)
                    Text(subtitle, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
                  Text(
                    lastMsg?['body'] as String? ?? 'Ξεκινήστε μια συνομιλία',
                    style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFD1D5DB)),
          ],
        ),
      ),
    );
  }
}

class ChatScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String convId;
  final String title;
  final String subtitle;
  final String currentUserId;
  const ChatScreen({
    super.key,
    required this.schoolId,
    required this.convId,
    required this.title,
    required this.subtitle,
    required this.currentUserId,
  });

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _ctrl = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/schools/${widget.schoolId}/conversations/${widget.convId}/messages',
        data: {'body': text},
      );
      _ctrl.clear();
      _error = null;
      ref.invalidate(messagesProvider(ConvKey(widget.schoolId, widget.convId)));
      ref.invalidate(conversationsProvider(widget.schoolId));
    } catch (error) {
      _error = apiErrorText(error);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final msgsAsync = ref.watch(messagesProvider(ConvKey(widget.schoolId, widget.convId)));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            if (widget.subtitle.isNotEmpty)
              Text(widget.subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: msgsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: brandPurple)),
              error: (e, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(apiErrorText(e), textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFB91C1C))),
                ),
              ),
              data: (msgs) => msgs.isEmpty
                  ? const Center(child: Text('Ξεκινήστε τη συνομιλία', style: TextStyle(color: Color(0xFF9CA3AF))))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      reverse: true,
                      itemCount: msgs.length,
                      itemBuilder: (_, i) {
                        final msg = Map<String, dynamic>.from(msgs[msgs.length - 1 - i] as Map);
                        final isMe = msg['senderId'] == widget.currentUserId;
                        return _Bubble(message: msg, isMe: isMe);
                      },
                    ),
            ),
          ),
          if (_error != null)
            Container(
              width: double.infinity,
              color: const Color(0xFFFEF2F2),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13)),
            ),
          Container(
            padding: EdgeInsets.fromLTRB(12, 8, 12, 12 + systemBottomInset(context)),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _ctrl,
                    decoration: InputDecoration(
                      hintText: 'Γράψτε μήνυμα...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      isDense: true,
                    ),
                    maxLines: null,
                    textCapitalization: TextCapitalization.sentences,
                  ),
                ),
                const SizedBox(width: 8),
                FloatingActionButton.small(
                  onPressed: _sending ? null : _send,
                  backgroundColor: brandPurple,
                  child: _sending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final bool isMe;
  const _Bubble({required this.message, required this.isMe});

  @override
  Widget build(BuildContext context) {
    final body = message['body'] as String? ?? '';
    final sender = message['sender'] as Map?;
    final senderName = sender?['fullName'] as String? ?? '';

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMe ? brandPurple : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMe ? 16 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 16),
          ),
          border: isMe ? null : Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isMe && senderName.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(senderName, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280), fontWeight: FontWeight.w600)),
              ),
            Text(body, style: TextStyle(color: isMe ? Colors.white : const Color(0xFF111827), fontSize: 14)),
          ],
        ),
      ),
    );
  }
}

void openChat(
  BuildContext context,
  WidgetRef ref, {
  required String schoolId,
  required String userId,
  required Map<String, dynamic> conv,
  String? title,
  String? subtitle,
}) {
  final id = conv['id'] as String?;
  if (id == null) return;
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => ChatScreen(
        schoolId: schoolId,
        convId: id,
        title: title ?? conversationTitle(conv, userId),
        subtitle: subtitle ?? conversationDetail(conv, userId),
        currentUserId: userId,
      ),
    ),
  ).then((_) => ref.invalidate(conversationsProvider(schoolId)));
}
