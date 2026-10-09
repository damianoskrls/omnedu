import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

final busClosureTodayProvider = FutureProvider.family<Map<String, dynamic>?, String>((ref, schoolId) async {
  if (schoolId.isEmpty) return null;
  try {
    final resp = await ref.read(dioProvider).get('/schools/$schoolId/bus-tracking/closures/today');
    final data = resp.data;
    if (data is Map && data['closed'] == true) return Map<String, dynamic>.from(data);
  } catch (_) {}
  return null;
});

bool childHasBus(Map<String, dynamic> child) {
  final services = child['studentServices'];
  if (services is! List) return false;
  for (final raw in services) {
    if (raw is! Map) continue;
    final catalog = raw['service'];
    final service = catalog is Map ? catalog : const <String, dynamic>{};
    final type = service['serviceType']?.toString() ?? '';
    final name = service['name']?.toString().toLowerCase() ?? '';
    if (type == 'bus' || name.contains('σχολ')) return true;
  }
  return false;
}

class BusClosedCard extends StatelessWidget {
  final String reason;
  const BusClosedCard({super.key, required this.reason});

  @override
  Widget build(BuildContext context) {
    final why = reason.trim();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7F4),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF6C7B8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.directions_bus_filled_outlined, color: Color(0xFFE95926)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Σήμερα δεν θα έχει σχολικό',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF111827)),
                ),
              ),
            ],
          ),
          if (why.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(why, style: const TextStyle(fontSize: 15, height: 1.4, color: Color(0xFF374151))),
          ],
        ],
      ),
    );
  }
}

class BusClosedNotice extends ConsumerWidget {
  final String schoolId;
  const BusClosedNotice({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final closure = ref.watch(busClosureTodayProvider(schoolId)).asData?.value;
    if (closure == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: BusClosedCard(reason: closure['reason']?.toString() ?? ''),
    );
  }
}
