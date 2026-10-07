import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';

String _iso(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _grDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

class MealsScreen extends ConsumerWidget {
  final String schoolId;
  final String childName;
  const MealsScreen({super.key, required this.schoolId, required this.childName});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menus = ref.watch(_menusProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: Text('Φαγητό · $childName')),
      body: menus.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Δεν φορτώθηκε το διατροφολόγιο.\n$e', textAlign: TextAlign.center)),
        data: (list) {
          final now = DateTime.now();
          final days = [
            DateTime(now.year, now.month, now.day).subtract(const Duration(days: 1)),
            DateTime(now.year, now.month, now.day),
            DateTime(now.year, now.month, now.day).add(const Duration(days: 1)),
          ];
          const titles = ['Χθες', 'Σήμερα', 'Αύριο'];
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: days.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) {
              final key = _iso(days[i]);
              Map<String, dynamic>? menu;
              for (final item in list) {
                final date = item['date'] as String? ?? '';
                if (date.startsWith(key)) {
                  menu = Map<String, dynamic>.from(item as Map);
                  break;
                }
              }
              return _MenuDay(title: '${titles[i]} · ${_grDate(days[i])}', menu: menu);
            },
          );
        },
      ),
    );
  }
}

final _menusProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final now = DateTime.now();
  final from = _iso(DateTime(now.year, now.month, now.day).subtract(const Duration(days: 1)));
  final to = _iso(DateTime(now.year, now.month, now.day).add(const Duration(days: 1)));
  final resp = await dio.get('/schools/$schoolId/daily-menus', queryParameters: {'from': from, 'to': to});
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class _MenuDay extends StatelessWidget {
  final String title;
  final Map<String, dynamic>? menu;
  const _MenuDay({required this.title, required this.menu});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Πρωινό', menu?['breakfast']),
      ('Δεκατιανό', menu?['midMorning']),
      ('Μεσημεριανό', menu?['lunch']),
      ('Απογευματινό', menu?['afternoon']),
    ];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
          const SizedBox(height: 8),
          if (menu == null)
            const Text('Δεν έχει περαστεί μενού.', style: TextStyle(color: Color(0xFF9CA3AF)))
          else
            ...rows.map((r) {
              final value = (r.$2 as String?)?.trim() ?? '';
              if (value.isEmpty) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text('${r.$1}: $value'),
              );
            }),
        ],
      ),
    );
  }
}

class ChildBillingScreen extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ChildBillingScreen({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_chargesProvider(schoolId));
    final studentId = child['id'] as String? ?? '';
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: const Text('Οφειλές & πληρωμές')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Δεν φορτώθηκαν τα οικονομικά.\n$e', textAlign: TextAlign.center)),
        data: (entries) {
          Map<String, dynamic>? mine;
          for (final entry in entries) {
            final student = entry['student'] as Map?;
            if (student?['id'] == studentId) mine = Map<String, dynamic>.from(entry as Map);
          }
          if (mine == null) {
            return const Center(child: Text('Δεν υπάρχουν χρεώσεις για αυτό το παιδί.'));
          }
          final monthly = (mine['monthly'] as List?) ?? [];
          final oneTime = (mine['oneTime'] as List?) ?? [];
          final events = (mine['events'] as List?) ?? [];
          final rows = <Widget>[];
          double owed = 0;
          for (final c in monthly) {
            final due = double.tryParse(c['totalDue']?.toString() ?? '0') ?? 0;
            final paid = double.tryParse(c['paidAmount']?.toString() ?? '0') ?? 0;
            final left = due - paid <= 0 ? 0.0 : due - paid;
            owed += left;
            rows.add(_MoneyRow(
              title: 'Μηνιαία ${c['month']}/${c['year']}',
              detail: 'Πληρώθηκαν ${paid.toStringAsFixed(2)} € από ${due.toStringAsFixed(2)} €',
              amount: left,
              paid: left == 0,
            ));
          }
          for (final c in oneTime) {
            final amount = double.tryParse(c['amount']?.toString() ?? '0') ?? 0;
            final paid = (c['status'] as String?) == 'paid';
            if (!paid) owed += amount;
            rows.add(_MoneyRow(
              title: c['description'] as String? ?? 'Έκτακτη χρέωση',
              detail: paid ? 'Εξοφλήθηκε' : 'Εκκρεμεί',
              amount: paid ? 0 : amount,
              paid: paid,
            ));
          }
          for (final ev in events) {
            final event = ev['event'] as Map? ?? {};
            final cost = double.tryParse(event['costPerChild']?.toString() ?? '0') ?? 0;
            final status = ev['status'] as String? ?? '';
            final pending = status == 'pending_payment';
            if (pending) owed += cost;
            rows.add(_MoneyRow(
              title: event['title'] as String? ?? 'Εκδήλωση',
              detail: pending ? 'Αναμονή πληρωμής' : status,
              amount: pending ? cost : 0,
              paid: !pending,
            ));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFF77328D), borderRadius: BorderRadius.circular(16)),
                child: Text(
                  owed <= 0 ? 'Δεν χρωστάει κάτι' : 'Σύνολο εκκρεμών: ${owed.toStringAsFixed(2)} €',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
              const SizedBox(height: 12),
              ...rows,
            ],
          );
        },
      ),
    );
  }
}

