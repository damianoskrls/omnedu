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
  static const _purple = Color(0xFF77328D);

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
  String _clock(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

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
        queryParameters: {'classId': widget.classId, 'upcoming': 'true'},
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
        _note.clear();
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
    setState(() => start ? _from = picked : _until = picked);
  }

  void _openEditSheet(Map<String, dynamic> meeting) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _EditMeetingSheet(
        schoolId: widget.schoolId,
        meeting: meeting,
        onSaved: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: Text('Συναντήσεις · ${widget.className}')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
        children: [
          _NewMeetingCard(
            title: _title,
            note: _note,
            day: _day,
            duration: _duration,
            from: _from,
            until: _until,
            saving: _saving,
            onPickDay: _pickDay,
            onPickFrom: () => _pickTime(true),
            onPickUntil: () => _pickTime(false),
            onDuration: (v) => setState(() => _duration = v ?? 15),
            onPretty: _pretty,
            onClock: _clock,
            onDayKey: _dayKey,
            onCreate: _create,
          ),
          const SizedBox(height: 24),
          if (_loading)
            const Center(child: CircularProgressIndicator(color: _purple))
          else if (_meetings.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Δεν υπάρχουν προγραμματισμένες ενημερώσεις.', style: TextStyle(color: Color(0xFF6B7280))),
            )
          else ...[
            const Text('Προγραμματισμένες ενημερώσεις', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            ..._meetings.map((m) => _MeetingScheduleCard(
              meeting: m,
              onDecide: _decide,
              onEdit: () => _openEditSheet(m),
              pretty: _pretty,
            )),
          ],
        ],
      ),
    );
  }
}

// ─── Νέα ενημέρωση ─────────────────────────────────────────────────────────

class _NewMeetingCard extends StatelessWidget {
  final TextEditingController title;
  final TextEditingController note;
  final DateTime day;
  final int duration;
  final TimeOfDay from;
  final TimeOfDay until;
  final bool saving;
  final VoidCallback onPickDay;
  final VoidCallback onPickFrom;
  final VoidCallback onPickUntil;
  final ValueChanged<int?> onDuration;
  final String Function(dynamic) onPretty;
  final String Function(TimeOfDay) onClock;
  final String Function(DateTime) onDayKey;
  final VoidCallback onCreate;

  const _NewMeetingCard({
    required this.title, required this.note, required this.day, required this.duration,
    required this.from, required this.until, required this.saving,
    required this.onPickDay, required this.onPickFrom, required this.onPickUntil,
    required this.onDuration, required this.onPretty, required this.onClock,
    required this.onDayKey, required this.onCreate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Νέα ενημέρωση γονέων', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 12),
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Θέμα')),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _InfoTile(label: 'Ημέρα', value: onPretty(onDayKey(day)), icon: Icons.calendar_month, onTap: onPickDay)),
            const SizedBox(width: 8),
            Expanded(child: DropdownButtonFormField<int>(
              value: duration,
              isDense: true,
              decoration: const InputDecoration(labelText: 'Διάρκεια', isDense: true),
              items: const [10, 15, 20, 30].map((m) => DropdownMenuItem(value: m, child: Text('$m λεπτά'))).toList(),
              onChanged: onDuration,
            )),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _InfoTile(label: 'Από', value: onClock(from), icon: Icons.access_time, onTap: onPickFrom)),
            const SizedBox(width: 8),
            Expanded(child: _InfoTile(label: 'Έως', value: onClock(until), icon: Icons.access_time_filled, onTap: onPickUntil)),
          ]),
          const SizedBox(height: 8),
          TextField(controller: note, maxLines: 2, decoration: const InputDecoration(labelText: 'Σημείωση (προαιρετικό)')),
          const SizedBox(height: 12),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D), minimumSize: const Size.fromHeight(44)),
            onPressed: saving ? null : onCreate,
            child: Text(saving ? 'Αποστολή...' : 'Αποστολή στους γονείς'),
          ),
        ],
      ),
    );
  }
}

// ─── Schedule card ανά meeting ──────────────────────────────────────────────

class _MeetingScheduleCard extends StatefulWidget {
  final Map<String, dynamic> meeting;
  final Future<void> Function(String meetingId, String requestId, String status) onDecide;
  final VoidCallback onEdit;
  final String Function(dynamic) pretty;

  const _MeetingScheduleCard({required this.meeting, required this.onDecide, required this.onEdit, required this.pretty});

  @override
  State<_MeetingScheduleCard> createState() => _MeetingScheduleCardState();
}

