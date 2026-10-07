import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/utils/system_insets.dart';

class TeacherThematicScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;
  final String? initialMonth;
  const TeacherThematicScreen({
    super.key,
    required this.schoolId,
    required this.classId,
    required this.className,
    this.initialMonth,
  });

  @override
  ConsumerState<TeacherThematicScreen> createState() => _TeacherThematicScreenState();
}

class _TeacherThematicScreenState extends ConsumerState<TeacherThematicScreen> {
  late String _month;
  String? _throughMonth;
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
    _month = widget.initialMonth ?? '${now.year}-${now.month.toString().padLeft(2, '0')}';
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
        final through = plan['throughMonth'] as String?;
        _throughMonth = through != null && through.isNotEmpty ? through : null;
      } else {
        _intro.clear();
        _goals.clear();
        _extras.clear();
        _closing.clear();
        _signature.clear();
        _throughMonth = null;
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
        'throughMonth': _throughMonth,
        'title': _title.text.trim(),
        'greeting': _greeting.text.trim(),
        'introduction': _intro.text.trim(),
        'goals': _goals.text.trim(),
        'extras': _extras.text.trim(),
        'closing': _closing.text.trim(),
        'signature': _signature.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Το διαθεματικό αποθηκεύτηκε. Οι γονείς της τάξης ειδοποιούνται.')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(TextEditingController controller, String label, {int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label, alignLabelWithHint: maxLines > 1),
      ),
    );
  }

  List<String> get _monthChoices {
    final now = DateTime.now();
    final values = List.generate(12, (i) {
      final date = DateTime(now.year, now.month - 1 + i, 1);
      return '${date.year}-${date.month.toString().padLeft(2, '0')}';
    });
    if (!values.contains(_month)) values.insert(0, _month);
    if (_throughMonth != null && !values.contains(_throughMonth)) values.add(_throughMonth!);
    return values;
  }

  String _label(String ym) {
    const names = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    final parts = ym.split('-');
    final month = int.tryParse(parts.length > 1 ? parts[1] : '') ?? 1;
    return '${names[month - 1]} ${parts[0]}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: Text('Διαθεματικό · ${widget.className}')),
      bottomNavigationBar: _loading
          ? null
          : Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + systemBottomInset(context)),
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF77328D),
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Αποθήκευση...' : 'Αποθήκευση μήνα'),
              ),
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
              children: [
                DropdownButtonFormField<String>(
                  value: _month,
                  decoration: const InputDecoration(labelText: 'Μήνας'),
                  items: _monthChoices.map((value) => DropdownMenuItem(value: value, child: Text(_label(value)))).toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _month = v);
                    _load();
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _throughMonth ?? '',
                  decoration: const InputDecoration(labelText: 'Έως (προαιρετικά)'),
                  items: [
                    const DropdownMenuItem(value: '', child: Text('Μόνο αυτός ο μήνας')),
                    ..._monthChoices.map((value) => DropdownMenuItem(value: value, child: Text(_label(value)))),
                  ],
                  onChanged: (v) => setState(() => _throughMonth = v == null || v.isEmpty ? null : v),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Με την αποθήκευση ειδοποιούνται οι γονείς της τάξης.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 12),
                _field(_title, 'Τίτλος'),
                _field(_greeting, 'Χαιρετισμός'),
                _field(_intro, 'Εισαγωγή', maxLines: 4),
                _field(_goals, 'Στόχοι (μία γραμμή ο καθένας)', maxLines: 5),
                _field(_extras, 'Επιπλέον', maxLines: 4),
                _field(_closing, 'Κλείσιμο', maxLines: 3),
                _field(_signature, 'Υπογραφή'),
              ],
            ),
    );
  }
}