final _chargesProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/billing/charges/mine');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class _MoneyRow extends StatelessWidget {
  final String title;
  final String detail;
  final double amount;
  final bool paid;
  const _MoneyRow({required this.title, required this.detail, required this.amount, required this.paid});
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(detail, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
              ],
            ),
          ),
          Text(
            paid ? 'ΟΚ' : '${amount.toStringAsFixed(2)} €',
            style: TextStyle(fontWeight: FontWeight.w800, color: paid ? const Color(0xFF059669) : const Color(0xFFDC2626)),
          ),
        ],
      ),
    );
  }
}

class ChildActivitiesScreen extends StatelessWidget {
  final Map<String, dynamic> child;
  const ChildActivitiesScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final regs = child['activityRegistrations'] as List<dynamic>? ?? [];
    return Scaffold(
      appBar: AppBar(title: const Text('Δραστηριότητες')),
      body: regs.isEmpty
          ? const Center(child: Text('Δεν υπάρχουν δραστηριότητες για αυτό το παιδί.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: regs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final reg = regs[i] as Map;
                final activity = reg['activity'] as Map? ?? {};
                final monthly = activity['monthlyCost'];
                return ListTile(
                  tileColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  title: Text(activity['title'] as String? ?? 'Δραστηριότητα'),
                  subtitle: Text(monthly == null ? (reg['status'] as String? ?? '') : '$monthly € / μήνα'),
                );
              },
            ),
    );
  }
}

class ServicesScreen extends StatelessWidget {
  final Map<String, dynamic> child;
  const ServicesScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final services = child['studentServices'] as List<dynamic>? ?? [];
    return Scaffold(
      appBar: AppBar(title: const Text('Παροχές & σχολικό')),
      body: services.isEmpty
          ? const Center(child: Text('Δεν έχουν καταχωρηθεί παροχές. Χωρίς σχολικό.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: services.map((raw) {
                final s = raw as Map;
                final service = s['service'] as Map? ?? {};
                final route = s['route'] as Map?;
                final stop = s['stop'] as Map?;
                final type = service['serviceType'] as String? ?? '';
                final isBus = type == 'bus' || (service['name'] as String? ?? '').toLowerCase().contains('σχολ');
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(service['name'] as String? ?? 'Παροχή', style: const TextStyle(fontWeight: FontWeight.w800)),
                      if (isBus) const Text('Έχει σχολικό', style: TextStyle(color: Color(0xFF0369A1))),
                      if (route != null) Text('Διαδρομή: ${route['name']}'),
                      if (stop != null) Text('Στάση: ${stop['name'] ?? ''} ${stop['address'] ?? ''}'),
                      if (stop?['pickupTime'] != null) Text('Παραλαβή: ${stop!['pickupTime']}'),
                      if (stop?['dropoffTime'] != null) Text('Παράδοση: ${stop!['dropoffTime']}'),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }
}

class TeachersScreen extends StatelessWidget {
  final Map<String, dynamic> child;
  const TeachersScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final enrollments = child['enrollments'] as List<dynamic>? ?? [];
    final teachers = <Map>[];
    final seen = <String>{};
    for (final enrollment in enrollments) {
      final list = enrollment['class']?['teachers'] as List<dynamic>? ?? [];
      for (final t in list) {
        final user = t['user'] as Map?;
        final id = user?['id'] as String? ?? '';
        if (user != null && seen.add(id)) teachers.add(user);
      }
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Εκπαιδευτικοί')),
      body: teachers.isEmpty
          ? const Center(child: Text('Δεν έχουν οριστεί εκπαιδευτικοί στην τάξη.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: teachers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final t = teachers[i];
                return ListTile(
                  tileColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(t['fullName'] as String? ?? ''),
                  subtitle: Text(t['phone'] as String? ?? ''),
                );
              },
            ),
    );
  }
}

class RegulationsScreen extends ConsumerWidget {
  final String schoolId;
  const RegulationsScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final school = ref.watch(_schoolProvider(schoolId));
    return Scaffold(
      appBar: AppBar(title: const Text('Κανονισμοί')),
      body: school.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if ((data['academicYear'] as String?)?.isNotEmpty == true)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('Σχολικό έτος ${data['academicYear']}', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF77328D))),
              ),
            _RegulationBlock(title: 'Κανονισμός λειτουργίας', body: data['operatingRegulation'] as String?),
            const SizedBox(height: 12),
            _RegulationBlock(title: 'Οικονομικός κανονισμός', body: data['financialRegulation'] as String?),
          ],
        ),
      ),
    );
  }
}

