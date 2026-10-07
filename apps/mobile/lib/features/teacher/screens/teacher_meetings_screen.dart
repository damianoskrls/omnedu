import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/utils/system_insets.dart';
import '../../messages/conversation_ui.dart';

class TeacherMeetingsScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;
  const TeacherMeetingsScreen({super.key, required this.schoolId, required this.classId, required this.className});

  @override
  ConsumerState<TeacherMeetingsScreen> createState() => _TeacherMeetingsScreenState();
}

class _TeacherMeetingsScreenState extends ConsumerState<TeacherMeetingsScreen> {
  final _title = TextEditingController(text: 'Ενημέρωση γονέων');
  final _note = TextEditingController();
  DateTime _day = DateTime.now().add(const Duration(days: 7));
  int _duration = 15;
  TimeOfDay _from = const TimeOfDay(hour: 16, minute: 0);
  TimeOfDay _until = const TimeOfDay(hour: 19, minute: 0);
  List<Map<String, dynamic>> _meetings = [];
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _title.dispose();
    _note.dispose();
    super.dispose();
  }

  String _dayKey(DateTime date) => '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String _clock(TimeOfDay time) => '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

  String _pretty(dynamic raw) {
    final text = raw?.toString() ?? '';
    final day = text.length >= 10 ? text.substring(0, 10) : text;
    final parts = day.split('-');
    if (parts.length != 3) return day;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/parent-meetings',
        queryParameters: {'classId': widget.classId},
      );
      final list = resp.data is List ? resp.data as List : [];
      _meetings = list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _create() async {
    if (_title.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/parent-meetings', data: {
        'classId': widget.classId,
        'title': _title.text.trim(),
        'description': _note.text.trim(),
        'meetingDate': _dayKey(_day),
        'durationMinutes': _duration,
        'windowStart': _clock(_from),
        'windowEnd': _clock(_until),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η ενημέρωση στάλθηκε στους γονείς.')));
      }
      await _load();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _decide(String meetingId, String requestId, String status) async {
    try {
      await ref.read(dioProvider).patch(
        '/schools/${widget.schoolId}/parent-meetings/$meetingId/requests/$requestId',
        data: {'status': status},
      );
      await _load();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
    }
  }

  Future<void> _pickDay() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _day = picked);
  }

  Future<void> _pickTime(bool start) async {
    final picked = await showTimePicker(context: context, initialTime: start ? _from : _until);
    if (picked == null) return;
    setState(() {
      if (start) {
        _from = picked;
      } else {
        _until = picked;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: Text('Συναντήσεις · ${widget.className}')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
        children: [
          const Text('Όρισε την ημέρα, τη διάρκεια και τις ώρες. Οι γονείς ειδοποιούνται και ζητούν ώρα.'),
          const SizedBox(height: 12),
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Θέμα')),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Ημέρα'),
            subtitle: Text(_pretty(_dayKey(_day))),
            trailing: const Icon(Icons.calendar_month),
            onTap: _pickDay,
          ),
          DropdownButtonFormField<int>(
            value: _duration,
            decoration: const InputDecoration(labelText: 'Διάρκεια συνάντησης'),
            items: const [10, 15, 20, 30].map((minutes) => DropdownMenuItem(value: minutes, child: Text('$minutes λεπτά'))).toList(),
            onChanged: (value) => setState(() => _duration = value ?? 15),
          ),
          Row(
            children: [
              Expanded(child: ListTile(contentPadding: EdgeInsets.zero, title: const Text('Από'), subtitle: Text(_clock(_from)), onTap: () => _pickTime(true))),
              Expanded(child: ListTile(contentPadding: EdgeInsets.zero, title: const Text('Έως'), subtitle: Text(_clock(_until)), onTap: () => _pickTime(false))),
            ],
          ),
          TextField(controller: _note, maxLines: 2, decoration: const InputDecoration(labelText: 'Σημείωση')),
          const SizedBox(height: 12),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D), minimumSize: const Size.fromHeight(48)),
            onPressed: _saving ? null : _create,
            child: Text(_saving ? 'Αποστολή...' : 'Αποστολή στους γονείς'),
          ),
          const SizedBox(height: 24),
          const Text('Αιτήματα', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 8),
          if (_loading)
            const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
          else if (_meetings.isEmpty)
            const Text('Δεν έχεις ανοιχτή ενημέρωση για αυτή την τάξη.')
          else
            ..._meetings.map(_meetingCard),
        ],
      ),
    );
  }

  Widget _meetingCard(Map<String, dynamic> meeting) {
    final requests = (meeting['requests'] as List? ?? []).whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(meeting['title']?.toString() ?? 'Ενημέρωση', style: const TextStyle(fontWeight: FontWeight.w800)),
          Text('${_pretty(meeting['meetingDate'])} · ${meeting['windowStart'] ?? ''}–${meeting['windowEnd'] ?? ''} · ${meeting['durationMinutes'] ?? 15} λεπτά'),
          const SizedBox(height: 8),
          if (requests.isEmpty) const Text('Δεν έχει έρθει αίτημα ακόμα.', style: TextStyle(color: Color(0xFF6B7280))),
          ...requests.map((request) {
            final status = request['status']?.toString() ?? '';
            final label = status == 'accepted' ? 'Δεκτή' : status == 'declined' ? 'Απορρίφθηκε' : 'Αναμονή';
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  Expanded(child: Text('${request['studentName'] ?? 'Παιδί'} · ${request['slotTime']} · $label')),
                  if (status == 'requested') ...[
                    TextButton(onPressed: () => _decide(meeting['id'].toString(), request['id'].toString(), 'accepted'), child: const Text('Αποδοχή')),
                    TextButton(onPressed: () => _decide(meeting['id'].toString(), request['id'].toString(), 'declined'), child: const Text('Όχι')),
                  ],
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
