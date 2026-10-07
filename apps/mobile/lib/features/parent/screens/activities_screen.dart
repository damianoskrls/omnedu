import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';

final childrenWithServicesProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/students/my-children');
    final data = resp.data;
    final children = data is List ? data as List : <dynamic>[];
    final detailed = await Future.wait(
      children.map((child) async {
        try {
          final r = await dio.get('/schools/$schoolId/students/${child['id']}');
          return r.data;
        } catch (_) {
          return child;
        }
      }),
    );
    return detailed;
  },
);

final schoolActivitiesProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, schoolId) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/$schoolId/activities');
    final data = resp.data;
    return data is List ? data : [];
  },
);

class ActivitiesScreen extends ConsumerWidget {
  final String schoolId;
  const ActivitiesScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(childrenWithServicesProvider(schoolId));
    final activitiesAsync = ref.watch(schoolActivitiesProvider(schoolId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Δραστηριότητες & Παροχές', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () {
              ref.invalidate(childrenWithServicesProvider(schoolId));
              ref.invalidate(schoolActivitiesProvider(schoolId));
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(childrenWithServicesProvider(schoolId));
          ref.invalidate(schoolActivitiesProvider(schoolId));
          await Future.wait([
            ref.read(childrenWithServicesProvider(schoolId).future),
            ref.read(schoolActivitiesProvider(schoolId).future),
          ]);
        },
        child: CustomScrollView(
          slivers: [
            // School activities with instructors section
            SliverToBoxAdapter(
              child: activitiesAsync.when(
                loading: () => const SizedBox(height: 80, child: Center(child: CircularProgressIndicator())),
                error: (_, __) => const SizedBox.shrink(),
                data: (activities) {
                  if (activities.isEmpty) return const SizedBox.shrink();
                  return _SchoolActivitiesSection(activities: activities);
                },
              ),
            ),

            // My children's registrations
            SliverToBoxAdapter(
              child: childrenAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (e, _) => Center(child: Text('Σφάλμα: $e')),
                data: (children) {
                  final registered = children.any((c) {
                    final regs = (c as Map)['activityRegistrations'];
                    return regs is List && regs.isNotEmpty;
                  });
                  final catalogEmpty = activitiesAsync.maybeWhen(data: (rows) => rows.isEmpty, orElse: () => false);
                  if (children.isNotEmpty && !registered && catalogEmpty) {
                    return const Padding(
                      padding: EdgeInsets.fromLTRB(24, 80, 24, 24),
                      child: Column(
                        children: [
                          Icon(Icons.palette_outlined, size: 72, color: Color(0xFFD1D5DB)),
                          SizedBox(height: 12),
                          Text('Χωρίς δραστηριότητες', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF2C2422))),
                          SizedBox(height: 8),
                          Text(
                            'Δεν υπάρχουν δραστηριότητες για τα παιδιά σας. Θα εμφανιστούν εδώ μόλις τις καταχωρήσει η διαχείριση.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
                          ),
                        ],
                      ),
                    );
                  }
                  if (children.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 8, 16, 10),
                        child: Text('Εγγεγραμμένες Δραστηριότητες',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                      ),
                      ...children.map((c) => _ChildServicesSection(child: c as Map<String, dynamic>)),
                      const SizedBox(height: 24),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SchoolActivitiesSection extends StatelessWidget {
  final List<dynamic> activities;
  const _SchoolActivitiesSection({required this.activities});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Text('Δραστηριότητες Σχολείου',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
        ),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: activities.length,
          itemBuilder: (_, i) => _SchoolActivityCard(activity: activities[i] as Map<String, dynamic>),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _SchoolActivityCard extends StatelessWidget {
  final Map<String, dynamic> activity;
  const _SchoolActivityCard({required this.activity});

  static const _typeIcons = {
    'excursion': (icon: Icons.directions_bus_outlined, color: Color(0xFF059669), bg: Color(0xFFECFDF5)),
    'sport': (icon: Icons.sports_soccer_outlined, color: Color(0xFF2563EB), bg: Color(0xFFEFF6FF)),
    'art': (icon: Icons.palette_outlined, color: Color(0xFF7C3AED), bg: Color(0xFFF5F3FF)),
    'music': (icon: Icons.music_note_outlined, color: Color(0xFFDB2777), bg: Color(0xFFFDF2F8)),
    'language': (icon: Icons.translate_outlined, color: Color(0xFFD97706), bg: Color(0xFFFFFBEB)),
    'other': (icon: Icons.stars_outlined, color: Color(0xFF6B7280), bg: Color(0xFFF3F4F6)),
  };

  @override
  Widget build(BuildContext context) {
    final title = activity['title'] as String? ?? '';
    final description = activity['description'] as String? ?? '';
    final type = activity['activityType'] as String? ?? 'other';
    final monthlyCost = activity['monthlyCost'];
    final startsOn = activity['startsOn'] as String?;
    final endsOn = activity['endsOn'] as String?;
    final rawLinks = activity['instructorLinks'];
    final instructorLinks = rawLinks is List ? rawLinks : [];
    final scheduleSlots = (activity['scheduleSlots'] as List? ?? []);

    final typeInfo = _typeIcons[type] ?? _typeIcons['other']!;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: typeInfo.bg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(typeInfo.icon, size: 20, color: typeInfo.color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF111827))),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                      ],
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        children: [
                          if (monthlyCost != null)
                            _Chip('€$monthlyCost/μήνα', typeInfo.color, typeInfo.bg),
                          if (startsOn != null && endsOn != null)
                            _Chip('${_shortDate(startsOn)} – ${_shortDate(endsOn)}',
                                const Color(0xFF6B7280), const Color(0xFFF3F4F6)),
                          if (scheduleSlots.isNotEmpty)
                            _Chip(_scheduleLabel(scheduleSlots[0] as Map<String, dynamic>),
                                const Color(0xFF6B7280), const Color(0xFFF3F4F6)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (instructorLinks.isNotEmpty) ...[
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Εκπαιδευτικοί',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 8),
                  ...instructorLinks.map((link) {
                    final inst = (link as Map<String, dynamic>)['instructor'] as Map<String, dynamic>? ?? {};
                    return _InstructorRow(instructor: inst);
                  }),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _shortDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      const months = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      return '${dt.day} ${months[dt.month]}';
    } catch (_) {
      return '';
    }
  }

  String _scheduleLabel(Map<String, dynamic> slot) {
    const days = ['', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];
    final dow = slot['dayOfWeek'] as int? ?? 0;
    final start = slot['startTime'] as String? ?? '';
    final end = slot['endTime'] as String? ?? '';
    final day = dow > 0 && dow < days.length ? days[dow] : '';
    return '$day $start–$end'.trim();
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color fg;
  final Color bg;
  const _Chip(this.label, this.fg, this.bg);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 11, color: fg, fontWeight: FontWeight.w500)),
    );
  }
}

class _InstructorRow extends StatelessWidget {
  final Map<String, dynamic> instructor;
  const _InstructorRow({required this.instructor});

