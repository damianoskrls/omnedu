import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../messages/conversation_ui.dart';

final parentMeetingsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  try {
    final resp = await dio.get('/schools/$schoolId/parent-meetings');
    return resp.data is List ? resp.data as List<dynamic> : [];
  } catch (_) {
    return [];
  }
});

String meetingDay(dynamic raw) {
  final text = raw?.toString() ?? '';
  final day = text.length >= 10 ? text.substring(0, 10) : text;
  final parts = day.split('-');
  if (parts.length != 3) return day;
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

Map<String, dynamic>? acceptedMeetingFor(List<dynamic> meetings, String? studentId) {
  if (studentId == null || studentId.isEmpty) return null;
  for (final raw in meetings) {
    if (raw is! Map) continue;
    final meeting = Map<String, dynamic>.from(raw);
    final requests = meeting['requests'] as List? ?? [];
    for (final item in requests) {
      if (item is! Map) continue;
      if (item['studentId']?.toString() == studentId && item['status'] == 'accepted') {
        return {...meeting, 'acceptedSlot': item['slotTime']?.toString() ?? ''};
      }
    }
  }
  return null;
}

class ParentMeetingsScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;
  final String studentId;
  final String studentName;
  final String? meetingId;
  const ParentMeetingsScreen({
    super.key,
    required this.schoolId,
    required this.classId,
    required this.className,
    required this.studentId,
    required this.studentName,
    this.meetingId,
  });

  @override
  ConsumerState<ParentMeetingsScreen> createState() => _ParentMeetingsScreenState();
}

class _ParentMeetingsScreenState extends ConsumerState<ParentMeetingsScreen> {
  List<Map<String, dynamic>> _meetings = [];
  List<Map<String, dynamic>> _children = [];
  late String _studentId;
  late String _studentName;
  bool _loading = true;
  String? _sending;

  @override
  void initState() {
    super.initState();
    _studentId = widget.studentId;
    _studentName = widget.studentName;
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/parent-meetings',
        queryParameters: widget.classId.isEmpty ? null : {'classId': widget.classId},
      );
      final list = resp.data is List ? resp.data as List : [];
      _meetings = list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
      _meetings.sort((a, b) {
        if (a['id'] == widget.meetingId) return -1;
        if (b['id'] == widget.meetingId) return 1;
        return 0;
      });
      if (_studentId.isEmpty) {
        final childrenResp = await ref.read(dioProvider).get('/schools/${widget.schoolId}/students/my-children');
        final children = childrenResp.data is List ? childrenResp.data as List : [];
        _children = children.map((item) => Map<String, dynamic>.from(item as Map)).toList();
        if (_children.isNotEmpty) {
          _studentId = _children.first['id']?.toString() ?? '';
          _studentName = _children.first['fullName']?.toString() ?? _studentName;
        }
      }
      ref.invalidate(parentMeetingsProvider(widget.schoolId));
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _request(String meetingId, String slot) async {
    setState(() => _sending = '$meetingId-$slot');
    try {
      await ref.read(dioProvider).post('/schools/${widget.schoolId}/parent-meetings/$meetingId/requests', data: {
        'studentId': _studentId,
        'slotTime': slot,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Το αίτημα στάλθηκε στον εκπαιδευτικό.')));
      }
      await _load();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
    } finally {
      if (mounted) setState(() => _sending = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        title: const Text('Συναντήσεις'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  Text(_studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  if (_children.length > 1)
                    DropdownButton<String>(
                      value: _studentId,
                      items: _children
                          .map((child) => DropdownMenuItem(value: child['id']?.toString(), child: Text(child['fullName']?.toString() ?? '')))
                          .toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        final child = _children.firstWhere((item) => item['id']?.toString() == value);
                        setState(() {
                          _studentId = value;
                          _studentName = child['fullName']?.toString() ?? '';
                        });
                      },
                    ),
                  if (widget.className.isNotEmpty) Text(widget.className, style: const TextStyle(color: Color(0xFF77328D))),
                  const SizedBox(height: 12),
                  if (_meetings.isEmpty)
                    const Text('Δεν υπάρχει ανοιχτή ενημέρωση για αυτή την τάξη.')
                  else
                    ..._meetings.map(_card),
                ],
              ),
            ),
    );
  }

  Widget _card(Map<String, dynamic> meeting) {
    final requests = (meeting['requests'] as List? ?? []).whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
    Map<String, dynamic>? mine;
    for (final item in requests) {
      if (item['studentId']?.toString() == _studentId) mine = item;
    }
    final acceptedTimes = requests.where((item) => item['status'] == 'accepted').map((item) => item['slotTime']?.toString() ?? '').toSet();
    final teacher = meeting['teacher'];
    final teacherName = teacher is Map ? teacher['fullName']?.toString() ?? '' : '';
    final slots = (meeting['slots'] as List? ?? []).map((item) => item.toString()).toList();
    final accepted = mine != null && mine['status'] == 'accepted';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(meeting['title']?.toString() ?? 'Ενημέρωση', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 4),
          Text('${meetingDay(meeting['meetingDate'])}${teacherName.isEmpty ? '' : ' · $teacherName'}'),
          if ((meeting['description']?.toString() ?? '').isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(meeting['description'].toString())),
          const SizedBox(height: 10),
          if (accepted)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(12)),
              child: Text(
                'Επερχόμενη συνάντηση: ${meetingDay(meeting['meetingDate'])} στις ${mine['slotTime']} με ${teacherName.isEmpty ? 'τον εκπαιδευτικό' : teacherName}.',
                style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF047857)),
              ),
            )
          else if (slots.isEmpty)
            const Text('Ο εκπαιδευτικός δεν έχει ανοίξει ώρες για κράτηση.')
          else ...[
            if (mine != null && mine['status'] == 'requested')
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text('Ζήτησες ${mine['slotTime']}. Περιμένει αποδοχή.', style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
              ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: slots.map((slot) {
                final taken = acceptedTimes.contains(slot) && mine?['slotTime'] != slot;
                final selected = mine?['slotTime'] == slot && mine?['status'] == 'requested';
                return ChoiceChip(
                  label: Text(taken ? '$slot κλεισμένη' : slot),
                  selected: selected,
                  onSelected: taken || _sending != null ? null : (_) => _request(meeting['id'].toString(), slot),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}
