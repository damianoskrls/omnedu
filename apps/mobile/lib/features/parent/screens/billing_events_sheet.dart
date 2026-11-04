import 'package:flutter/material.dart';

import 'events_screen.dart';

Future<void> showBillingEventsSheet(
  BuildContext context, {
  required String schoolId,
  required List<Map<String, dynamic>> events,
}) async {
  final eventId = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _BillingEventsSheet(events: events),
  );
  if (eventId == null || eventId.isEmpty) return;
  if (!context.mounted) return;
  openParentEvent(context, schoolId, eventId);
}

class _BillingEventsSheet extends StatelessWidget {
  final List<Map<String, dynamic>> events;
  const _BillingEventsSheet({required this.events});

  static const _statusLabel = {
    'pending_consent': 'Αναμονή συναίνεσης',
    'pending_payment': 'Εκκρεμεί πληρωμή',
    'paid': 'Πληρωμένο',
    'consent_given': 'Συναίνεση',
    'consent_declined': 'Άρνηση',
  };

  static const _statusColor = {
    'pending_consent': Color(0xFFD97706),
    'pending_payment': Color(0xFFEA580C),
    'paid': Color(0xFF059669),
    'consent_given': Color(0xFF2563EB),
    'consent_declined': Color(0xFF6B7280),
  };

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * 0.82;
    final pending = events.where((e) {
      final s = e['status']?.toString() ?? '';
      return s == 'pending_payment' || s == 'pending_consent';
    }).toList();
    final rest = events.where((e) => !pending.contains(e)).toList();
    final ordered = [...pending, ...rest];

    return Container(
      height: height,
      decoration: const BoxDecoration(
        color: Color(0xFFF9FAFB),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFD1D5DB),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Εκδηλώσεις',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111827)),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Πάτα μια εκδρομή για λεπτομέρειες',
                        style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          if (pending.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Text(
                  '${pending.length} εκκρεμ${pending.length == 1 ? 'ής' : 'είς'} εκδήλωσ${pending.length == 1 ? 'η' : 'εις'}',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF9A3412)),
                ),
              ),
            ),
          const Divider(height: 1),
          Expanded(
            child: ordered.isEmpty
                ? const Center(
                    child: Text('Δεν υπάρχουν χρεώσεις εκδηλώσεων.', style: TextStyle(color: Color(0xFF9CA3AF))),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    itemCount: ordered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final e = ordered[i];
                      final status = e['status']?.toString() ?? '';
                      final cost = (e['cost'] is num)
                          ? (e['cost'] as num).toDouble()
                          : double.tryParse(e['cost']?.toString() ?? '0') ?? 0;
                      final color = _statusColor[status] ?? const Color(0xFF6B7280);
                      final label = _statusLabel[status] ?? status;
                      final date = e['eventDate']?.toString();
                      String when = '';
                      if (date != null && date.length >= 10) {
                        final parts = date.substring(0, 10).split('-');
                        if (parts.length == 3) when = '${parts[2]}/${parts[1]}/${parts[0]}';
                      }
                      final eventId = e['eventId']?.toString() ?? '';
                      return Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: eventId.isEmpty ? null : () => Navigator.pop(context, eventId),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE5E7EB)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        e['title']?.toString() ?? 'Εκδήλωση',
                                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827)),
                                      ),
                                    ),
                                    Text(
                                      '€${cost.toStringAsFixed(2)}',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827)),
                                    ),
                                    if (eventId.isNotEmpty) ...[
                                      const SizedBox(width: 6),
                                      const Icon(Icons.chevron_right_rounded, color: Color(0xFF77328D), size: 22),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  [
                                    e['studentName']?.toString() ?? '',
                                    if (when.isNotEmpty) when,
                                  ].where((p) => p.isNotEmpty).join(' · '),
                                  style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    label,
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
