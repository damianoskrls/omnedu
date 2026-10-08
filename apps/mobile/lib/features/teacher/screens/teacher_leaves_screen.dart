import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/utils/system_insets.dart';

final teacherLeavesProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/staff/me/leaves');
  final data = resp.data;
  return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
});

class TeacherLeavesScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const TeacherLeavesScreen({super.key, required this.schoolId});

  @override
  ConsumerState<TeacherLeavesScreen> createState() => _TeacherLeavesScreenState();
}

class _TeacherLeavesScreenState extends ConsumerState<TeacherLeavesScreen> {
  String _type = 'annual';
  DateTime? _start;
  DateTime? _end;
  final _notes = TextEditingController();
  bool _sending = false;
  String _error = '';

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pick(bool start) async {
    final initial = (start ? _start : _end) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 400)),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _start = picked;
        if (_end != null && _end!.isBefore(picked)) _end = picked;
      } else {
        _end = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (_start == null || _end == null) {
      setState(() => _error = 'Διάλεξε από και έως.');
      return;
    }
    setState(() {
      _sending = true;
      _error = '';
    });
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/schools/${widget.schoolId}/staff/me/leaves', data: {
        'leaveType': _type,
        'startDate': _iso(_start!),
        'endDate': _iso(_end!),
        'notes': _notes.text.trim(),
      });
      _notes.clear();
      setState(() {
        _start = null;
        _end = null;
        _type = 'annual';
      });
      ref.invalidate(teacherLeavesProvider(widget.schoolId));
    } catch (error) {
      setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final leaves = ref.watch(teacherLeavesProvider(widget.schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: const Text('Άδειες')),
      body: leaves.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Οι άδειες δεν φορτώθηκαν.')),
        data: (data) {
          final requests = (data['requests'] as List?) ?? const [];
          final remaining = data['remaining'] ?? 0;
          final entitlement = data['entitlement'] ?? 0;
          final used = data['usedDays'] ?? 0;
          final pending = data['pendingDays'] ?? 0;
          return ListView(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF77328D), Color(0xFFE95926)]),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Υπόλοιπο κανονικής άδειας', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('$remaining ημέρες', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text('Δικαιούσαι $entitlement · χρησιμοποιήθηκαν $used · σε αναμονή $pending', style: const TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('Νέο αίτημα', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                key: ValueKey(_type),
                initialValue: _type,
                decoration: const InputDecoration(labelText: 'Είδος', filled: true, fillColor: Colors.white),
                items: const [
                  DropdownMenuItem(value: 'annual', child: Text('Κανονική')),
                  DropdownMenuItem(value: 'sick', child: Text('Ασθένεια')),
                  DropdownMenuItem(value: 'maternity', child: Text('Μητρότητα')),
                  DropdownMenuItem(value: 'other', child: Text('Άλλη')),
                ],
                onChanged: (value) => setState(() => _type = value ?? 'annual'),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: () => _pick(true), child: Text(_start == null ? 'Από' : _label(_start!)))),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton(onPressed: () => _pick(false), child: Text(_end == null ? 'Έως' : _label(_end!)))),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _notes,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Σημείωση', filled: true, fillColor: Colors.white),
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(_error, style: const TextStyle(color: Color(0xFFB42318))),
              ],
              const SizedBox(height: 8),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D)),
                onPressed: _sending ? null : _submit,
                child: Text(_sending ? 'Αποστολή...' : 'Υποβολή και αναμονή έγκρισης'),
              ),
              const SizedBox(height: 20),
              const Text('Τα αιτήματά μου', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
              const SizedBox(height: 8),
              if (requests.isEmpty)
                const Text('Δεν έχεις αιτήματα άδειας.', style: TextStyle(color: Color(0xFF8A756C)))
              else
                for (final raw in requests)
                  if (raw is Map) _LeaveCard(leave: Map<String, dynamic>.from(raw)),
            ],
          );
        },
      ),
    );
  }
}

class _LeaveCard extends StatelessWidget {
  final Map<String, dynamic> leave;
  const _LeaveCard({required this.leave});

  @override
  Widget build(BuildContext context) {
    final status = leave['status']?.toString() ?? 'pending';
    final label = switch (status) {
      'approved' => 'Εγκρίθηκε',
      'rejected' => 'Απορρίφθηκε',
      _ => 'Αναμονή έγκρισης',
    };
    final color = switch (status) {
      'approved' => const Color(0xFF067647),
      'rejected' => const Color(0xFFB42318),
      _ => const Color(0xFFB54708),
    };
    final type = switch (leave['leaveType']?.toString()) {
      'sick' => 'Ασθένεια',
      'maternity' => 'Μητρότητα',
      'other' => 'Άλλη',
      _ => 'Κανονική',
    };
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0E6F4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$type · $label', style: TextStyle(fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 4),
          Text('${_short(leave['startDate'])} – ${_short(leave['endDate'])}', style: const TextStyle(color: Color(0xFF2C2422))),
          if ((leave['notes']?.toString() ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(leave['notes'].toString(), style: const TextStyle(color: Color(0xFF6B625C))),
            ),
        ],
      ),
    );
  }
}

String _iso(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

String _label(DateTime date) => '${date.day}/${date.month}/${date.year}';

String _short(dynamic value) {
  final date = DateTime.tryParse(value?.toString() ?? '');
  if (date == null) return '';
  return '${date.day}/${date.month}/${date.year}';
}

String _message(Object error) {
  final dynamic data = (error as dynamic).response?.data;
  if (data is Map && data['message'] is String) return data['message'] as String;
  return 'Το αίτημα δεν στάλθηκε.';
}