final _schoolProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/regulations');
  return Map<String, dynamic>.from(resp.data as Map);
});

class _RegulationBlock extends StatelessWidget {
  final String title;
  final String? body;
  const _RegulationBlock({required this.title, required this.body});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
          const SizedBox(height: 8),
          Text((body == null || body!.trim().isEmpty) ? 'Δεν έχει καταχωρηθεί ακόμα.' : body!),
        ],
      ),
    );
  }
}

class AlertsScreen extends ConsumerWidget {
  final String schoolId;
  const AlertsScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final posts = ref.watch(_postsProvider(schoolId));
    return Scaffold(
      appBar: AppBar(title: const Text('Ειδοποιήσεις')),
      body: posts.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) => list.isEmpty
            ? const Center(child: Text('Δεν υπάρχουν ανακοινώσεις.'))
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = list[i] as Map;
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p['title'] as String? ?? 'Ανακοίνωση', style: const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text(p['body'] as String? ?? p['content'] as String? ?? ''),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}

final _postsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/posts');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class QuestionnairesScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const QuestionnairesScreen({super.key, required this.schoolId, required this.child});

  @override
  ConsumerState<QuestionnairesScreen> createState() => _QuestionnairesScreenState();
}

class _QuestionnairesScreenState extends ConsumerState<QuestionnairesScreen> {
  @override
  Widget build(BuildContext context) {
    final data = ref.watch(_questionnairesProvider(widget.schoolId));
    return Scaffold(
      appBar: AppBar(title: const Text('Ερωτηματολόγια')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) {
          final sent = list.where((q) => (q['status'] as String?) == 'sent').toList();
          if (sent.isEmpty) return const Center(child: Text('Δεν υπάρχουν ανοιχτά ερωτηματολόγια.'));
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: sent.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final q = Map<String, dynamic>.from(sent[i] as Map);
              return ListTile(
                tileColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                title: Text(q['title'] as String? ?? ''),
                subtitle: Text(q['description'] as String? ?? ''),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => QuestionnaireAnswerScreen(schoolId: widget.schoolId, child: widget.child, questionnaire: q),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

final _questionnairesProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/questionnaires');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class QuestionnaireAnswerScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  final Map<String, dynamic> questionnaire;
  const QuestionnaireAnswerScreen({
    super.key,
    required this.schoolId,
    required this.child,
    required this.questionnaire,
  });

  @override
  ConsumerState<QuestionnaireAnswerScreen> createState() => _QuestionnaireAnswerScreenState();
}

class _QuestionnaireAnswerScreenState extends ConsumerState<QuestionnaireAnswerScreen> {
  final _answers = <String, String>{};
  bool _saving = false;

  List<Map<String, dynamic>> get _questions {
    final raw = widget.questionnaire['questions'];
    if (raw is List) return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    if (raw is String && raw.isNotEmpty) {
      final decoded = jsonDecode(raw);
      if (decoded is List) return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/schools/${widget.schoolId}/questionnaires/${widget.questionnaire['id']}/responses',
        data: {'studentId': widget.child['id'], 'answers': _answers},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Οι απαντήσεις αποθηκεύτηκαν.')));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Σφάλμα: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final questions = _questions;
    return Scaffold(
      appBar: AppBar(title: Text(widget.questionnaire['title'] as String? ?? 'Ερωτηματολόγιο')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ...questions.map((q) {
            final id = (q['id'] ?? q['text'] ?? '').toString();
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                decoration: InputDecoration(
                  labelText: q['text'] as String? ?? 'Ερώτηση',
                  filled: true,
                  fillColor: Colors.white,
                ),
                onChanged: (v) => _answers[id] = v,
              ),
            );
          }),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Αποθήκευση...' : 'Αποστολή'),
          ),
        ],
      ),
    );
  }
}
