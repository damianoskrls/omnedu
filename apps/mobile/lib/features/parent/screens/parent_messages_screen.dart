import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../messages/conversation_ui.dart';

class ParentMessagesScreen extends ConsumerWidget {
  final String schoolId;
  final String userId;
  const ParentMessagesScreen({super.key, required this.schoolId, required this.userId});

  Future<Map<String, dynamic>> _contacts(WidgetRef ref) async {
    final dio = ref.read(dioProvider);
    try {
      final resp = await dio.get('/schools/$schoolId/conversations/contacts');
      if (resp.data is Map) return Map<String, dynamic>.from(resp.data as Map);
    } catch (_) {}
    final childrenResp = await dio.get('/schools/$schoolId/students/my-children');
    final children = childrenResp.data is List ? childrenResp.data as List : <dynamic>[];
    final teachers = <Map<String, dynamic>>[];
    final seen = <String>{};
    for (final child in children) {
      if (child is! Map) continue;
      final studentName = child['fullName'] as String? ?? '';
      for (final enrollment in (child['enrollments'] as List? ?? [])) {
        final klass = (enrollment as Map)['class'] as Map?;
        final className = klass?['name'] as String? ?? '';
        for (final teacher in (klass?['teachers'] as List? ?? [])) {
          final user = (teacher as Map)['user'] as Map?;
          final id = user?['id'] as String?;
          if (id == null || !seen.add('$id:$studentName')) continue;
          teachers.add({
            'id': id,
            'name': user?['fullName'] ?? 'Δασκάλα',
            'studentName': studentName,
            'className': className,
          });
        }
      }
    }
    return {'admins': <dynamic>[], 'teachers': teachers};
  }

  Future<void> _newMessage(BuildContext context, WidgetRef ref) async {
    Map<String, dynamic> contacts = {};
    try {
      contacts = await _contacts(ref);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
      }
      return;
    }
    if (!context.mounted) return;
    final admins = (contacts['admins'] as List?) ?? [];
    final teachers = (contacts['teachers'] as List?) ?? [];

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Text('Νέο μήνυμα', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFF3E8F7),
                  child: Icon(Icons.apartment_outlined, color: brandPurple),
                ),
                title: const Text('Διαχείριση'),
                subtitle: const Text('Μήνυμα προς το σχολείο'),
                onTap: () => _start(context, sheetContext, ref, kind: 'admin', title: 'Διαχείριση', subtitle: 'Σχολείο'),
              ),
              if (teachers.isNotEmpty)
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 12, 20, 4),
                  child: Text('Δασκάλα του παιδιού', style: TextStyle(fontSize: 12, color: Color(0xFF6B7280), fontWeight: FontWeight.w600)),
                ),
              ...teachers.map((row) {
                final teacher = Map<String, dynamic>.from(row as Map);
                final name = teacher['name'] as String? ?? 'Δασκάλα';
                final child = teacher['studentName'] as String? ?? '';
                final klass = teacher['className'] as String? ?? '';
                final detail = [child, klass].where((part) => part.isNotEmpty).join(' · ');
                return ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFFFF1EC),
                    child: Icon(Icons.person_outline, color: Color(0xFFE95926)),
                  ),
                  title: Text(name),
                  subtitle: Text(detail.isEmpty ? 'Δασκάλα' : detail),
                  onTap: () => _start(
                    context,
                    sheetContext,
                    ref,
                    kind: 'teacher',
                    withUserId: teacher['id'] as String?,
                    title: name,
                    subtitle: detail.isEmpty ? 'Δασκάλα' : detail,
                  ),
                );
              }),
              if (admins.isEmpty && teachers.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('Δεν βρέθηκε διαχείριση ή δασκάλα για το παιδί.', style: TextStyle(color: Color(0xFF6B7280))),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _start(
    BuildContext context,
    BuildContext sheetContext,
    WidgetRef ref, {
    required String kind,
    String? withUserId,
    required String title,
    required String subtitle,
  }) async {
    Navigator.pop(sheetContext);
    try {
      final id = await openScopedConversation(
        ref,
        schoolId: schoolId,
        kind: kind,
        withUserId: withUserId,
        participantIds: withUserId == null ? null : [userId, withUserId],
      );
      ref.invalidate(conversationsProvider(schoolId));
      if (id == null || !context.mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            schoolId: schoolId,
            convId: id,
            title: title,
            subtitle: subtitle,
            currentUserId: userId,
          ),
        ),
      );
      ref.invalidate(conversationsProvider(schoolId));
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
      }
    }
  }

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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _newMessage(context, ref),
        backgroundColor: brandPurple,
        icon: const Icon(Icons.edit_outlined, color: Colors.white),
        label: const Text('Νέο μήνυμα', style: TextStyle(color: Colors.white)),
      ),
      body: convsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: brandPurple)),
        error: (e, _) => Center(child: Text(apiErrorText(e))),
        data: (convs) => convs.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Text(
                    'Στείλτε μήνυμα στη διαχείριση ή στη δασκάλα του παιδιού.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 15),
                  ),
                ),
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(conversationsProvider(schoolId).future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemCount: convs.length,
                  itemBuilder: (_, i) {
                    final conv = Map<String, dynamic>.from(convs[i] as Map);
                    return ConversationTile(
                      conv: conv,
                      userId: userId,
                      onTap: () => openChat(context, ref, schoolId: schoolId, userId: userId, conv: conv),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
