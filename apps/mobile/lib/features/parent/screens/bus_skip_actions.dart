import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

// Callers: parent_child_pages.dart ServicesScreen bus card (~line 728).
// No other parent bus-cancel widget exists. Reads/writes BusSkip via
// GET/POST/DELETE /schools/:id/bus-tracking/skips.
// User: «θελω να μπορει ο γονιος ... να πατησει ακυρωση για δρομολογιο σχολικου για αυριο»

String _grDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

class BusSkipActions extends ConsumerStatefulWidget {
  final String schoolId;
  final String studentId;
  final String serviceId;
  final String serviceMode;
  const BusSkipActions({
    super.key,
    required this.schoolId,
    required this.studentId,
    required this.serviceId,
    required this.serviceMode,
  });

  @override
  ConsumerState<BusSkipActions> createState() => _BusSkipActionsState();
}

class _BusSkipActionsState extends ConsumerState<BusSkipActions> {
  bool _loading = true;
  bool _busy = false;
  String? _tomorrow;
  Map<String, dynamic>? _skip;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/bus-tracking/skips',
        queryParameters: {'studentId': widget.studentId},
      );
      final data = resp.data is Map ? Map<String, dynamic>.from(resp.data as Map) : <String, dynamic>{};
      final tomorrow = data['tomorrow']?.toString();
      final skips = data['skips'] is List ? data['skips'] as List : const [];
      Map<String, dynamic>? match;
      for (final raw in skips) {
        if (raw is! Map) continue;
        final row = Map<String, dynamic>.from(raw);
        final sameDay = row['day']?.toString() == tomorrow;
        final sameBus = widget.serviceId.isEmpty || row['serviceId']?.toString() == widget.serviceId;
        if (sameDay && sameBus) {
          match = row;
          break;
        }
      }
      if (!mounted) return;
      setState(() {
        _tomorrow = tomorrow;
        _skip = match;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  String _directionLabel(String? direction) {
    switch (direction) {
      case 'pickup':
        return 'πρωί';
      case 'dropoff':
        return 'απόγευμα';
      default:
        return 'πρωί και απόγευμα';
    }
  }

  Future<void> _cancel({required String direction}) async {
    final dayLabel = _tomorrow == null ? 'αύριο' : _grDate(DateTime.parse(_tomorrow!));
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ακύρωση σχολικού'),
        content: Text(
          'Να ενημερωθεί ο οδηγός ότι αύριο ($dayLabel) το παιδί δεν θα έρθει ${_directionLabel(direction)};',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Όχι')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ναι, ακύρωση'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).post(
        '/schools/${widget.schoolId}/bus-tracking/skips',
        data: {
          'studentId': widget.studentId,
          if (widget.serviceId.isNotEmpty) 'serviceId': widget.serviceId,
          if (_tomorrow != null) 'day': _tomorrow,
          'direction': direction,
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ενημερώθηκε ο οδηγός για την ακύρωση.')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke() async {
    final id = _skip?['id']?.toString();
    if (id == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).delete('/schools/${widget.schoolId}/bus-tracking/skips/$id');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ανακλήθηκε η ακύρωση.')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.only(top: 10),
        child: LinearProgressIndicator(minHeight: 2, color: Color(0xFF77328D)),
      );
    }
    final mode = widget.serviceMode;
    final canPickup = mode != 'dropoff';
    final canDropoff = mode != 'pickup';
    final active = _skip != null;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFFFF1F2) : const Color(0xFFF8F5FB),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: active ? const Color(0xFFFECACA) : const Color(0xFFE9D5FF)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              active
                  ? 'Ακυρωμένο για αύριο (${_directionLabel(_skip?['direction']?.toString())})'
                  : 'Ακύρωση για αύριο',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: active ? const Color(0xFFB91C1C) : const Color(0xFF642678),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              active
                  ? 'Ο οδηγός έχει ενημερωθεί. Μπορείς να αναιρέσεις αν αλλάξει κάτι.'
                  : 'Αν το παιδί δεν θα έρθει, ενημέρωσε το δρομολόγιο του οδηγού.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), height: 1.35),
            ),
            const SizedBox(height: 10),
            if (active)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _busy ? null : _revoke,
                  child: Text(_busy ? '...' : 'Ανάκληση ακύρωσης'),
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (canPickup)
                    OutlinedButton(
                      onPressed: _busy ? null : () => _cancel(direction: 'pickup'),
                      child: const Text('Μόνο πρωί'),
                    ),
                  if (canDropoff)
                    OutlinedButton(
                      onPressed: _busy ? null : () => _cancel(direction: 'dropoff'),
                      child: const Text('Μόνο απόγευμα'),
                    ),
                  if (canPickup && canDropoff)
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFFB91C1C)),
                      onPressed: _busy ? null : () => _cancel(direction: 'both'),
                      child: const Text('Όλη τη μέρα'),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
