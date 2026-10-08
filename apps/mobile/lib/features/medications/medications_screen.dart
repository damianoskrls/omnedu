import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/person_face.dart';

final medicationsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/medication-requests/mine');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class MedicationsScreen extends ConsumerWidget {
  final String schoolId;
  final bool forParent;
  final String? studentId;
  const MedicationsScreen({super.key, required this.schoolId, required this.forParent, this.studentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meds = ref.watch(medicationsProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF3D1152),
        elevation: 0,
        title: Text(forParent ? 'Φάρμακα' : 'Φάρμακα τάξης'),
      ),
      body: meds.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Τα φάρμακα δεν φορτώθηκαν')),
        data: (rows) {
          final list = rows.where((row) {
            if (row is! Map) return false;
            if (studentId == null || studentId!.isEmpty) return true;
            final student = row['student'];
            return student is Map && student['id']?.toString() == studentId;
          }).toList();
          if (list.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Δεν υπάρχει χορήγηση φαρμάκου.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF9CA3AF)),
                ),
              ),
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () async => ref.invalidate(medicationsProvider(schoolId)),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, index) => MedicationCard(
                schoolId: schoolId,
                row: Map<String, dynamic>.from(list[index] as Map),
                forParent: forParent,
              ),
            ),
          );
        },
      ),
    );
  }
}

class ParentMedicationSection extends ConsumerWidget {
  final String schoolId;
  const ParentMedicationSection({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meds = ref.watch(medicationsProvider(schoolId));
    final rows = meds.asData?.value ?? const [];
    final visible = rows.whereType<Map>().where((row) {
      final status = row['status']?.toString();
      return status == 'pending' || status == 'approved';
    }).toList();
    if (visible.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 28, 20, 0),
          child: Text('Φάρμακα', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF2C2422))),
        ),
        for (final row in visible)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: MedicationCard(schoolId: schoolId, row: Map<String, dynamic>.from(row), forParent: true),
          ),
      ],
    );
  }
}

class MedicationCard extends ConsumerStatefulWidget {
  final String schoolId;
  final Map<String, dynamic> row;
  final bool forParent;
  const MedicationCard({super.key, required this.schoolId, required this.row, required this.forParent});

  @override
  ConsumerState<MedicationCard> createState() => _MedicationCardState();
}

class _MedicationCardState extends ConsumerState<MedicationCard> {
  bool _busy = false;

  Future<void> _consent(String decision) async {
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).patch(
        '/schools/${widget.schoolId}/medication-requests/${widget.row['id']}/consent',
        data: {'decision': decision},
      );
      ref.invalidate(medicationsProvider(widget.schoolId));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η συναίνεση δεν καταχωρήθηκε')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = widget.row['student'] is Map ? Map<String, dynamic>.from(widget.row['student'] as Map) : <String, dynamic>{};
    final name = student['fullName']?.toString() ?? 'Παιδί';
    final status = widget.row['status']?.toString() ?? 'pending';
    final medicine = widget.row['medicationName']?.toString() ?? '';
    final dose = widget.row['dose']?.toString() ?? '';
    final frequency = widget.row['frequency']?.toString() ?? '';
    final notes = widget.row['doctorNotes']?.toString() ?? '';
    final reason = widget.row['reason']?.toString() ?? '';
    final parent = widget.row['acknowledgedBy'] is Map
        ? (widget.row['acknowledgedBy'] as Map)['fullName']?.toString() ?? ''
        : '';
    final pending = status == 'pending';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: pending ? const Color(0xFFF5D0A9) : const Color(0xFFE7D7EE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PersonFace(name: name, photoUrl: student['avatarUrl']?.toString(), size: 40, radius: 14),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF3D1152))),
                    Text(
                      pending ? 'Αναμονή συναίνεσης γονέα' : 'Με τη συναίνεση του γονέα${parent.isEmpty ? '' : ' ($parent)'}',
                      style: TextStyle(fontSize: 12, color: pending ? const Color(0xFFB45309) : const Color(0xFF047857)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(medicine, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1F2937))),
          const SizedBox(height: 4),
          Text('$dose · $frequency', style: const TextStyle(color: Color(0xFF4B5563))),
          if (reason.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Αιτία: $reason', style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)))),
          if (notes.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Οδηγίες: $notes', style: const TextStyle(fontSize: 13, color: Color(0xFF77328D)))),
          if (widget.forParent && pending) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : () => _consent('approved'),
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D)),
                    child: const Text('Συμφωνώ'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _consent('rejected'),
                    child: const Text('Δεν συμφωνώ'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
