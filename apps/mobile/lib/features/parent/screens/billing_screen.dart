import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';

final myChargesProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/billing/charges/mine');
    final data = resp.data;
    return data is List ? data : [];
  },
);

class BillingScreen extends ConsumerWidget {
  final String schoolId;
  const BillingScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chargesAsync = ref.watch(myChargesProvider(schoolId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Οικονομικά', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.invalidate(myChargesProvider(schoolId)),
          ),
        ],
      ),
      body: chargesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFD1D5DB)),
              const SizedBox(height: 12),
              const Text('Σφάλμα φόρτωσης', style: TextStyle(color: Color(0xFF6B7280))),
            ],
          ),
        ),
        data: (data) {
          if (data.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long_outlined, size: 64, color: Color(0xFFD1D5DB)),
                  SizedBox(height: 16),
                  Text('Δεν υπάρχουν χρεώσεις', style: TextStyle(color: Color(0xFF9CA3AF))),
                ],
              ),
            );
          }

          // Global summary across all children
          double grandTotal = 0;
          double grandPaid = 0;
          for (final entry in data) {
            final e = entry as Map<String, dynamic>;
            final monthly = e['monthly'] as List? ?? [];
            final oneTime = e['oneTime'] as List? ?? [];
            final events = e['events'] as List? ?? [];
            for (final c in monthly) {
              grandTotal += double.tryParse(c['totalDue']?.toString() ?? '0') ?? 0;
              grandPaid += double.tryParse(c['paidAmount']?.toString() ?? '0') ?? 0;
            }
            for (final c in oneTime) {
              grandTotal += double.tryParse(c['amount']?.toString() ?? '0') ?? 0;
              if ((c['status'] as String?) == 'paid') {
                grandPaid += double.tryParse(c['amount']?.toString() ?? '0') ?? 0;
              }
            }
            for (final ev in events) {
              final cost = double.tryParse((ev['event']?['costPerChild'])?.toString() ?? '0') ?? 0;
              if (cost > 0) {
                grandTotal += cost;
                if ((ev['status'] as String?) == 'paid') grandPaid += cost;
              }
            }
          }
          final grandOwed = grandTotal - grandPaid;

          return RefreshIndicator(
            onRefresh: () => ref.refresh(myChargesProvider(schoolId).future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Grand summary card
                _SummaryCard(total: grandTotal, paid: grandPaid, owed: grandOwed),
                const SizedBox(height: 20),

                // Per-child sections
                ...data.map((entry) {
                  final e = entry as Map<String, dynamic>;
                  final student = e['student'] as Map<String, dynamic>? ?? {};
                  final monthly = e['monthly'] as List<dynamic>? ?? [];
                  final oneTime = e['oneTime'] as List<dynamic>? ?? [];
                  final events = e['events'] as List<dynamic>? ?? [];
                  return _StudentBillingSection(
                    student: student,
                    monthly: monthly,
                    oneTime: oneTime,
                    events: events,
                  );
                }),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final double total;
  final double paid;
  final double owed;
  const _SummaryCard({required this.total, required this.paid, required this.owed});

  @override
  Widget build(BuildContext context) {
    final allPaid = owed <= 0.01;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: allPaid
              ? [const Color(0xFF059669), const Color(0xFF10B981)]
              : [const Color(0xFF77328D), const Color(0xFFE95926)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: (allPaid ? const Color(0xFF059669) : const Color(0xFF77328D)).withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet_outlined, color: Colors.white70, size: 18),
              const SizedBox(width: 8),
              Text(
                allPaid ? 'Εξοφλημένος ✓' : 'Εκκρεμεί πληρωμή',
                style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _SummaryMetric(label: 'Σύνολο', value: '€${total.toStringAsFixed(2)}'),
              _SummaryDivider(),
              _SummaryMetric(label: 'Πληρώθηκε', value: '€${paid.toStringAsFixed(2)}'),
              _SummaryDivider(),
              _SummaryMetric(
                label: 'Οφείλεται',
                value: '€${owed > 0 ? owed.toStringAsFixed(2) : '0.00'}',
                highlight: owed > 0.01,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  const _SummaryMetric({required this.label, required this.value, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                color: highlight ? Colors.amber : Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              )),
        ],
      ),
    );
  }
}

