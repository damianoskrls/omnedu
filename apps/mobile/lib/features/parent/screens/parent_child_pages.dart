import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/app_image.dart';
import '../../messages/conversation_ui.dart';

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

class ParentEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  const ParentEmptyState({super.key, required this.icon, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [Color(0xFF77328D), Color(0xFFE95926)]),
              ),
              child: Icon(icon, color: Colors.white, size: 40),
            ),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(height: 1.4, color: Color(0xFF6B7280))),
          ],
        ),
      ),
    );
  }
}

final liveChildProvider = FutureProvider.family<Map<String, dynamic>, ({String schoolId, String studentId})>((ref, key) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/${key.schoolId}/students/${key.studentId}');
  return Map<String, dynamic>.from(resp.data as Map);
});

class ChildActivitiesScreen extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ChildActivitiesScreen({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final key = (schoolId: schoolId, studentId: studentId);
    final live = ref.watch(liveChildProvider(key));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Δραστηριότητες'),
        actions: [
          IconButton(onPressed: () => ref.invalidate(liveChildProvider(key)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: live.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (e, _) => ParentEmptyState(icon: Icons.cloud_off_rounded, title: 'Δεν φορτώθηκαν', message: '$e'),
        data: (data) {
          final regs = data['activityRegistrations'] as List<dynamic>? ?? [];
          if (regs.isEmpty) {
            return const ParentEmptyState(
              icon: Icons.palette_outlined,
              title: 'Χωρίς δραστηριότητες',
              message: 'Δεν έχει εγγραφεί ακόμα σε δραστηριότητα. Μόλις την προσθέσει η διαχείριση, θα εμφανιστεί εδώ.',
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(liveChildProvider(key).future),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: regs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final reg = regs[i] as Map;
                final activity = reg['activity'] as Map? ?? {};
                final monthly = activity['monthlyCost'];
                final once = activity['oneTimeCost'];
                final start = DateTime.tryParse(activity['startsOn'] as String? ?? '');
                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(activity['title'] as String? ?? 'Δραστηριότητα', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      const SizedBox(height: 6),
                      if (monthly != null) Text('$monthly € / μήνα', style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
                      if (once != null) Text('Εφάπαξ $once €'),
                      if (start != null) Text('Έναρξη ${_grDate(start)}'),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class ServicesScreen extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ServicesScreen({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final key = (schoolId: schoolId, studentId: studentId);
    final live = ref.watch(liveChildProvider(key));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Παροχές & σχολικό'),
        actions: [
          IconButton(onPressed: () => ref.invalidate(liveChildProvider(key)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: live.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (e, _) => ParentEmptyState(icon: Icons.cloud_off_rounded, title: 'Δεν φορτώθηκαν', message: '$e'),
        data: (data) {
          final services = data['studentServices'] as List<dynamic>? ?? [];
          if (services.isEmpty) {
            return const ParentEmptyState(
              icon: Icons.directions_bus_outlined,
              title: 'Χωρίς σχολικό',
              message: 'Δεν έχουν καταχωρηθεί παροχές ή σχολικό για αυτό το παιδί.',
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(liveChildProvider(key).future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: services.map((raw) => _ServiceCard(service: Map<String, dynamic>.from(raw as Map))).toList(),
            ),
          );
        },
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final Map<String, dynamic> service;
  const _ServiceCard({required this.service});

  String? _text(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
  }

  @override
  Widget build(BuildContext context) {
    final catalog = service['service'] as Map? ?? {};
    final route = service['route'] as Map?;
    final stop = service['stop'] as Map?;
    final type = catalog['serviceType'] as String? ?? '';
    final name = catalog['name'] as String? ?? 'Παροχή';
    final isBus = type == 'bus' || name.toLowerCase().contains('σχολ');
    final mode = service['serviceMode'] as String? ?? 'both';
    const modes = {'pickup': 'Μόνο παραλαβή', 'dropoff': 'Μόνο παράδοση', 'both': 'Παραλαβή και παράδοση'};
    final pickup = _text(service['pickupTime']) ?? _text(stop?['pickupTime']);
    final dropoff = _text(service['dropoffTime']) ?? _text(stop?['dropoffTime']);
    final rows = <(IconData, String)>[
      if (isBus) (Icons.directions_bus_rounded, modes[mode] ?? mode),
      if (route != null) (Icons.alt_route_rounded, 'Διαδρομή: ${route['name'] ?? ''}'),
      if (stop != null) (Icons.place_rounded, 'Στάση: ${stop['name'] ?? ''} ${stop['address'] ?? ''}'.trim()),
      if (pickup != null) (Icons.schedule_rounded, 'Παραλαβή: $pickup'),
      if (dropoff != null) (Icons.schedule_rounded, 'Παράδοση: $dropoff'),
      if (_text(service['homeAddress']) != null) (Icons.home_rounded, 'Διεύθυνση: ${service['homeAddress']}'),
      if (_text(service['pickupContact']) != null) (Icons.person_rounded, 'Παραδίδει: ${service['pickupContact']}'),
      if (_text(service['dropoffContact']) != null) (Icons.person_rounded, 'Παραλαμβάνει: ${service['dropoffContact']}'),
      if (_text(service['notes']) != null) (Icons.notes_rounded, service['notes'].toString()),
      if (catalog['monthlyCost'] != null) (Icons.euro_rounded, '${catalog['monthlyCost']} € / μήνα'),
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(isBus ? Icons.directions_bus_rounded : Icons.room_service_rounded, color: const Color(0xFF0369A1)),
              const SizedBox(width: 8),
              Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
            ],
          ),
          const SizedBox(height: 10),
          ...rows.map((row) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(row.$1, size: 16, color: const Color(0xFF77328D)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(row.$2)),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

class ChildEventsScreen extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const ChildEventsScreen({super.key, required this.schoolId, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final events = ref.watch(_childEventsProvider(schoolId));
    final studentId = child['id'] as String? ?? '';
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Εκδρομές & εκδηλώσεις'),
        actions: [
          IconButton(onPressed: () => ref.invalidate(_childEventsProvider(schoolId)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: events.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (e, _) => ParentEmptyState(icon: Icons.cloud_off_rounded, title: 'Δεν φορτώθηκαν', message: '$e'),
        data: (list) {
          final mine = list.where((item) {
            final student = item['student'] as Map?;
            return student?['id'] == studentId;
          }).toList();
          if (mine.isEmpty) {
            return const ParentEmptyState(
              icon: Icons.hiking_rounded,
              title: 'Χωρίς εκδρομές',
              message: 'Δεν υπάρχουν εκδρομές ή εκδηλώσεις για αυτό το παιδί. Θα εμφανιστούν μόλις τις δημοσιεύσει η διαχείριση.',
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(_childEventsProvider(schoolId).future),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: mine.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _ChildEventCard(enrollment: Map<String, dynamic>.from(mine[i] as Map)),
            ),
          );
        },
      ),
    );
  }
}

final _childEventsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/events/parent/my-events');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class _ChildEventCard extends StatelessWidget {
  final Map<String, dynamic> enrollment;
  const _ChildEventCard({required this.enrollment});

  @override
  Widget build(BuildContext context) {
    final event = enrollment['event'] as Map? ?? {};
    final type = event['eventType'] as String? ?? '';
    const types = {'excursion': 'Εκδρομή', 'theater': 'Θεατρικό', 'sport': 'Αθλητική', 'cultural': 'Πολιτιστική'};
    final date = DateTime.tryParse(event['eventDate'] as String? ?? '');
    final description = (event['description'] as String?)?.trim() ?? '';
    final cost = event['costPerChild'];
    final teachers = event['teachers'] as List<dynamic>? ?? [];
    final names = teachers.map((t) => (t as Map)['user']?['fullName']).whereType<String>().join(', ');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.hiking_rounded, color: Color(0xFFE95926)),
              const SizedBox(width: 8),
              Expanded(child: Text(event['title'] as String? ?? 'Εκδήλωση', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
            ],
          ),
          const SizedBox(height: 8),
          Text(types[type] ?? 'Εκδήλωση', style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
          if (date != null) Text(_grDate(date)),
          if (cost != null) Text('Κόστος: $cost €'),
          if (names.isNotEmpty) Text('Εκπαιδευτικοί: $names'),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(description, style: const TextStyle(height: 1.4)),
          ],
        ],
      ),
    );
  }
}

class _ClassTeacher {
  final String id;
  final String name;
  final String? avatarUrl;
  final String className;
  const _ClassTeacher({required this.id, required this.name, required this.avatarUrl, required this.className});
}

List<_ClassTeacher> _teachersOf(dynamic student) {
  if (student is! Map) return [];
  final enrollments = student['enrollments'] as List<dynamic>? ?? [];
  final teachers = <_ClassTeacher>[];
  final seen = <String>{};
  for (final enrollment in enrollments) {
    if (enrollment is! Map) continue;
    final klass = enrollment['class'];
    if (klass is! Map) continue;
    final className = klass['name'] as String? ?? '';
    final list = klass['teachers'] as List<dynamic>? ?? [];
    for (final row in list) {
      if (row is! Map) continue;
      final user = row['user'];
      if (user is! Map) continue;
      final id = user['id'] as String? ?? '';
      final name = (user['fullName'] as String?)?.trim() ?? '';
      if (id.isEmpty || name.isEmpty || !seen.add(id)) continue;
      teachers.add(_ClassTeacher(
        id: id,
        name: name,
        avatarUrl: user['avatarUrl'] as String?,
        className: className,
      ));
    }
  }
  return teachers;
}

final parentTeachersProvider = FutureProvider.family<List<_ClassTeacher>, ({String schoolId, String studentId})>((ref, key) async {
  final dio = ref.read(dioProvider);
  final found = <_ClassTeacher>[];
  final seen = <String>{};
  void addAll(dynamic student) {
    for (final teacher in _teachersOf(student)) {
      if (seen.add(teacher.id)) found.add(teacher);
    }
  }

  try {
    final mine = await dio.get('/schools/${key.schoolId}/students/my-children');
    if (mine.data is List) {
      for (final row in mine.data as List) {
        if (row is Map && row['id'] == key.studentId) addAll(row);
      }
    }
  } catch (_) {}
  if (found.isEmpty) {
    try {
      final one = await dio.get('/schools/${key.schoolId}/students/${key.studentId}');
      addAll(one.data);
    } catch (_) {}
  }
  return found;
});

class TeachersScreen extends ConsumerWidget {
  final String schoolId;
  final Map<String, dynamic> child;
  const TeachersScreen({super.key, required this.schoolId, required this.child});

  Future<void> _message(BuildContext context, WidgetRef ref, _ClassTeacher teacher) async {
    final parentId = ref.read(authProvider).user?.id;
    if (parentId == null) return;
    try {
      final id = await openScopedConversation(
        ref,
        schoolId: schoolId,
        kind: 'teacher',
        withUserId: teacher.id,
        participantIds: [parentId, teacher.id],
      );
      if (id == null || !context.mounted) return;
      final subtitle = teacher.className.isEmpty ? 'Εκπαιδευτικός' : teacher.className;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            schoolId: schoolId,
            convId: id,
            title: teacher.name,
            subtitle: subtitle,
            currentUserId: parentId,
          ),
        ),
      );
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorText(error))));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentId = child['id'] as String? ?? '';
    final key = (schoolId: schoolId, studentId: studentId);
    final live = ref.watch(parentTeachersProvider(key));
    final fallback = _teachersOf(child);
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Εκπαιδευτικοί'),
        actions: [
          IconButton(onPressed: () => ref.invalidate(parentTeachersProvider(key)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: live.when(
        loading: () => fallback.isEmpty
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
            : _TeacherList(teachers: fallback, onMessage: (teacher) => _message(context, ref, teacher)),
        error: (_, __) => fallback.isEmpty
            ? const ParentEmptyState(
                icon: Icons.groups_outlined,
                title: 'Χωρίς εκπαιδευτικούς',
                message: 'Δεν έχουν οριστεί εκπαιδευτικοί στην τάξη του παιδιού.',
              )
            : _TeacherList(teachers: fallback, onMessage: (teacher) => _message(context, ref, teacher)),
        data: (teachers) {
          final rows = teachers.isNotEmpty ? teachers : fallback;
          if (rows.isEmpty) {
            return const ParentEmptyState(
              icon: Icons.groups_outlined,
              title: 'Χωρίς εκπαιδευτικούς',
              message: 'Δεν έχουν οριστεί εκπαιδευτικοί στην τάξη του παιδιού.',
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(parentTeachersProvider(key).future),
            child: _TeacherList(teachers: rows, onMessage: (teacher) => _message(context, ref, teacher)),
          );
        },
      ),
    );
  }
}

class _TeacherList extends StatelessWidget {
  final List<_ClassTeacher> teachers;
  final ValueChanged<_ClassTeacher> onMessage;
  const _TeacherList({required this.teachers, required this.onMessage});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: teachers.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final teacher = teachers[i];
        final photo = teacher.avatarUrl;
        return Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => onMessage(teacher),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: photo != null && photo.isNotEmpty
                        ? AppImage(
                            photo,
                            width: 48,
                            height: 48,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _teacherLetter(teacher.name),
                          )
                        : _teacherLetter(teacher.name),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(teacher.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        const SizedBox(height: 2),
                        Text(
                          teacher.className.isEmpty ? 'Εκπαιδευτικός' : 'Τάξη ${teacher.className}',
                          style: const TextStyle(color: Color(0xFF6B7280)),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF77328D)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

Widget _teacherLetter(String name) {
  return Container(
    width: 48,
    height: 48,
    color: const Color(0xFFF6F3FA),
    alignment: Alignment.center,
    child: Text(
      name.isNotEmpty ? name[0].toUpperCase() : '?',
      style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w800, fontSize: 18),
    ),
  );
}

class RegulationsScreen extends ConsumerWidget {
  final String schoolId;
  const RegulationsScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final school = ref.watch(_regulationsProvider(schoolId));
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Κανονισμοί'),
        actions: [
          IconButton(onPressed: () => ref.invalidate(_regulationsProvider(schoolId)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: school.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (e, _) => ParentEmptyState(
          icon: Icons.gavel_rounded,
          title: 'Οι κανονισμοί δεν φορτώθηκαν',
          message: 'Τράβηξε προς τα κάτω για ανανέωση μόλις η διαχείριση τους αποθηκεύσει.\n$e',
        ),
        data: (data) {
          final operating = data['operatingRegulation'] as String?;
          final financial = data['financialRegulation'] as String?;
          final empty = (operating == null || operating.trim().isEmpty) && (financial == null || financial.trim().isEmpty);
          if (empty) {
            return const ParentEmptyState(
              icon: Icons.menu_book_outlined,
              title: 'Δεν έχουν καταχωρηθεί',
              message: 'Ο διαχειριστής δεν έχει αποθηκεύσει ακόμα κανονισμό για αυτό το σχολικό έτος.',
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(_regulationsProvider(schoolId).future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                if ((data['academicYear'] as String?)?.isNotEmpty == true)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text('Σχολικό έτος ${data['academicYear']}', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF77328D))),
                  ),
                _RegulationBlock(title: 'Κανονισμός λειτουργίας', body: operating),
                const SizedBox(height: 12),
                _RegulationBlock(title: 'Οικονομικός κανονισμός', body: financial),
              ],
            ),
          );
        },
      ),
    );
  }
}

final _regulationsProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  Map<String, dynamic>? fromYear;
  try {
    final resp = await dio.get('/schools/$schoolId/regulations');
    if (resp.data is Map) fromYear = Map<String, dynamic>.from(resp.data as Map);
  } catch (_) {}
  final operating = (fromYear?['operatingRegulation'] as String?)?.trim() ?? '';
  final financial = (fromYear?['financialRegulation'] as String?)?.trim() ?? '';
  if (operating.isNotEmpty || financial.isNotEmpty) return fromYear!;
  try {
    final school = await dio.get('/schools/$schoolId');
    if (school.data is Map) {
      final row = Map<String, dynamic>.from(school.data as Map);
      final op = (row['operatingRegulation'] as String?)?.trim() ?? '';
      final fin = (row['financialRegulation'] as String?)?.trim() ?? '';
      if (op.isNotEmpty || fin.isNotEmpty) {
        return {
          'academicYear': fromYear?['academicYear'],
          'operatingRegulation': row['operatingRegulation'],
          'financialRegulation': row['financialRegulation'],
        };
      }
    }
  } catch (_) {}
  return fromYear ?? {'academicYear': null, 'operatingRegulation': null, 'financialRegulation': null};
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
