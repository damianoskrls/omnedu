import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

const _kinds = <(String, String)>[
  ('overview', 'Γενική εικόνα'),
  ('owing', 'Οφειλές'),
  ('parents', 'Γονείς'),
  ('children', 'Παιδιά'),
  ('staff', 'Προσωπικό'),
];

const _roles = {
  'teacher': 'Εκπαιδευτικός',
  'school_admin': 'Διαχειριστής',
  'owner': 'Ιδιοκτήτης',
};

final ownerReportProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, key) async {
  final parts = key.split('|');
  final schoolId = parts.isEmpty ? '' : parts[0];
  final query = <String, String>{};
  if (parts.length > 1 && parts[1].isNotEmpty) query['academicYearId'] = parts[1];
  if (parts.length > 2 && parts[2].isNotEmpty) query['month'] = parts[2];
  if (parts.length > 3 && parts[3].isNotEmpty) query['year'] = parts[3];
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/reports/overview', queryParameters: query);
  final data = resp.data;
  if (data is Map) return Map<String, dynamic>.from(data);
  return {};
});

class OwnerHome extends ConsumerStatefulWidget {
  final String schoolId;
  const OwnerHome({super.key, required this.schoolId});

  @override
  ConsumerState<OwnerHome> createState() => _OwnerHomeState();
}

class _OwnerHomeState extends ConsumerState<OwnerHome> {
  String _yearId = '';
  String _month = '';
  String _calendarYear = '';
  String _kind = 'overview';

  @override
  Widget build(BuildContext context) {
    final report = ref.watch(ownerReportProvider('${widget.schoolId}|$_yearId|$_month|$_calendarYear'));
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      body: report.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Η αναφορά δεν φορτώθηκε')),
        data: (data) => _Report(
          data: data,
          kind: _kind,
          onKind: (kind) => setState(() => _kind = kind),
          onYear: (id) => setState(() {
            _yearId = id;
            _month = '';
            _calendarYear = '';
          }),
          onMonth: (month, year) => setState(() {
            _yearId = data['academicYearId']?.toString() ?? _yearId;
            _month = month;
            _calendarYear = year;
          }),
        ),
      ),
    );
  }
}

class _Report extends StatelessWidget {
  final Map<String, dynamic> data;
  final String kind;
  final ValueChanged<String> onKind;
  final ValueChanged<String> onYear;
  final void Function(String month, String year) onMonth;

  const _Report({
    required this.data,
    required this.kind,
    required this.onKind,
    required this.onYear,
    required this.onMonth,
  });

