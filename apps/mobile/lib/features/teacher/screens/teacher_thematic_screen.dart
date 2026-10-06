import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

class TeacherThematicScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;
  const TeacherThematicScreen({
    super.key,
    required this.schoolId,
    required this.classId,
    required this.className,
  });

  @override
  ConsumerState<TeacherThematicScreen> createState() => _TeacherThematicScreenState();
}

class _TeacherThematicScreenState extends ConsumerState<TeacherThematicScreen> {
  late String _month;
  final _title = TextEditingController(text: 'Διαθεματικό');
  final _greeting = TextEditingController(text: 'Αγαπημένοι μας γονείς,');
  final _intro = TextEditingController();
  final _goals = TextEditingController();
  final _extras = TextEditingController();
  final _closing = TextEditingController();
  final _signature = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    _load();
  }

  @override
  void dispose() {
    for (final c in [_title, _greeting, _intro, _goals, _extras, _closing, _signature]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dio = ref.read(dioProvider);
      final resp = await dio.get(
        '/schools/${widget.schoolId}/thematic-plans',
        queryParameters: {'classId': widget.classId, 'month': _month},
      );
      final list = resp.data is List ? resp.data as List : [];
      if (list.isNotEmpty) {
        final plan = list.first as Map;
        _title.text = plan['title'] as String? ?? _title.text;
        _greeting.text = plan['greeting'] as String? ?? _greeting.text;
        _intro.text = plan['introduction'] as String? ?? '';
        _goals.text = plan['goals'] as String? ?? '';
        _extras.text = plan['extras'] as String? ?? '';
        _closing.text = plan['closing'] as String? ?? '';
        _signature.text = plan['signature'] as String? ?? '';
      } else {
        _intro.clear();
        _goals.clear();
        _extras.clear();
        _closing.clear();
        _signature.clear();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/schools/${widget.schoolId}/thematic-plans', data: {
        'classId': widget.classId,
        'month': _month,
        'title': _title.text.trim(),
        'greeting': _greeting.text.trim(),
        'introduction': _intro.text.trim(),
        'goals': _goals.text.trim(),
        'extras': _extras.text.trim(),
        'closing': _closing.text.trim(),
        'signature': _signature.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Το διαθεματικό αποθηκεύτηκε.')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Διαθεματικό · ${widget.className}')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                DropdownButtonFormField<String>(
                  value: _month,
                  decoration: const InputDecoration(labelText: 'Μήνας'),
                  items: List.generate(12, (i) {
                    final now = DateTime.now();
                    final date = DateTime(now.year, now.month - 1 + i, 1);
                    final value = '${date.year}-${date.month.toString().padLeft(2, '0')}';
                    return DropdownMenuItem(value: value, child: Text(value));
                  }),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _month = v);
                    _load();
                  },
                ),
                const SizedBox(height: 12),
                TextField(controller: _title, decoration: const InputDecoration(labelText: 'Τίτλος')),
                TextField(controller: _greeting, decoration: const InputDecoration(labelText: 'Χαιρετισμός')),
                TextField(controller: _intro, maxLines: 4, decoration: const InputDecoration(labelText: 'Εισαγωγή')),
                TextField(controller: _goals, maxLines: 5, decoration: const InputDecoration(labelText: 'Στόχοι (μία γραμμή ο καθένας)')),
                TextField(controller: _extras, maxLines: 4, decoration: const InputDecoration(labelText: 'Επιπλέον')),
                TextField(controller: _closing, maxLines: 3, decoration: const InputDecoration(labelText: 'Κλείσιμο')),
                TextField(controller: _signature, decoration: const InputDecoration(labelText: 'Υπογραφή')),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'Αποθήκευση...' : 'Αποθήκευση μήνα'),
                ),
              ],
            ),
    );
  }
}
