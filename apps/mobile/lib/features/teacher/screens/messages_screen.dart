import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../messages/conversation_ui.dart';

final teacherParentDetailsProvider = FutureProvider.family<Map<String, String>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final classesResp = await dio.get('/schools/$schoolId/classes/my-classes');
  final classes = classesResp.data is List ? classesResp.data as List : <dynamic>[];
  final details = <String, String>{};
  for (final klass in classes) {
    if (klass is! Map) continue;
    final classId = klass['id'] as String?;
    if (classId == null) continue;
    final className = klass['name'] as String? ?? '';
    final studentsResp = await dio.get('/schools/$schoolId/students', queryParameters: {'classId': classId});
    final students = studentsResp.data is List ? studentsResp.data as List : <dynamic>[];
    for (final student in students) {
      if (student is! Map) continue;
      final studentName = student['fullName'] as String? ?? '';
      final label = [studentName, className].where((part) => part.isNotEmpty).join(' · ');
      final parents = student['parents'] as List? ?? [];
      for (final parent in parents) {
        final id = (parent as Map)['user']?['id'] as String?;
        if (id == null || label.isEmpty) continue;
        final current = details[id];
        details[id] = current == null || current.contains(label) ? (current ?? label) : '$current, $label';
      }
    }
  }
  return details;
});

class TeacherMessagesScreen extends ConsumerWidget {
  final String schoolId;
  final String userId;
  const TeacherMessagesScreen({super.key, required this.schoolId, required this.userId});

  Future<List<Map<String, dynamic>>> _parents(WidgetRef ref) async {
    final dio = ref.read(dioProvider);
    try {
      final resp = await dio.get('/schools/$schoolId/conversations/contacts');
      if (resp.data is Map) {
        final rows = (resp.data['parents'] as List?) ?? [];
        return rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
      }
    } catch (_) {}
    final details = await ref.read(teacherParentDetailsProvider(schoolId).future);
    final studentsResp = await dio.get('/schools/$schoolId/students');
    final students = studentsResp.data is List ? studentsResp.data as List : <dynamic>[];
    final grouped = <String, Map<String, dynamic>>{};
    for (final student in students) {
      if (student is! Map) continue;
      for (final parent in (student['parents'] as List? ?? [])) {
        final user = (parent as Map)['user'] as Map?;
        final id = user?['id'] as String?;
        if (id == null) continue;
        grouped.putIfAbsent(id, () => {
          'id': id,
          'name': user?['fullName'] ?? 'Γονέας',
          'students': <String>[],
        });
        final label = details[id];
        final studentsOf = grouped[id]!['students'] as List<String>;
        if (label != null && !studentsOf.contains(label)) studentsOf.add(label);
      }
    }
    return grouped.values.toList();
  }

  Future<void> _newMessage(BuildContext context, WidgetRef ref, {required bool asAdmin}) async {
    List<Map<String, dynamic>> parents = [];
    try {
      parents = await _parents(ref);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
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
              ...parents.map((parent) {
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
        participantIds: [userId, parentId],
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asAdmin = ref.watch(authProvider).user?.isSchoolAdmin ?? false;
    final convsAsync = ref.watch(conversationsProvider(schoolId));
    final details = ref.watch(teacherParentDetailsProvider(schoolId)).asData?.value ?? const <String, String>{};

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
                          final parentId = otherParticipants(conv, userId)
                              .map((person) => person['userId'] ?? person['user']?['id'])
                              .whereType<String>()
                              .firstOrNull;
                          final localDetail = parentId == null ? null : details[parentId];
                          return ConversationTile(
                            conv: conv,
                            userId: userId,
                            detail: localDetail,
                            onTap: () => openChat(
                              context,
                              ref,
                              schoolId: schoolId,
                              userId: userId,
                              conv: conv,
                              subtitle: localDetail,
                            ),
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