class _SummaryDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 32, color: Colors.white24);
  }
}

class _StudentBillingSection extends StatefulWidget {
  final Map<String, dynamic> student;
  final List<dynamic> monthly;
  final List<dynamic> oneTime;
  final List<dynamic> events;
  const _StudentBillingSection({required this.student, required this.monthly, required this.oneTime, required this.events});

  @override
  State<_StudentBillingSection> createState() => _StudentBillingSectionState();
}

class _StudentBillingSectionState extends State<_StudentBillingSection> {
  bool _expanded = true;

  static const _monthNames = [
    '', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν',
    'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ',
  ];
  static const _fullMonthNames = [
    '', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
    'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
  ];

  @override
  Widget build(BuildContext context) {
    final name = widget.student['fullName'] as String? ?? '';
    final avatarUrl = widget.student['avatarUrl'] as String?;

    double totalDue = 0;
    double totalPaid = 0;
    for (final c in widget.monthly) {
      totalDue += double.tryParse(c['totalDue']?.toString() ?? '0') ?? 0;
      totalPaid += double.tryParse(c['paidAmount']?.toString() ?? '0') ?? 0;
    }
    for (final c in widget.oneTime) {
      totalDue += double.tryParse(c['amount']?.toString() ?? '0') ?? 0;
      if ((c['status'] as String?) == 'paid') {
        totalPaid += double.tryParse(c['amount']?.toString() ?? '0') ?? 0;
      }
    }
    for (final ev in widget.events) {
      final cost = double.tryParse((ev['event']?['costPerChild'])?.toString() ?? '0') ?? 0;
      if (cost > 0) {
        totalDue += cost;
        if ((ev['status'] as String?) == 'paid') totalPaid += cost;
      }
    }
    final owed = totalDue - totalPaid;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Student header - tappable to expand/collapse
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                if (avatarUrl != null && avatarUrl.isNotEmpty)
                  ClipOval(
                    child: AppImage(avatarUrl, width: 32, height: 32, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _letterAvatar(name)),
                  )
                else
                  _letterAvatar(name),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(name,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                ),
                if (owed > 0.01)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Text(
                      'Οφείλει €${owed.toStringAsFixed(2)}',
                      style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  )
                else if (totalDue > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: const Text(
                      'Εξοφλημένος ✓',
                      style: TextStyle(color: Color(0xFF16A34A), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                const SizedBox(width: 4),
                Icon(_expanded ? Icons.expand_less : Icons.expand_more, color: const Color(0xFF9CA3AF), size: 20),
              ],
            ),
          ),

          if (_expanded) ...[
            const SizedBox(height: 10),

            // Monthly charges
            if (widget.monthly.isNotEmpty)
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  children: [
                    // Header
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_month_outlined, size: 14, color: Color(0xFF9CA3AF)),
                          const SizedBox(width: 6),
                          const Text('Μηνιαία Χρέωση',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                          const Spacer(),
                          Text(
                            '${_subscriptionPeriod()}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFFF3F4F6)),
                    ...widget.monthly.asMap().entries.map((entry) {
                      final i = entry.key;
                      final c = entry.value as Map<String, dynamic>;
                      return _MonthlyRow(charge: c, isLast: i == widget.monthly.length - 1, monthNames: _monthNames);
                    }),
                  ],
                ),
              ),

            // One-time charges
            if (widget.oneTime.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Row(
                        children: [
                          Icon(Icons.receipt_long_outlined, size: 14, color: Color(0xFF9CA3AF)),
                          SizedBox(width: 6),
                          Text('Εκτακτες Χρεώσεις',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFFF3F4F6)),
                    ...widget.oneTime.asMap().entries.map((entry) {
                      final i = entry.key;
                      final c = entry.value as Map<String, dynamic>;
                      return _OneTimeRow(charge: c, isLast: i == widget.oneTime.length - 1);
                    }),
                  ],
                ),
              ),
            ],

            // Events billing
            if (widget.events.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Row(children: [
                        Icon(Icons.event_outlined, size: 14, color: Color(0xFF9CA3AF)),
                        SizedBox(width: 6),
                        Text('Εκδηλώσεις',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                      ]),
                    ),
                    const Divider(height: 1, color: Color(0xFFF3F4F6)),
                    ...widget.events.asMap().entries.map((entry) {
                      final i = entry.key;
                      final ev = entry.value as Map<String, dynamic>;
                      final event = ev['event'] as Map<String, dynamic>? ?? {};
                      final status = ev['status'] as String? ?? '';
                      final cost = double.tryParse(event['costPerChild']?.toString() ?? '0') ?? 0;
                      const statusColors = {
                        'pending_consent': Color(0xFFF59E0B),
                        'pending_payment': Color(0xFF2563EB),
                        'paid': Color(0xFF059669),
                        'consent_given': Color(0xFF059669),
                        'consent_declined': Color(0xFF9CA3AF),
                      };
                      const statusLabels = {
                        'pending_consent': 'Αναμονή Συναίνεσης',
                        'pending_payment': 'Αναμονή Πληρωμής',
                        'paid': 'Εξοφλημένο ✓',
                        'consent_given': 'Συναίνεση ✓',
                        'consent_declined': 'Άρνηση',
                      };
                      final sc = statusColors[status] ?? const Color(0xFF6B7280);
                      final sl = statusLabels[status] ?? status;
                      final isLast = i == widget.events.length - 1;
                      return Container(
                        decoration: BoxDecoration(
                          border: !isLast ? const Border(bottom: BorderSide(color: Color(0xFFF3F4F6))) : null,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.event_outlined, size: 14, color: Color(0xFF2563EB)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Text(event['title'] as String? ?? '',
                              style: const TextStyle(fontSize: 13, color: Color(0xFF374151), fontWeight: FontWeight.w500))),
                          if (cost > 0) ...[
                            Text('€${cost.toStringAsFixed(2)}',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF111827))),
                            const SizedBox(width: 10),
                          ],
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: sc.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(sl, style: TextStyle(color: sc, fontSize: 10, fontWeight: FontWeight.w600)),
                          ),
                        ]),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  String _subscriptionPeriod() {
    if (widget.monthly.isEmpty) return '';
    // Sort months and show range
    final sorted = [...widget.monthly]..sort((a, b) {
      final ay = (a as Map)['year'] as int? ?? 0;
      final am = (a)['month'] as int? ?? 0;
      final by = (b as Map)['year'] as int? ?? 0;
      final bm = (b)['month'] as int? ?? 0;
      return ay != by ? ay.compareTo(by) : am.compareTo(bm);
    });
    final first = sorted.first as Map;
    final last = sorted.last as Map;
    final fMonth = first['month'] as int? ?? 0;
    final fYear = first['year'] as int? ?? 0;
    final lMonth = last['month'] as int? ?? 0;
    final lYear = last['year'] as int? ?? 0;
    const short = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    final fLabel = fMonth > 0 && fMonth < short.length ? short[fMonth] : '';
    final lLabel = lMonth > 0 && lMonth < short.length ? short[lMonth] : '';
    if (fYear == lYear) return '$fLabel–$lLabel $fYear';
    return '$fLabel $fYear – $lLabel $lYear';
  }

  Widget _letterAvatar(String name) {
    return CircleAvatar(
      radius: 16,
      backgroundColor: const Color(0xFFEEF2FF),
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.bold, fontSize: 13),
      ),
    );
  }
}

