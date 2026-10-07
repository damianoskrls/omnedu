import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../messages/conversation_ui.dart';

class TeacherMessagesScreen extends ConsumerWidget {
  final String schoolId;
  final String userId;
  const TeacherMessagesScreen({super.key, required this.schoolId, required this.userId});

  Future<void> _newMessage(BuildContext context, WidgetRef ref, {required bool asAdmin}) async {
    final dio = ref.read(dioProvider);
    List<dynamic> parents = [];
    try {
      final resp = await dio.get('/schools/$schoolId/conversations/contacts');
      if (resp.data is Map) parents = (resp.data['parents'] as List?) ?? [];
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $error')));
      }
      return;
    }
    if (!context.mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Text(asAdmin ? 'Μήνυμα σε γονέα' : 'Γονείς των τάξεών μου', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              if (parents.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('Δεν βρέθηκαν γονείς.', style: TextStyle(color: Color(0xFF6B7280))),
                ),
              ...parents.map((row) {
                final parent = Map<String, dynamic>.from(row as Map);
                final name = parent['name'] as String? ?? 'Γονέας';
                final students = (parent['students'] as List?)?.map((item) => '$item').where((item) => item.isNotEmpty).join(', ') ?? '';
                return ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFF3E8F7),
                    child: Icon(Icons.person_outline, color: brandPurple),
                  ),
                  title: Text(name),
                  subtitle: students.isEmpty ? null : Text(students),
                  onTap: () => _start(context, sheetContext, ref, asAdmin: asAdmin, parentId: parent['id'] as String?, title: name),
                );
              }),
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
    required bool asAdmin,
    required String? parentId,
    required String title,
  }) async {
    Navigator.pop(sheetContext);
    if (parentId == null) return;
    try {
      final id = await openScopedConversation(
        ref,
        schoolId: schoolId,
        kind: asAdmin ? 'admin' : 'teacher',
        withUserId: parentId,
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
            subtitle: 'Γονέας',
            currentUserId: userId,
          ),
        ),
      );
      ref.invalidate(conversationsProvider(schoolId));
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $error')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asAdmin = ref.watch(authProvider).user?.isSchoolAdmin ?? false;
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
        onPressed: () => _newMessage(context, ref, asAdmin: asAdmin),
        backgroundColor: brandPurple,
        icon: const Icon(Icons.edit_outlined, color: Colors.white),
        label: const Text('Νέο μήνυμα', style: TextStyle(color: Colors.white)),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Text(
              asAdmin
                  ? 'Επικοινωνία με τους γονείς. Οι συνομιλίες με τη δασκάλα δεν εμφανίζονται εδώ.'
                  : 'Μηνύματα από τους γονείς των παιδιών της τάξης σας.',
              style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
            ),
          ),
          Expanded(
            child: convsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: brandPurple)),
              error: (e, _) => Center(child: Text('Σφάλμα: $e')),
              data: (convs) => convs.isEmpty
                  ? const Center(child: Text('Δεν υπάρχουν μηνύματα', style: TextStyle(color: Color(0xFF9CA3AF))))
                  : RefreshIndicator(
                      onRefresh: () => ref.refresh(conversationsProvider(schoolId).future),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
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
          ),
        ],
      ),
    );
  }
}
