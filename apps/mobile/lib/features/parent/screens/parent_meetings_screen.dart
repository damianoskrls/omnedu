import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../messages/conversation_ui.dart';

final parentMeetingsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  try {
    final resp = await dio.get('/schools/$schoolId/parent-meetings', queryParameters: {'upcoming': 'true'});
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
  bool _showHistory = false;
  String? _sending;
  String? _pendingMeetingId;
  String? _pendingSlot;

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
      final params = <String, dynamic>{
        if (widget.classId.isNotEmpty) 'classId': widget.classId,
        if (!_showHistory) 'upcoming': 'true',
      };
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/parent-meetings',
        queryParameters: params.isEmpty ? null : params,
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
      if (mounted) setState(() {
        _sending = null;
        _pendingMeetingId = null;
        _pendingSlot = null;
      });
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
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _showHistory ? 'Δεν υπάρχει ιστορικό συναντήσεων.' : 'Δεν υπάρχει επερχόμενη ενημέρωση.',
                          style: const TextStyle(color: Color(0xFF6B7280)),
                        ),
                        const SizedBox(height: 12),
                        if (!_showHistory)
                          TextButton.icon(
                            onPressed: () { setState(() => _showHistory = true); _load(); },
                            icon: const Icon(Icons.history, size: 18),
                            label: const Text('Δες ιστορικό'),
                          ),
                      ],
                    )
                  else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ..._meetings.map(_card),
                        const SizedBox(height: 4),
                        if (!_showHistory)
                          TextButton.icon(
                            onPressed: () { setState(() => _showHistory = true); _load(); },
                            icon: const Icon(Icons.history, size: 18),
                            label: const Text('Ιστορικό'),
                            style: TextButton.styleFrom(foregroundColor: const Color(0xFF6B7280)),
                          )
                        else
                          TextButton.icon(
                            onPressed: () { setState(() => _showHistory = false); _load(); },
                            icon: const Icon(Icons.arrow_upward, size: 18),
                            label: const Text('Μόνο επερχόμενες'),
                            style: TextButton.styleFrom(foregroundColor: const Color(0xFF6B7280)),
                          ),
                      ],
                    ),
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
            _AcceptedMeetingBanner(
              meetingDate: meeting['meetingDate']?.toString() ?? '',
              slotTime: mine?['slotTime']?.toString() ?? '',
              teacherName: teacherName,
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
                final isPending = _pendingMeetingId == meeting['id'].toString() && _pendingSlot == slot;
                final selected = (mine?['slotTime'] == slot && mine?['status'] == 'requested') || isPending;
                return ChoiceChip(
                  label: Text(taken ? '$slot κλεισμένη' : slot),
                  selected: selected,
                  onSelected: taken || _sending != null ? null : (_) {
                    setState(() {
                      if (isPending) {
                        _pendingMeetingId = null;
                        _pendingSlot = null;
                      } else {
                        _pendingMeetingId = meeting['id'].toString();
                        _pendingSlot = slot;
                      }
                    });
                  },
                );
              }).toList(),
            ),
            if (_pendingMeetingId == meeting['id'].toString() && _pendingSlot != null) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _sending != null ? null : () => _request(_pendingMeetingId!, _pendingSlot!),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF77328D),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _sending != null
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text('Αποστολή αιτήματος για $_pendingSlot'),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _AcceptedMeetingBanner extends StatelessWidget {
  final String meetingDate;
  final String slotTime;
  final String teacherName;
  const _AcceptedMeetingBanner({
    required this.meetingDate,
    required this.slotTime,
    required this.teacherName,
  });

  @override
  Widget build(BuildContext context) {
    final dateOnly = meetingDate.length >= 10 ? meetingDate.substring(0, 10) : meetingDate;
    final parsed = DateTime.tryParse(dateOnly);
    final now = DateTime.now();
    final isPast = parsed != null && parsed.isBefore(DateTime(now.year, now.month, now.day));
    final teacher = teacherName.isEmpty ? 'τον εκπαιδευτικό' : teacherName;
    final formattedDate = meetingDay(meetingDate);

    if (isPast) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.check_circle_outline_rounded, size: 18, color: Color(0xFF6B7280)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Η συνάντηση πραγματοποιήθηκε $formattedDate στις $slotTime με $teacher.',
                style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF6B7280)),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.event_available_rounded, size: 18, color: Color(0xFF047857)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Επερχόμενη συνάντηση: $formattedDate στις $slotTime με $teacher.',
              style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF047857)),
            ),
          ),
        ],
      ),
    );
  }
}