class _MeetingScheduleCardState extends State<_MeetingScheduleCard> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    final meeting = widget.meeting;
    final slots = List<String>.from(meeting['slots'] as List? ?? []);
    final requests = (meeting['requests'] as List? ?? []).whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList();

    final requestBySlot = <String, Map<String, dynamic>>{};
    for (final r in requests) {
      final slot = r['slotTime']?.toString() ?? '';
      if (slot.isNotEmpty) requestBySlot[slot] = r;
    }

    final pendingCount = requests.where((r) => r['status'] == 'requested').length;
    final acceptedCount = requests.where((r) => r['status'] == 'accepted').length;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          // Header
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(meeting['title']?.toString() ?? 'Ενημέρωση', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        const SizedBox(height: 2),
                        Text(
                          '${widget.pretty(meeting['meetingDate'])} · ${meeting['windowStart'] ?? ''}–${meeting['windowEnd'] ?? ''} · ${meeting['durationMinutes'] ?? 15} λεπτά',
                          style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                        ),
                        if (pendingCount > 0 || acceptedCount > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Row(children: [
                              if (acceptedCount > 0) _Chip(label: '$acceptedCount κλεισμένα', color: const Color(0xFF16A34A)),
                              if (acceptedCount > 0 && pendingCount > 0) const SizedBox(width: 6),
                              if (pendingCount > 0) _Chip(label: '$pendingCount αναμένουν', color: const Color(0xFFD97706)),
                            ]),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 20, color: Color(0xFF77328D)),
                    tooltip: 'Αλλαγή',
                    onPressed: widget.onEdit,
                  ),
                  Icon(_expanded ? Icons.expand_less : Icons.expand_more, color: const Color(0xFF6B7280)),
                ],
              ),
            ),
          ),

          // Schedule grid
          if (_expanded) ...[
            const Divider(height: 1),
            if (slots.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Δεν υπάρχουν διαθέσιμα slots.', style: TextStyle(color: Color(0xFF6B7280))),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: slots.length,
                separatorBuilder: (_, __) => const Divider(height: 1, indent: 16, endIndent: 16),
                itemBuilder: (_, i) {
                  final slot = slots[i];
                  final req = requestBySlot[slot];
                  return _SlotRow(
                    slot: slot,
                    request: req,
                    meetingId: meeting['id']?.toString() ?? '',
                    onDecide: widget.onDecide,
                  );
                },
              ),
          ],
        ],
      ),
    );
  }
}

// ─── Μία γραμμή slot ────────────────────────────────────────────────────────

class _SlotRow extends StatelessWidget {
  final String slot;
  final Map<String, dynamic>? request;
  final String meetingId;
  final Future<void> Function(String meetingId, String requestId, String status) onDecide;

  const _SlotRow({required this.slot, required this.request, required this.meetingId, required this.onDecide});

  @override
  Widget build(BuildContext context) {
    final status = request?['status']?.toString();
    final name = request?['studentName']?.toString() ?? '';

    Color dotColor;
    String label;
    if (status == 'accepted') {
      dotColor = const Color(0xFF16A34A);
      label = name.isNotEmpty ? name : 'Κλεισμένο';
    } else if (status == 'requested') {
      dotColor = const Color(0xFFD97706);
      label = name.isNotEmpty ? '$name — αναμένει' : 'Αναμένει';
    } else if (status == 'declined') {
      dotColor = const Color(0xFF9CA3AF);
      label = 'Απορρίφθηκε';
    } else {
      dotColor = const Color(0xFFD1D5DB);
      label = 'Ελεύθερο';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Text(slot, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                color: (status == 'declined' || status == null) ? const Color(0xFF9CA3AF) : null,
                decoration: status == 'declined' ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          if (status == 'requested' && request != null) ...[
            _ActionBtn(label: 'Αποδοχή', color: const Color(0xFF16A34A), onTap: () => onDecide(meetingId, request!['id'].toString(), 'accepted')),
            const SizedBox(width: 6),
            _ActionBtn(label: 'Άρνηση', color: const Color(0xFFDC2626), onTap: () => onDecide(meetingId, request!['id'].toString(), 'declined')),
          ],
        ],
      ),
    );
  }
}

// ─── Edit bottom sheet ───────────────────────────────────────────────────────

class _EditMeetingSheet extends ConsumerStatefulWidget {
  final String schoolId;
  final Map<String, dynamic> meeting;
  final VoidCallback onSaved;

