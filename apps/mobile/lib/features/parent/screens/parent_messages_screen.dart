import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
final conversationsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/conversations');
    final data = resp.data;
    return data is List ? data : [];
  },
);

final messagesProvider = FutureProvider.family<List<dynamic>, _ConvKey>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/${key.schoolId}/conversations/${key.convId}/messages');
    final data = resp.data;
    return data is List ? data : (data is Map && data['messages'] is List ? data['messages'] : []);
  },
);

class _ConvKey {
  final String schoolId;
  final String convId;
  const _ConvKey(this.schoolId, this.convId);
  @override
  bool operator ==(Object o) => o is _ConvKey && o.schoolId == schoolId && o.convId == convId;
  @override
  int get hashCode => Object.hash(schoolId, convId);
}

class ParentMessagesScreen extends ConsumerWidget {
  final String schoolId;
  final String userId;
  const ParentMessagesScreen({super.key, required this.schoolId, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final convsAsync = ref.watch(conversationsProvider(schoolId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Μηνύματα', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.invalidate(conversationsProvider(schoolId)),
          ),
        ],
      ),
      body: convsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Σφάλμα: $e')),
        data: (convs) => convs.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.chat_bubble_outline, size: 64, color: Colors.grey[300]),
                    const SizedBox(height: 16),
                    const Text('Δεν υπάρχουν μηνύματα',
                        style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 15)),
                    const SizedBox(height: 8),
                    const Text('Επικοινωνήστε με το σχολείο',
                        style: TextStyle(color: Color(0xFFD1D5DB), fontSize: 13)),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(conversationsProvider(schoolId).future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemCount: convs.length,
                  itemBuilder: (_, i) {
                    final conv = convs[i] as Map<String, dynamic>;
                    return _ConvTile(
                      conv: conv,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => _ChatScreen(
                            schoolId: schoolId,
                            convId: conv['id'] as String,
                            participants: conv['participants'] as List<dynamic>? ?? [],
                            currentUserId: userId,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

class _ConvTile extends StatelessWidget {
  final Map<String, dynamic> conv;
  final VoidCallback onTap;
  const _ConvTile({required this.conv, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final participants = conv['participants'] as List<dynamic>? ?? [];
    final lastMessages = conv['messages'] as List<dynamic>? ?? [];
    final lastMsg = lastMessages.isNotEmpty ? lastMessages.first as Map<String, dynamic> : null;
    final names = participants
        .map((p) => (p['user']?['fullName'] as String? ?? '').split(' ').first)
        .where((n) => n.isNotEmpty)
        .join(', ');

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
              backgroundColor: const Color(0xFFEEF2FF),
              child: const Icon(Icons.group_outlined, color: Color(0xFF4F46E5), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(names.isNotEmpty ? names : 'Συνομιλία',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  if (lastMsg != null)
                    Text(
                      lastMsg['body'] as String? ?? '',
                      style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )
                  else
                    const Text('Ξεκινήστε μια συνομιλία',
                        style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
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

class _ChatScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String convId;
  final List<dynamic> participants;
  final String currentUserId;
  const _ChatScreen({
    required this.schoolId,
    required this.convId,
    required this.participants,
    required this.currentUserId,
  });

  @override
  ConsumerState<_ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<_ChatScreen> {
  final _ctrl = TextEditingController();
  bool _sending = false;

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
      ref.invalidate(messagesProvider(_ConvKey(widget.schoolId, widget.convId)));
    } finally {
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final msgsAsync = ref.watch(messagesProvider(_ConvKey(widget.schoolId, widget.convId)));
    final names = widget.participants
        .map((p) => (p['user']?['fullName'] as String? ?? '').split(' ').first)
        .where((n) => n.isNotEmpty)
        .join(', ');

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(names.isNotEmpty ? names : 'Συνομιλία',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const Text('Σχολείο', style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: msgsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Σφάλμα: $e')),
              data: (msgs) => msgs.isEmpty
                  ? const Center(child: Text('Ξεκινήστε τη συνομιλία', style: TextStyle(color: Color(0xFF9CA3AF))))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      reverse: true,
                      itemCount: msgs.length,
                      itemBuilder: (_, i) {
                        final msg = msgs[msgs.length - 1 - i] as Map<String, dynamic>;
                        final senderId = msg['senderId'] as String?;
                        final isMe = senderId == widget.currentUserId;
                        return _Bubble(message: msg, isMe: isMe);
                      },
                    ),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
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
                  backgroundColor: const Color(0xFF4F46E5),
                  child: _sending
                      ? const SizedBox(
                          width: 16, height: 16,
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
    final sender = message['sender'] as Map<String, dynamic>?;
    final senderName = sender?['fullName'] as String? ?? '';

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFF4F46E5) : Colors.white,
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
                child: Text(senderName,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280), fontWeight: FontWeight.w600)),
              ),
            Text(
              body,
              style: TextStyle(color: isMe ? Colors.white : const Color(0xFF111827), fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
