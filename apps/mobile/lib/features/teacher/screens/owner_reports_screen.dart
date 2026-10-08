import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

final _ownerReportProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/reports/overview');
  final data = resp.data;
  if (data is Map) return Map<String, dynamic>.from(data);
  return {};
});

class OwnerReportsScreen extends ConsumerWidget {
  final String schoolId;
  const OwnerReportsScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final report = ref.watch(_ownerReportProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Αναφορές', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: report.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Η αναφορά δεν φορτώθηκε')),
        data: (data) {
          final counts = data['counts'] is Map ? Map<String, dynamic>.from(data['counts'] as Map) : <String, dynamic>{};
          final finances = data['finances'] is Map ? Map<String, dynamic>.from(data['finances'] as Map) : <String, dynamic>{};
          final classes = data['classes'] is List ? data['classes'] as List : const [];
          final owing = data['owing'] is List ? data['owing'] as List : const [];
          final allergies = data['allergies'] is List ? data['allergies'] as List : const [];
          final bus = data['bus'] is List ? data['bus'] as List : const [];
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              Text(
                'Σχολικό έτος ${data['schoolYear'] ?? ''}',
                style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
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
              const SizedBox(height: 16),
              _Section(
                title: 'Οικονομικά μήνα',
                lines: [
                  'Χρέωση ${_money(finances['monthDue'])}',
                  'Πληρωμές ${_money(finances['monthPaid'])}',
                  'Υπόλοιπο ${_money(finances['monthRemaining'])}',
                  'Ανοιχτοί λογαριασμοί ${finances['openCount'] ?? 0}',
                ],
              ),
              _People(title: 'Εκκρεμείς πληρωμές', rows: owing, trailing: (row) => _money(row['remaining'])),
              _People(title: 'Μαθητές ανά τάξη', rows: classes, trailing: (row) => '${row['students'] ?? 0}'),
              _People(title: 'Αλλεργίες', rows: allergies, trailing: (row) => row['allergies']?.toString() ?? ''),
              _People(title: 'Σχολικό', rows: bus, trailing: (row) => row['className']?.toString() ?? ''),
            ],
          );
        },
      ),
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
          Text('$value', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF3D1152))),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<String> lines;
  const _Section({required this.title, required this.lines});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
  final String Function(Map<String, dynamic> row) trailing;
  const _People({required this.title, required this.rows, required this.trailing});

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          for (final raw in rows.take(30))
            if (raw is Map)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(child: Text(raw['fullName']?.toString() ?? raw['name']?.toString() ?? '')),
                    const SizedBox(width: 8),
                    Flexible(child: Text(trailing(Map<String, dynamic>.from(raw)), textAlign: TextAlign.end, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12))),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

String _money(dynamic value) {
  final amount = value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
  return '${amount.toStringAsFixed(2)} €';
}