  @override
  Widget build(BuildContext context) {
    final name = instructor['name'] as String? ?? '';
    final title = instructor['title'] as String? ?? '';
    final bio = instructor['bio'] as String? ?? '';
    final photoUrl = instructor['photoUrl'] as String?;

    return GestureDetector(
      onTap: () => _showInstructorSheet(context),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            _InstructorAvatar(name: name, photoUrl: photoUrl, radius: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF374151))),
                  if (title.isNotEmpty)
                    Text(title, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 18, color: Color(0xFFD1D5DB)),
          ],
        ),
      ),
    );
  }

  void _showInstructorSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _InstructorSheet(instructor: instructor),
    );
  }
}

class _InstructorAvatar extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final double radius;
  const _InstructorAvatar({required this.name, this.photoUrl, this.radius = 20});

  @override
  Widget build(BuildContext context) {
    if (photoUrl != null && photoUrl!.isNotEmpty) {
      return ClipOval(
        child: AppImage(
          photoUrl!,
          width: radius * 2,
          height: radius * 2,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _letterAvatar(),
        ),
      );
    }
    return _letterAvatar();
  }

  Widget _letterAvatar() {
    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFFEEF2FF),
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(
          fontSize: radius * 0.7,
          color: const Color(0xFF77328D),
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _InstructorSheet extends StatelessWidget {
  final Map<String, dynamic> instructor;
  const _InstructorSheet({required this.instructor});

  @override
  Widget build(BuildContext context) {
    final name = instructor['name'] as String? ?? '';
    final title = instructor['title'] as String? ?? '';
    final bio = instructor['bio'] as String? ?? '';
    final photoUrl = instructor['photoUrl'] as String?;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(bottom: 24),
            decoration: BoxDecoration(
              color: const Color(0xFFE5E7EB),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          _InstructorAvatar(name: name, photoUrl: photoUrl, radius: 40),
          const SizedBox(height: 16),
          Text(name,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
          if (title.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(title,
                style: const TextStyle(fontSize: 14, color: Color(0xFF77328D), fontWeight: FontWeight.w500)),
          ],
          if (bio.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                bio,
                style: const TextStyle(fontSize: 14, color: Color(0xFF374151), height: 1.6),
              ),
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ─── Child's registered services (kept from original) ───────────────────────

class _ChildServicesSection extends StatelessWidget {
  final Map<String, dynamic> child;
  const _ChildServicesSection({required this.child});

  @override
  Widget build(BuildContext context) {
    final name = child['fullName'] as String? ?? '';
    final activities = child['activityRegistrations'] as List<dynamic>? ?? [];
    final services = child['studentServices'] as List<dynamic>? ?? [];

    final activeActivities = activities.where((a) {
      final status = a['status'] as String? ?? '';
      return status != 'cancelled';
    }).toList();

    if (activeActivities.isEmpty && services.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: const Color(0xFFEEF2FF),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.bold, fontSize: 10),
                ),
              ),
              const SizedBox(width: 8),
              Text(name,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
            ],
          ),
          const SizedBox(height: 8),
          ...activeActivities.map((reg) => _ActivityTile(registration: reg as Map<String, dynamic>)),
          ...services.map((ss) => _ServiceTile(service: ss as Map<String, dynamic>)),
        ],
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  final Map<String, dynamic> registration;
  const _ActivityTile({required this.registration});

  @override
  Widget build(BuildContext context) {
    final activity = registration['activity'] as Map<String, dynamic>? ?? {};
    final title = activity['title'] as String? ?? '';
    final type = activity['activityType'] as String? ?? '';
    final monthlyCost = activity['monthlyCost'];
    final status = registration['status'] as String? ?? '';

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'approved':
        statusColor = const Color(0xFF16A34A);
        statusLabel = 'Εγκρίθηκε';
        break;
      case 'rejected':
        statusColor = const Color(0xFFDC2626);
        statusLabel = 'Απορρίφθηκε';
        break;
      default:
        statusColor = const Color(0xFFD97706);
        statusLabel = 'Αναμονή';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          const Icon(Icons.sports_soccer_outlined, size: 16, color: Color(0xFF77328D)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                if (type.isNotEmpty || monthlyCost != null)
                  Text(
                    '${_typeLabel(type)}${monthlyCost != null ? ' · €$monthlyCost/μήνα' : ''}',
                    style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(7),
            ),
            child: Text(statusLabel,
                style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  String _typeLabel(String t) {
    const map = {
      'excursion': 'Εκδρομή', 'sport': 'Αθλητισμός', 'art': 'Τέχνες',
      'music': 'Μουσική', 'language': 'Γλώσσα', 'other': 'Άλλο',
    };
    return map[t] ?? t;
  }
}

class _ServiceTile extends StatelessWidget {
  final Map<String, dynamic> service;
  const _ServiceTile({required this.service});

  @override
  Widget build(BuildContext context) {
    final svc = service['service'] as Map<String, dynamic>? ?? {};
    final name = svc['name'] as String? ?? '';
    final type = svc['serviceType'] as String? ?? '';
    final monthlyCost = svc['monthlyCost'];
    final route = service['route'] as Map<String, dynamic>?;
    final stop = service['stop'] as Map<String, dynamic>?;
    final isBus = type == 'bus';

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isBus ? const Color(0xFFD1FAE5) : const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Icon(
            isBus ? Icons.directions_bus_outlined : Icons.business_center_outlined,
            size: 16,
            color: isBus ? const Color(0xFF059669) : const Color(0xFF6B7280),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text(
                  [
                    _typeLabel(type),
                    if (monthlyCost != null) '€$monthlyCost/μήνα',
                    if (route != null) route['name'] as String? ?? '',
                    if (stop != null) stop['name'] as String? ?? '',
                  ].where((s) => s.isNotEmpty).join(' · '),
                  style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(7)),
            child: const Text('Ενεργό',
                style: TextStyle(color: Color(0xFF059669), fontSize: 10, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  String _typeLabel(String t) {
    const map = {'bus': 'Σχολικό Λεωφορείο', 'aftercare': 'Ολοήμερο', 'other': 'Άλλο'};
    return map[t] ?? t;
  }
}