class _MonthlyRow extends StatelessWidget {
  final Map<String, dynamic> charge;
  final bool isLast;
  final List<String> monthNames;
  const _MonthlyRow({required this.charge, required this.isLast, required this.monthNames});

  @override
  Widget build(BuildContext context) {
    final month = charge['month'] as int? ?? 0;
    final year = charge['year'] as int? ?? 0;
    final due = double.tryParse(charge['totalDue']?.toString() ?? '0') ?? 0;
    final paid = double.tryParse(charge['paidAmount']?.toString() ?? '0') ?? 0;
    final schoolFee = double.tryParse(charge['schoolFee']?.toString() ?? '0') ?? 0;
    final busFee = double.tryParse(charge['busFee']?.toString() ?? '0') ?? 0;
    final activityFees = double.tryParse(charge['activityFees']?.toString() ?? '0') ?? 0;
    final subsidy = double.tryParse(charge['subsidyTotal']?.toString() ?? '0') ?? 0;
    final status = charge['status'] as String? ?? 'unpaid';

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'paid':
        statusColor = const Color(0xFF16A34A);
        statusLabel = 'Πληρώθηκε';
        break;
      case 'partial':
        statusColor = const Color(0xFF2563EB);
        statusLabel = 'Μερική';
        break;
      case 'overdue':
        statusColor = const Color(0xFFDC2626);
        statusLabel = 'Ληξιπρόθεσμο';
        break;
      default:
        statusColor = const Color(0xFFD97706);
        statusLabel = 'Εκκρεμεί';
    }

