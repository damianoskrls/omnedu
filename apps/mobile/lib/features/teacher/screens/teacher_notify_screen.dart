import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class TeacherNotifyScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String teacherId;
  const TeacherNotifyScreen({
    super.key,
    required this.schoolId,
    required this.classId,
    required this.teacherId,
  });

  @override
  ConsumerState<TeacherNotifyScreen> createState() => _TeacherNotifyScreenState();
}

class _TeacherNotifyScreenState extends ConsumerState<TeacherNotifyScreen> {
  List<Map<String, dynamic>> _students = [];
  String? _studentId;
  final _message = TextEditingController();
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/${widget.schoolId}/students', queryParameters: {'classId': widget.classId});
    final list = resp.data is List ? resp.data as List : [];
    setState(() {
      _students = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      _loading = false;
    });
  }

  List<String> _parentIds(Map<String, dynamic>? student) {
    if (student == null) {
      final ids = <String>{};
      for (final s in _students) {
        ids.addAll(_parentIds(s));
      }
      return ids.toList();
    }
    final parents = student['parents'] as List? ?? [];
    return parents
        .map((p) => (p as Map)['user']?['id'] as String?)
        .whereType<String>()
        .toList();
  }

  Future<void> _send({required bool everyone}) async {
    final text = _message.text.trim();
    if (text.isEmpty) return;
    Map<String, dynamic>? selected;
    for (final student in _students) {
      if (student['id'] == _studentId) selected = student;
    }
    final targets = everyone ? _parentIds(null) : _parentIds(selected);
    if (targets.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Δεν βρέθηκαν γονείς.')));
      return;
    }
    setState(() => _sending = true);
    try {
      final dio = ref.read(dioProvider);
      for (final parentId in targets) {
        final conv = await dio.post('/schools/${widget.schoolId}/conversations', data: {
          'participantIds': [widget.teacherId, parentId],
        });
        final id = (conv.data as Map)['id'];
        await dio.post('/schools/${widget.schoolId}/conversations/$id/messages', data: {'body': text});
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Στάλθηκε σε ${targets.length} γονείς.')));
        _message.clear();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $e')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ενημέρωση γονέων')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Στείλτε μήνυμα σε όλους τους γονείς της τάξης ή σε έναν γονέα.',
                  style: TextStyle(color: Color(0xFF4B5563)),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _studentId,
                  decoration: const InputDecoration(labelText: 'Συγκεκριμένος μαθητής'),
                  items: _students
                      .map((s) => DropdownMenuItem(value: s['id'] as String, child: Text(s['fullName'] as String? ?? '')))
                      .toList(),
                  onChanged: (v) => setState(() => _studentId = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _message,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    labelText: 'Μήνυμα',
                    alignLabelWithHint: true,
                    hintText: 'π.χ. Αύριο φέρτε καπέλο για την εκδρομή.',
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _sending || _studentId == null ? null : () => _send(everyone: false),
                  child: const Text('Στον γονέα του μαθητή'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _sending ? null : () => _send(everyone: true),
                  child: Text(_sending ? 'Αποστολή...' : 'Σε όλους τους γονείς της τάξης'),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Φωτογραφίες και βίντεο μετά από εκδρομή ανεβαίνουν από την καρτέλα Εκδηλώσεις, στην εκδρομή.',
                  style: TextStyle(color: Color(0xFF6B7280)),
                ),
              ],
            ),
    );
  }
}
