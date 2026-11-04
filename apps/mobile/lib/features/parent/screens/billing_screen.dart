import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';
import 'billing_docs_sheet.dart';
import 'billing_events_sheet.dart';
import 'receipts_screen.dart';

/// Legacy shape used by Home pending strip (`charges/mine`).
final myChargesProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/billing/charges/mine');
    final data = resp.data;
    return data is List ? data : [];
  },
);

final myBillingOverviewProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/billing/mine/overview');
    final data = resp.data;
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  },
);

const _monthShort = ['', 'Ιαν', 'Φεβ', 'Μάρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
const _monthFull = [
  '', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

String _euro(num n) => '€${n.toStringAsFixed(2)}';

double _num(dynamic v) {
  if (v is num) return v.toDouble();
  return double.tryParse(v?.toString() ?? '') ?? 0;
}

class BillingScreen extends ConsumerWidget {
  final String schoolId;
  const BillingScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myBillingOverviewProvider(schoolId));
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Οικονομικά', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () {
              ref.invalidate(myBillingOverviewProvider(schoolId));
              ref.invalidate(myReceiptsProvider(schoolId));
            },
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFD1D5DB)),
              const SizedBox(height: 12),
              const Text('Σφάλμα φόρτωσης', style: TextStyle(color: Color(0xFF6B7280))),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(myBillingOverviewProvider(schoolId)),
                child: const Text('Δοκίμασε ξανά'),
              ),
            ],
          ),
        ),
        data: (data) {
          final summary = Map<String, dynamic>.from(data['summary'] as Map? ?? {});
          final children = (data['children'] as List? ?? [])
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          final events = (data['events'] as List? ?? [])
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          final dueDay = data['billingDueDay'] is int
              ? data['billingDueDay'] as int
              : int.tryParse(data['billingDueDay']?.toString() ?? '') ?? 10;
          final monthOwed = _num(summary['monthOwed']);
          final monthPaid = _num(summary['monthPaid']);
          final monthDue = _num(summary['monthDue']);
          final ytdPaid = _num(summary['ytdPaid']);
          final currentMonth = data['currentMonth'] is int
              ? data['currentMonth'] as int
              : DateTime.now().month;
          final currentYear = data['currentYear'] is int
              ? data['currentYear'] as int
              : DateTime.now().year;
          final schoolYear = data['schoolYear']?.toString() ?? '';

          // Merge month statuses across children for the strip
          final monthMap = <String, Map<String, dynamic>>{};
          for (final child in children) {
            for (final raw in (child['months'] as List? ?? [])) {
              if (raw is! Map) continue;
              final m = Map<String, dynamic>.from(raw);
              final key = '${m['year']}-${m['month']}';
              final prev = monthMap[key];
              if (prev == null) {
                monthMap[key] = {
                  'month': m['month'],
                  'year': m['year'],
                  'remaining': _num(m['remaining']),
                  'status': m['status'],
                  'isCurrent': m['isCurrent'] == true,
                };
              } else {
                prev['remaining'] = _num(prev['remaining']) + _num(m['remaining']);
                final st = m['status']?.toString() ?? '';
                if (st == 'unpaid' || st == 'partial') {
                  prev['status'] = st;
                } else if (prev['status'] == 'upcoming' && st == 'paid') {
                  prev['status'] = 'paid';
                }
              }
            }
          }
          final monthStrip = monthMap.values.toList()
            ..sort((a, b) {
              final ay = a['year'] as int? ?? 0;
              final by = b['year'] as int? ?? 0;
              if (ay != by) return ay.compareTo(by);
              return (a['month'] as int? ?? 0).compareTo(b['month'] as int? ?? 0);
            });

          final familyMonthLinesTotal = children.fold<double>(
            0,
            (s, c) => s + _num((c['current'] as Map?)?['totalDue']),
          );

          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () async {
              ref.invalidate(myReceiptsProvider(schoolId));
              ref.invalidate(myBillingOverviewProvider(schoolId));
              await ref.read(myBillingOverviewProvider(schoolId).future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                _FadeIn(
                  delayMs: 0,
                  reduceMotion: reduceMotion,
                  child: monthOwed > 0.01
                      ? _DueCounterBanner(billingDueDay: dueDay, monthLabel: '${_monthFull[currentMonth]} $currentYear')
                      : _AllClearBanner(monthLabel: '${_monthFull[currentMonth]} $currentYear'),
                ),
                const SizedBox(height: 12),
                _FadeIn(
                  delayMs: 40,
                  reduceMotion: reduceMotion,
                  child: _HeroCard(
                    monthOwed: monthOwed,
                    monthPaid: monthPaid,
                    monthDue: monthDue,
                    ytdPaid: ytdPaid,
                    monthLabel: _monthFull[currentMonth],
                    schoolYear: schoolYear,
                  ),
                ),
                const SizedBox(height: 18),
                _FadeIn(
                  delayMs: 80,
                  reduceMotion: reduceMotion,
                  child: _SectionTitle(
                    title: 'Τι πληρώνεις κάθε μήνα',
                    subtitle: children.length > 1
                        ? 'Σύνολο οικογένειας ${_euro(familyMonthLinesTotal)} · ${children.length} παιδιά'
                        : 'Ανάλυση χρέωσης ${_monthFull[currentMonth]}',
                  ),
                ),
                const SizedBox(height: 10),
                ...children.asMap().entries.map((entry) {
                  final i = entry.key;
                  return _FadeIn(
                    delayMs: 100 + i * 40,
                    reduceMotion: reduceMotion,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _ChildQuoteCard(child: entry.value),
                    ),
                  );
                }),
                if (children.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Text('Δεν υπάρχουν μαθητές συνδεδεμένοι.', style: TextStyle(color: Color(0xFF9CA3AF))),
                  ),
                const SizedBox(height: 8),
                _FadeIn(
                  delayMs: 160,
                  reduceMotion: reduceMotion,
                  child: _SectionTitle(
                    title: 'Μήνες σχολικού έτους',
                    subtitle: schoolYear.isNotEmpty ? schoolYear : 'Προηγούμενοι + τρέχων',
                  ),
                ),
                const SizedBox(height: 10),
                _FadeIn(
                  delayMs: 180,
                  reduceMotion: reduceMotion,
                  child: _MonthStrip(months: monthStrip),
                ),
                const SizedBox(height: 20),
                _FadeIn(
                  delayMs: 220,
                  reduceMotion: reduceMotion,
                  child: Row(
                    children: [
                      Expanded(
                        child: _ActionTile(
                          icon: Icons.description_outlined,
                          title: 'Παραστατικά',
                          subtitle: 'Κατέβασμα ανά μήνα',
                          color: const Color(0xFF059669),
                          onTap: () => showBillingDocsSheet(context, schoolId: schoolId),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _ActionTile(
                          icon: Icons.event_outlined,
                          title: 'Εκδηλώσεις',
                          subtitle: events.any((e) => e['status'] == 'pending_payment' || e['status'] == 'pending_consent')
                              ? 'Υπάρχουν εκκρεμότητες'
                              : 'Πληρωμές εκδρομών',
                          color: const Color(0xFF77328D),
                          onTap: () => showBillingEventsSheet(
                            context,
                            schoolId: schoolId,
                            events: events,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FadeIn extends StatefulWidget {
  final Widget child;
  final int delayMs;
  final bool reduceMotion;
  const _FadeIn({required this.child, required this.delayMs, required this.reduceMotion});

  @override
  State<_FadeIn> createState() => _FadeInState();
}

class _FadeInState extends State<_FadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
    _opacity = CurvedAnimation(parent: _c, curve: const Cubic(0.23, 1, 0.32, 1));
    _offset = Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: const Cubic(0.23, 1, 0.32, 1)));
    if (widget.reduceMotion) {
      _c.value = 1;
    } else {
      Future<void>.delayed(Duration(milliseconds: widget.delayMs), () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.reduceMotion) return widget.child;
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  const _SectionTitle({required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(subtitle!, style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
        ],
      ],
    );
  }
}

class _DueCounterBanner extends StatelessWidget {
  final int billingDueDay;
  final String monthLabel;
  const _DueCounterBanner({required this.billingDueDay, required this.monthLabel});

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final day = billingDueDay.clamp(1, 28);
    late final DateTime next;
    late final String headline;
    late final String message;
    late final Color bg;
    late final Color border;
    late final Color fg;

    if (today.day <= day) {
      next = DateTime(today.year, today.month, day);
      final days = next.difference(DateTime(today.year, today.month, today.day)).inDays;
      if (days == 0) {
        headline = 'Σήμερα είναι η ημέρα πληρωμής';
        message = 'Εξοφλήστε έως σήμερα ($dayη του μήνα) για $monthLabel.';
        bg = const Color(0xFFFFF7ED);
        border = const Color(0xFFFDBA74);
        fg = const Color(0xFFC2410C);
      } else {
        headline = 'Ακόμα $days ${days == 1 ? 'ημέρα' : 'ημέρες'} μέχρι την πληρωμή';
        message = 'Εξόφληση έως την $dayη του μήνα. Παρακαλούμε τακτοποιήστε εγκαίρως.';
        bg = const Color(0xFFF5F0FA);
        border = const Color(0xFFE9D5FF);
        fg = const Color(0xFF77328D);
      }
    } else {
      headline = 'Η προθεσμία πέρασε';
      message = 'Η πληρωμή ήταν έως την $dayη. Παρακαλούμε επικοινωνήστε με τη γραμματεία.';
      bg = const Color(0xFFFEF2F2);
      border = const Color(0xFFFECACA);
      fg = const Color(0xFFDC2626);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.calendar_month_rounded, color: fg, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(headline, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: fg)),
                const SizedBox(height: 2),
                Text(message, style: TextStyle(fontSize: 12, height: 1.35, color: fg.withOpacity(0.85))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AllClearBanner extends StatelessWidget {
  final String monthLabel;
  const _AllClearBanner({required this.monthLabel});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFA7F3D0)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Εξοφλημένο για $monthLabel',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF065F46)),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  final double monthOwed;
  final double monthPaid;
  final double monthDue;
  final double ytdPaid;
  final String monthLabel;
  final String schoolYear;
  const _HeroCard({
    required this.monthOwed,
    required this.monthPaid,
    required this.monthDue,
    required this.ytdPaid,
    required this.monthLabel,
    required this.schoolYear,
  });

  @override
  Widget build(BuildContext context) {
    final clear = monthOwed <= 0.01;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: clear
              ? const [Color(0xFF059669), Color(0xFF10B981)]
              : const [Color(0xFF77328D), Color(0xFFE95926)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: (clear ? const Color(0xFF059669) : const Color(0xFF77328D)).withOpacity(0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(clear ? Icons.verified_rounded : Icons.account_balance_wallet_outlined, color: Colors.white70, size: 18),
              const SizedBox(width: 8),
              Text(
                clear ? 'Όλα εντάξει αυτόν τον μήνα' : 'Εκκρεμότητες $monthLabel',
                style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            clear ? _euro(0) : _euro(monthOwed),
            style: TextStyle(
              color: clear ? Colors.white : const Color(0xFFFFE08A),
              fontSize: 34,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              height: 1.05,
            ),
          ),
          Text(
            clear ? 'Δεν οφείλεις τίποτα για τον μήνα' : 'Οφείλεται αυτόν τον μήνα',
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _HeroMetric(label: 'Μήνας', value: _euro(monthDue)),
              _HeroDivider(),
              _HeroMetric(label: 'Πληρώθηκε', value: _euro(monthPaid)),
              _HeroDivider(),
              _HeroMetric(label: 'Έχεις πληρώσει', value: _euro(ytdPaid), caption: schoolYear.isEmpty ? 'ως τώρα' : schoolYear),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroMetric extends StatelessWidget {
  final String label;
  final String value;
  final String? caption;
  const _HeroMetric({required this.label, required this.value, this.caption});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
          if (caption != null)
            Text(caption!, style: const TextStyle(color: Colors.white54, fontSize: 10)),
        ],
      ),
    );
  }
}

class _HeroDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 36, margin: const EdgeInsets.symmetric(horizontal: 8), color: Colors.white24);
  }
}

class _ChildQuoteCard extends StatelessWidget {
  final Map<String, dynamic> child;
  const _ChildQuoteCard({required this.child});

  @override
  Widget build(BuildContext context) {
    final student = Map<String, dynamic>.from(child['student'] as Map? ?? {});
    final current = Map<String, dynamic>.from(child['current'] as Map? ?? {});
    final lines = (current['lines'] as List? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final name = student['fullName']?.toString() ?? '';
    final avatar = student['avatarUrl']?.toString();
    final total = _num(current['totalDue']);
    final remaining = _num(current['remaining']);
    final status = current['status']?.toString() ?? 'unpaid';
    final paid = status == 'paid' || remaining <= 0.01;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE9D5FF)),
        boxShadow: [
          BoxShadow(color: const Color(0xFF77328D).withOpacity(0.05), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (avatar != null && avatar.isNotEmpty)
                ClipOval(
                  child: AppImage(
                    avatar,
                    width: 36,
                    height: 36,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _LetterAvatar(name),
                  ),
                )
              else
                _LetterAvatar(name),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827))),
                    Text(
                      paid ? 'Εξοφλημένο αυτόν τον μήνα' : 'Οφείλει ${_euro(remaining)}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: paid ? const Color(0xFF059669) : const Color(0xFFEA580C),
                      ),
                    ),
                  ],
                ),
              ),
              Text(_euro(total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF111827))),
            ],
          ),
          if (lines.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            const SizedBox(height: 8),
            ...lines.map((line) {
              final amount = _num(line['amount']);
              final isCredit = amount < 0;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        line['label']?.toString() ?? '',
                        style: TextStyle(
                          fontSize: 13,
                          color: isCredit ? const Color(0xFF059669) : const Color(0xFF4B5563),
                          fontWeight: isCredit ? FontWeight.w600 : FontWeight.w500,
                        ),
                      ),
                    ),
                    Text(
                      _euro(amount),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: isCredit ? const Color(0xFF059669) : const Color(0xFF111827),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _LetterAvatar extends StatelessWidget {
  final String name;
  const _LetterAvatar(this.name);

  @override
  Widget build(BuildContext context) {
    final letter = name.isNotEmpty ? name.characters.first.toUpperCase() : '?';
    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: Color(0xFFF3E8F7), shape: BoxShape.circle),
      child: Text(letter, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
    );
  }
}

class _MonthStrip extends StatefulWidget {
  final List<Map<String, dynamic>> months;
  const _MonthStrip({required this.months});

  @override
  State<_MonthStrip> createState() => _MonthStripState();
}

class _MonthStripState extends State<_MonthStrip> {
  String? _selectedKey;

  @override
  Widget build(BuildContext context) {
    if (widget.months.isEmpty) {
      return const Text('Δεν υπάρχουν μήνες ακόμα.', style: TextStyle(color: Color(0xFF9CA3AF)));
    }
    Map<String, dynamic>? selected;
    for (final m in widget.months) {
      final key = '${m['year']}-${m['month']}';
      if (_selectedKey == key) selected = m;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 78,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: widget.months.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final m = widget.months[i];
              final month = m['month'] as int? ?? 1;
              final year = m['year'] as int? ?? 0;
              final key = '$year-$month';
              final status = m['status']?.toString() ?? 'upcoming';
              final remaining = _num(m['remaining']);
              final isCurrent = m['isCurrent'] == true;
              final selected = _selectedKey == key;
              Color bg;
              Color fg;
              Color border;
              if (status == 'paid' || remaining <= 0.01) {
                bg = const Color(0xFFECFDF5);
                fg = const Color(0xFF059669);
                border = const Color(0xFFA7F3D0);
              } else if (status == 'upcoming') {
                bg = const Color(0xFFF3F4F6);
                fg = const Color(0xFF6B7280);
                border = const Color(0xFFE5E7EB);
              } else {
                bg = const Color(0xFFFFF7ED);
                fg = const Color(0xFFEA580C);
                border = const Color(0xFFFDBA74);
              }
              return GestureDetector(
                onTap: () => setState(() => _selectedKey = selected ? null : key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  curve: const Cubic(0.23, 1, 0.32, 1),
                  width: 72,
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: selected || isCurrent ? const Color(0xFF77328D) : border, width: selected || isCurrent ? 1.6 : 1),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_monthShort[month], style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: fg)),
                      const SizedBox(height: 4),
                      Icon(
                        (status == 'paid' || remaining <= 0.01)
                            ? Icons.check_circle_rounded
                            : (status == 'upcoming' ? Icons.schedule_rounded : Icons.warning_amber_rounded),
                        size: 16,
                        color: fg,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        (status == 'paid' || remaining <= 0.01)
                            ? 'OK'
                            : (status == 'upcoming' ? '—' : _euro(remaining)),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        if (selected != null) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Text(
              () {
                final month = selected!['month'] as int? ?? 1;
                final year = selected['year'] as int? ?? 0;
                final remaining = _num(selected['remaining']);
                final status = selected['status']?.toString() ?? '';
                if (status == 'paid' || remaining <= 0.01) {
                  return '${_monthFull[month]} $year · Εξοφλημένο';
                }
                if (status == 'upcoming') {
                  return '${_monthFull[month]} $year · Δεν έχει ανοίξει ακόμα';
                }
                return '${_monthFull[month]} $year · Εκκρεμεί ${_euro(remaining)}';
              }(),
              style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF374151)),
            ),
          ),
        ],
      ],
    );
  }
}

class _ActionTile extends StatefulWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  State<_ActionTile> createState() => _ActionTileState();
}

class _ActionTileState extends State<_ActionTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: widget.color.withOpacity(0.22)),
            boxShadow: [
              BoxShadow(color: widget.color.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, 4)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: widget.color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(widget.icon, color: widget.color, size: 20),
              ),
              const SizedBox(height: 12),
              Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827))),
              const SizedBox(height: 2),
              Text(widget.subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), height: 1.3)),
            ],
          ),
        ),
      ),
    );
  }
}