  const _EditMeetingSheet({required this.schoolId, required this.meeting, required this.onSaved});

  @override
  ConsumerState<_EditMeetingSheet> createState() => _EditMeetingSheetState();
}

class _EditMeetingSheetState extends ConsumerState<_EditMeetingSheet> {
  late final TextEditingController _title;
  late final TextEditingController _note;
  late DateTime _day;
  late int _duration;
  late TimeOfDay _from;
  late TimeOfDay _until;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final m = widget.meeting;
    _title = TextEditingController(text: m['title']?.toString() ?? '');
    _note = TextEditingController(text: m['description']?.toString() ?? '');
    final dateStr = m['meetingDate']?.toString() ?? '';
    final datePart = dateStr.length >= 10 ? dateStr.substring(0, 10) : '';
    _day = datePart.isNotEmpty ? DateTime.tryParse('${datePart}T12:00:00') ?? DateTime.now().add(const Duration(days: 7)) : DateTime.now().add(const Duration(days: 7));
    _duration = (m['durationMinutes'] as num?)?.toInt() ?? 15;
    _from = _parseTime(m['windowStart']?.toString());
    _until = _parseTime(m['windowEnd']?.toString());
  }

  @override
  void dispose() {
    _title.dispose();
    _note.dispose();
    super.dispose();
  }

  TimeOfDay _parseTime(String? raw) {
    if (raw == null || raw.length < 5) return const TimeOfDay(hour: 16, minute: 0);
    final parts = raw.split(':');
    if (parts.length < 2) return const TimeOfDay(hour: 16, minute: 0);
    return TimeOfDay(hour: int.tryParse(parts[0]) ?? 16, minute: int.tryParse(parts[1]) ?? 0);
  }

  String _dayKey(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  String _clock(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  String _pretty(DateTime d) {
    final parts = _dayKey(d).split('-');
    return '${parts[2]}/${parts[1]}/${parts[0]}';
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
    setState(() => start ? _from = picked : _until = picked);
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(dioProvider).patch(
        '/schools/${widget.schoolId}/parent-meetings/${widget.meeting['id']}',
        data: {
          'title': _title.text.trim(),
          'description': _note.text.trim(),
          'meetingDate': _dayKey(_day),
          'windowStart': _clock(_from),
          'windowEnd': _clock(_until),
          'durationMinutes': _duration,
        },
      );
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Οι αλλαγές αποθηκεύτηκαν. Οι γονείς ειδοποιήθηκαν.')));
        widget.onSaved();
      }
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 20, 16, 24 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Expanded(child: Text('Αλλαγή ενημέρωσης', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17))),
            IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
          ]),
          const SizedBox(height: 4),
          const Text(
            'Αν αλλάξεις ημέρα ή ώρα, οι γονείς που έχουν κλείσει ώρα θα ειδοποιηθούν.',
            style: TextStyle(color: Color(0xFF6B7280), fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Θέμα')),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _InfoTile(label: 'Ημέρα', value: _pretty(_day), icon: Icons.calendar_month, onTap: _pickDay)),
            const SizedBox(width: 8),
            Expanded(child: DropdownButtonFormField<int>(
              value: _duration,
              isDense: true,
              decoration: const InputDecoration(labelText: 'Διάρκεια', isDense: true),
              items: const [10, 15, 20, 30].map((m) => DropdownMenuItem(value: m, child: Text('$m λεπτά'))).toList(),
              onChanged: (v) => setState(() => _duration = v ?? _duration),
            )),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _InfoTile(label: 'Από', value: _clock(_from), icon: Icons.access_time, onTap: () => _pickTime(true))),
            const SizedBox(width: 8),
            Expanded(child: _InfoTile(label: 'Έως', value: _clock(_until), icon: Icons.access_time_filled, onTap: () => _pickTime(false))),
          ]),
          const SizedBox(height: 8),
          TextField(controller: _note, maxLines: 2, decoration: const InputDecoration(labelText: 'Σημείωση (προαιρετικό)')),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D), minimumSize: const Size.fromHeight(44)),
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Αποθήκευση...' : 'Αποθήκευση αλλαγών'),
          ),
        ],
      ),
    );
  }
}

// ─── Βοηθητικά widgets ───────────────────────────────────────────────────────

class _InfoTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  const _InfoTile({required this.label, required this.value, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, isDense: true, suffixIcon: Icon(icon, size: 18)),
        child: Text(value, style: const TextStyle(fontSize: 14)),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;

  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionBtn({required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
      ),
    );
  }
}
