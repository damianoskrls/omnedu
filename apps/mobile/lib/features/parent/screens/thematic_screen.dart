import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

const _monthNames = [
  'Ιανουάριος',
  'Φεβρουάριος',
  'Μάρτιος',
  'Απρίλιος',
  'Μάιος',
  'Ιούνιος',
  'Ιούλιος',
  'Αύγουστος',
  'Σεπτέμβριος',
  'Οκτώβριος',
  'Νοέμβριος',
  'Δεκέμβριος',
];

String thematicMonthKey(DateTime date) => '${date.year}-${date.month.toString().padLeft(2, '0')}';

String thematicMonthLabel(String? ym) {
  if (ym == null || !RegExp(r'^\d{4}-\d{2}$').hasMatch(ym)) return '';
  final year = int.parse(ym.substring(0, 4));
  final month = int.parse(ym.substring(5, 7));
  return '${_monthNames[month - 1]} $year';
}

class ParentThematicScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;
  final String? initialMonth;
  const ParentThematicScreen({
    super.key,
    required this.schoolId,
    required this.classId,
    required this.className,
    this.initialMonth,
  });

  @override
  ConsumerState<ParentThematicScreen> createState() => _ParentThematicScreenState();
}

class _ParentThematicScreenState extends ConsumerState<ParentThematicScreen> {
  late String _month;
  Map<String, dynamic>? _plan;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _month = widget.initialMonth ?? thematicMonthKey(DateTime.now());
    _load();
  }

  List<String> get _months {
    final now = DateTime.now();
    final values = <String>[];
    for (var i = -2; i < 10; i++) {
      values.add(thematicMonthKey(DateTime(now.year, now.month + i, 1)));
    }
    if (!values.contains(_month)) values.insert(0, _month);
    return values;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final resp = await dio.get(
        '/schools/${widget.schoolId}/thematic-plans',
        queryParameters: {'classId': widget.classId, 'month': _month},
      );
      final list = resp.data is List ? resp.data as List : [];
      Map<String, dynamic>? exact;
      Map<String, dynamic>? covering;
      for (final raw in list) {
        if (raw is! Map) continue;
        final plan = Map<String, dynamic>.from(raw);
        if (plan['month'] == _month) {
          exact = plan;
          break;
        }
        covering ??= plan;
      }
      _plan = exact ?? covering;
    } catch (_) {
      _plan = null;
      _error = 'Το διαθεματικό δεν φορτώθηκε.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    final through = plan?['throughMonth'] as String?;
    final period = through != null && through.isNotEmpty && through != plan?['month']
        ? '${thematicMonthLabel(plan?['month'] as String?)} – ${thematicMonthLabel(through)}'
        : thematicMonthLabel(_month);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        title: const Text('Διαθεματικό'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          DropdownButtonFormField<String>(
            value: _month,
            decoration: const InputDecoration(labelText: 'Μήνας', filled: true, fillColor: Colors.white),
            items: _months
                .map((value) => DropdownMenuItem(value: value, child: Text(thematicMonthLabel(value))))
                .toList(),
            onChanged: (value) {
              if (value == null || value == _month) return;
              setState(() => _month = value);
              _load();
            },
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
            )
          else if (_error != null)
            Text(_error!, style: const TextStyle(color: Color(0xFFB45309)))
          else if (plan == null)
            const Text(
              'Ο εκπαιδευτικός δεν έχει ανεβάσει ακόμα το διαθεματικό για αυτόν τον μήνα.',
              style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plan['title'] as String? ?? 'Διαθεματικό',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF2C2422)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${widget.className} · $period',
                    style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 14),
                  Text(plan['greeting'] as String? ?? '', style: const TextStyle(height: 1.4)),
                  _paragraphs(plan['introduction'] as String? ?? ''),
                  _bullets('Οι εκπαιδευτικοί μας στόχοι αφορούν:', plan['goals'] as String? ?? ''),
                  _bullets('Επιπλέον:', plan['extras'] as String? ?? ''),
                  _paragraphs(plan['closing'] as String? ?? ''),
                  if ((plan['signature'] as String? ?? '').trim().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(plan['signature'] as String, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.4)),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _paragraphs(String value) {
    final parts = value.split(RegExp(r'\n\s*\n')).map((part) => part.trim()).where((part) => part.isNotEmpty);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: parts
          .map((part) => Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(part, style: const TextStyle(height: 1.4, color: Color(0xFF374151))),
              ))
          .toList(),
    );
  }

  Widget _bullets(String title, String value) {
    final lines = value.split('\n').map((line) => line.trim()).where((line) => line.isNotEmpty).toList();
    if (lines.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
          const SizedBox(height: 6),
          ...lines.map((line) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('• $line', style: const TextStyle(height: 1.35, color: Color(0xFF374151))),
              )),
        ],
      ),
    );
  }
}