    return Container(
      decoration: BoxDecoration(
        border: !isLast ? const Border(bottom: BorderSide(color: Color(0xFFF3F4F6))) : null,
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
          childrenPadding: EdgeInsets.zero,
          leading: SizedBox(
            width: 44,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  month > 0 && month < monthNames.length ? monthNames[month] : '',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF374151)),
                ),
                Text('$year', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
              ],
            ),
          ),
          title: Row(
            children: [
              Text('€${due.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF111827))),
              if (paid > 0 && status != 'paid') ...[
                const SizedBox(width: 6),
                Text('(Πλ. €${paid.toStringAsFixed(2)})',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A))),
              ],
            ],
          ),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(statusLabel,
                style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
          ),
          children: [
            Container(
              color: const Color(0xFFFAFAFF),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Column(
                children: [
                  if (schoolFee > 0) _DetailLine('Δίδακτρα σχολείου', schoolFee),
                  if (busFee > 0) _DetailLine('Σχολικό λεωφορείο', busFee),
                  if (activityFees > 0) _DetailLine('Δραστηριότητες', activityFees),
                  if (subsidy > 0) _DetailLine('Επιδότηση', -subsidy, isSubsidy: true),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  final String label;
  final double amount;
  final bool isSubsidy;
  const _DetailLine(this.label, this.amount, {this.isSubsidy = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: TextStyle(
                  fontSize: 12,
                  color: isSubsidy ? const Color(0xFF16A34A) : const Color(0xFF6B7280),
                )),
          ),
          Text(
            isSubsidy ? '−€${amount.toStringAsFixed(2)}' : '€${amount.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isSubsidy ? const Color(0xFF16A34A) : const Color(0xFF374151),
            ),
          ),
        ],
      ),
    );
  }
}

class _OneTimeRow extends StatelessWidget {
  final Map<String, dynamic> charge;
  final bool isLast;
  const _OneTimeRow({required this.charge, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final desc = charge['description'] as String? ?? 'Εφάπαξ χρέωση';
    final amt = double.tryParse(charge['amount']?.toString() ?? '0') ?? 0;
    final status = charge['status'] as String? ?? 'unpaid';
    final chargeDate = charge['chargeDate'] as String?;
    final isPaid = status == 'paid';
    final isOverdue = status == 'overdue';

    return Container(
      decoration: BoxDecoration(
        border: !isLast ? const Border(bottom: BorderSide(color: Color(0xFFF3F4F6))) : null,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.receipt_outlined, size: 14, color: Color(0xFFEA580C)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(desc, style: const TextStyle(fontSize: 13, color: Color(0xFF374151), fontWeight: FontWeight.w500)),
                if (chargeDate != null)
                  Text(_formatDate(chargeDate),
                      style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
              ],
            ),
          ),
          Text('€${amt.toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF111827))),
          const SizedBox(width: 10),
          Icon(
            isPaid ? Icons.check_circle : (isOverdue ? Icons.warning_amber : Icons.radio_button_unchecked),
            size: 18,
            color: isPaid
                ? const Color(0xFF16A34A)
                : (isOverdue ? const Color(0xFFDC2626) : const Color(0xFFD97706)),
          ),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      const months = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      return '${dt.day} ${months[dt.month]} ${dt.year}';
    } catch (_) {
      return '';
    }
  }
}