  @override
  Widget build(BuildContext context) {
    final years = data['years'] is List ? data['years'] as List : const [];
    final months = data['months'] is List ? data['months'] as List : const [];
    final yearId = data['academicYearId']?.toString() ?? '';
    final month = '${data['month'] ?? ''}';
    final calendarYear = '${data['year'] ?? ''}';
    final counts = data['counts'] is Map ? Map<String, dynamic>.from(data['counts'] as Map) : <String, dynamic>{};
    final finances = data['finances'] is Map ? Map<String, dynamic>.from(data['finances'] as Map) : <String, dynamic>{};
    final monthLabel = months.cast<dynamic>().whereType<Map>().map((row) => Map<String, dynamic>.from(row)).where((row) => '${row['month']}' == month && '${row['year']}' == calendarYear).map((row) => row['label']?.toString() ?? '').firstOrNull ?? '$month/$calendarYear';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        const Text('Αναφορές', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF3D1152))),
        const SizedBox(height: 4),
        Text('Σχολικό έτος ${data['schoolYear'] ?? ''}', style: const TextStyle(color: Color(0xFF6B7280))),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _Filter(
              label: 'Έτος',
              value: yearId,
              items: [
                for (final raw in years)
                  if (raw is Map)
                    DropdownMenuItem(value: '${raw['id']}', child: Text('${raw['label'] ?? ''}', overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (value) {
                if (value != null && value.isNotEmpty) onYear(value);
              },
            )),
            const SizedBox(width: 8),
            Expanded(child: _Filter(
              label: 'Μήνας',
              value: '$month|$calendarYear',
              items: [
                for (final raw in months)
                  if (raw is Map)
                    DropdownMenuItem(
                      value: '${raw['month']}|${raw['year']}',
                      child: Text('${raw['label'] ?? ''}', overflow: TextOverflow.ellipsis),
                    ),
              ],
              onChanged: (value) {
                if (value == null || !value.contains('|')) return;
                final parts = value.split('|');
                onMonth(parts[0], parts[1]);
              },
            )),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in _kinds)
              ChoiceChip(
                label: Text(item.$2),
                selected: kind == item.$1,
                selectedColor: const Color(0xFFF3E8F7),
                labelStyle: TextStyle(
                  color: kind == item.$1 ? const Color(0xFF77328D) : const Color(0xFF374151),
                  fontWeight: FontWeight.w700,
                ),
                onSelected: (_) => onKind(item.$1),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (kind == 'overview') ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Stat('Μαθητές', counts['students']),
              _Stat('Τάξεις', counts['classes']),
              _Stat('Γονείς', counts['parents']),
              _Stat('Προσωπικό', counts['staff']),
              _Stat('Σχολικό', counts['onBus']),
              _Stat('Αλλεργίες', counts['withAllergies']),
              _Stat('Χωρίς τάξη', counts['unassigned']),
              _Stat('Αδέλφια', counts['siblingFamilies']),
            ],
          ),
          const SizedBox(height: 12),
          _Card(title: 'Οικονομικά · $monthLabel', lines: [
            'Χρέωση ${_money(finances['monthDue'])}',
            'Πληρωμές ${_money(finances['monthPaid'])}',
            'Υπόλοιπο ${_money(finances['monthRemaining'])}',
            'Ανοιχτοί λογαριασμοί ${finances['openCount'] ?? 0}',
            'Έτος ${_money(finances['yearDue'])} χρέωση · ${_money(finances['yearPaid'])} πληρωμές',
          ]),
        ],
        if (kind == 'owing') _People(
          title: 'Ποιοι χρωστάνε · $monthLabel',
          rows: data['owing'] is List ? data['owing'] as List : const [],
          subtitle: (row) => row['className']?.toString() ?? '',
          trailing: (row) => _money(row['remaining']),
          empty: 'Δεν υπάρχουν οφειλές για αυτόν τον μήνα.',
        ),
        if (kind == 'parents') _People(
          title: 'Γονείς',
          rows: data['parents'] is List ? data['parents'] as List : const [],
          subtitle: (row) {
            final children = row['children'] is List ? (row['children'] as List).map((item) => '$item').where((item) => item.isNotEmpty).join(', ') : '';
            final phone = row['phone']?.toString() ?? '';
            return [phone, children].where((item) => item.isNotEmpty).join(' · ');
          },
          trailing: (_) => '',
          empty: 'Δεν υπάρχουν γονείς.',
        ),
        if (kind == 'children') _Classes(rows: data['classes'] is List ? data['classes'] as List : const []),
        if (kind == 'staff') _People(
          title: 'Προσωπικό',
          rows: data['staff'] is List ? data['staff'] as List : const [],
          subtitle: (row) => row['phone']?.toString() ?? '',
          trailing: (row) => _roles[row['role']?.toString()] ?? '',
          empty: 'Δεν υπάρχει προσωπικό.',
        ),
      ],
    );
  }
}

class _Filter extends StatelessWidget {
  final String label;
  final String value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;
  const _Filter({required this.label, required this.value, required this.items, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final values = items.map((item) => item.value).whereType<String>().toSet();
    return DropdownButtonFormField<String>(
      isExpanded: true,
      value: values.contains(value) ? value : null,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE9D5F2))),
      ),
      items: items,
      onChanged: onChanged,
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final dynamic value;
  const _Stat(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 104,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9D5F2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${value ?? 0}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF3D1152))),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final String title;
  final List<String> lines;
  const _Card({required this.title, required this.lines});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          for (final line in lines) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(line)),
        ],
      ),
    );
  }
}

class _People extends StatelessWidget {
  final String title;
  final List<dynamic> rows;
  final String Function(Map<String, dynamic> row) subtitle;
  final String Function(Map<String, dynamic> row) trailing;
  final String empty;
  const _People({required this.title, required this.rows, required this.subtitle, required this.trailing, required this.empty});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (rows.isEmpty) Text(empty, style: const TextStyle(color: Color(0xFF6B7280))),
          for (final raw in rows)
            if (raw is Map)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(raw['fullName']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                          if (subtitle(Map<String, dynamic>.from(raw)).isNotEmpty)
                            Text(subtitle(Map<String, dynamic>.from(raw)), style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(trailing(Map<String, dynamic>.from(raw)), style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class _Classes extends StatelessWidget {
  final List<dynamic> rows;
  const _Classes({required this.rows});

  @override
  Widget build(BuildContext context) {
    final classes = rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
    if (classes.isEmpty) {
      return const _Card(title: 'Παιδιά ανά τάξη', lines: ['Δεν υπάρχουν τάξεις για αυτό το έτος.']);
    }
    final levels = <String, List<Map<String, dynamic>>>{};
    for (final row in classes) {
      final level = row['level']?.toString().isNotEmpty == true ? row['level'].toString() : 'Χωρίς βαθμίδα';
      levels.putIfAbsent(level, () => []).add(row);
    }
    return Column(
      children: [
        for (final entry in levels.entries)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
                for (final klass in entry.value) ...[
                  const SizedBox(height: 10),
                  Text('${klass['name']} · ${klass['students'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (klass['studentNames'] is List)
                    for (final name in klass['studentNames'] as List)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text('$name', style: const TextStyle(color: Color(0xFF374151))),
                      ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

String _money(dynamic value) {
  final amount = value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
  return '${amount.toStringAsFixed(2)} €';
}
