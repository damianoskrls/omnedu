import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/person_face.dart';
import 'owner_profiles.dart';

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
          schoolId: widget.schoolId,
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
  final String schoolId;
  final Map<String, dynamic> data;
  final String kind;
  final ValueChanged<String> onKind;
  final ValueChanged<String> onYear;
  final void Function(String month, String year) onMonth;

  const _Report({
    required this.schoolId,
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
              _Stat('Μαθητές', counts['students'], onTap: () => onKind('children')),
              _Stat('Τάξεις', counts['classes'], onTap: () => onKind('children')),
              _Stat('Γονείς', counts['parents'], onTap: () => onKind('parents')),
              _Stat('Προσωπικό', counts['staff'], onTap: () => onKind('staff')),
              _Stat('Σχολικό', counts['onBus']),
              _Stat('Αλλεργίες', counts['withAllergies']),
              _Stat('Χωρίς τάξη', counts['unassigned'], onTap: () => onKind('children')),
              _Stat('Αδέλφια', counts['siblingFamilies']),
            ],
          ),
          const SizedBox(height: 12),
          _Panel(
            title: 'Χρεώσεις έτους',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    _Legend(color: ownerPurple, label: 'Χρέωση'),
                    SizedBox(width: 12),
                    _Legend(color: ownerOrange, label: 'Πληρωμές'),
                  ],
                ),
                const SizedBox(height: 8),
                OwnerMonthChart(series: ownerList(data['monthSeries']), month: month, year: calendarYear),
                const SizedBox(height: 8),
                Text('$monthLabel · χρέωση ${ownerMoney(finances['monthDue'])} · πληρωμές ${ownerMoney(finances['monthPaid'])} · υπόλοιπο ${ownerMoney(finances['monthRemaining'])}', style: const TextStyle(color: ownerMuted, fontSize: 12)),
                const SizedBox(height: 4),
                Text('Ανοιχτοί λογαριασμοί ${finances['openCount'] ?? 0}', style: const TextStyle(color: ownerMuted, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Panel(
            title: 'Ανάλυση χρεώσεων έτους',
            child: OwnerSplitBar(parts: [
              (label: 'Δίδακτρα', value: _num(finances['schoolFees']), color: ownerOrange),
              (label: 'Σχολικό', value: _num(finances['busFees']), color: ownerPurple),
              (label: 'Δραστηριότητες', value: _num(finances['activityFees']), color: const Color(0xFFC084FC)),
            ]),
          ),
          const SizedBox(height: 12),
          _Panel(
            title: 'Μαθητές ανά τάξη',
            child: OwnerHBars(
              color: ownerPurple,
              rows: [
                for (final row in ownerList(data['classes']))
                  (label: row['name']?.toString() ?? '', value: _num(row['students'])),
              ],
            ),
          ),
        ],
        if (kind == 'owing') _People(
          title: 'Ποιοι χρωστάνε · $monthLabel',
          rows: data['owing'] is List ? data['owing'] as List : const [],
          subtitle: (row) => row['className']?.toString() ?? '',
          trailing: (row) => ownerMoney(row['remaining']),
          empty: 'Δεν υπάρχουν οφειλές για αυτόν τον μήνα.',
          onTap: (row) => openOwnerStudent(context, schoolId, row['id']?.toString() ?? ''),
        ),
        if (kind == 'parents') _Parents(schoolId: schoolId, rows: data['parents'] is List ? data['parents'] as List : const []),
        if (kind == 'children') _ChildrenBoard(
          schoolId: schoolId,
          classes: ownerList(data['classes']),
          unassigned: ownerList(data['unassigned']),
        ),
        if (kind == 'staff') _People(
          title: 'Προσωπικό',
          rows: data['staff'] is List ? data['staff'] as List : const [],
          photo: (row) => row['avatarUrl']?.toString(),
          subtitle: (row) => row['phone']?.toString() ?? '',
          trailing: (row) => _roles[row['role']?.toString()] ?? '',
          empty: 'Δεν υπάρχει προσωπικό.',
          onTap: (row) => openOwnerStaff(context, schoolId, row['id']?.toString() ?? ''),
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
  final VoidCallback? onTap;
  const _Stat(this.label, this.value, {this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          width: 104,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE9D5F2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${value ?? 0}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: ownerInk)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 11, color: ownerMuted)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  final String title;
  final Widget child;
  const _Panel({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: ownerInk)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: ownerMuted)),
      ],
    );
  }
}

class _People extends StatelessWidget {
  final String title;
  final List<dynamic> rows;
  final String Function(Map<String, dynamic> row) subtitle;
  final String Function(Map<String, dynamic> row) trailing;
  final String? Function(Map<String, dynamic> row)? photo;
  final void Function(Map<String, dynamic> row)? onTap;
  final String empty;
  const _People({required this.title, required this.rows, required this.subtitle, required this.trailing, required this.empty, this.photo, this.onTap});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (rows.isEmpty) Text(empty, style: const TextStyle(color: ownerMuted)),
          for (final raw in rows)
            if (raw is Map)
              _TapRow(
                name: raw['fullName']?.toString() ?? '',
                photoUrl: photo?.call(Map<String, dynamic>.from(raw)),
                subtitle: subtitle(Map<String, dynamic>.from(raw)),
                trailing: trailing(Map<String, dynamic>.from(raw)),
                onTap: onTap == null ? null : () => onTap!(Map<String, dynamic>.from(raw)),
              ),
        ],
      ),
    );
  }
}

class _Parents extends StatelessWidget {
  final String schoolId;
  final List<dynamic> rows;
  const _Parents({required this.schoolId, required this.rows});

  @override
  Widget build(BuildContext context) {
    final parents = rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
    if (parents.isEmpty) return const _Panel(title: 'Γονείς', child: Text('Δεν υπάρχουν γονείς.', style: TextStyle(color: ownerMuted)));
    return Column(
      children: [
        for (final parent in parents)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _Panel(
              title: parent['fullName']?.toString() ?? '',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if ((parent['phone']?.toString() ?? '').isNotEmpty)
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(parent['phone'].toString(), style: const TextStyle(color: ownerMuted))),
                  for (final child in ownerList(parent['children']))
                    _TapRow(
                      name: child['fullName']?.toString() ?? '',
                      subtitle: 'Προφίλ παιδιού',
                      trailing: '',
                      onTap: () => openOwnerStudent(context, schoolId, child['id']?.toString() ?? ''),
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _ChildrenBoard extends StatefulWidget {
  final String schoolId;
  final List<Map<String, dynamic>> classes;
  final List<Map<String, dynamic>> unassigned;
  const _ChildrenBoard({required this.schoolId, required this.classes, required this.unassigned});

  @override
  State<_ChildrenBoard> createState() => _ChildrenBoardState();
}

class _ChildrenBoardState extends State<_ChildrenBoard> {
  bool _byClass = true;

  @override
  Widget build(BuildContext context) {
    final children = <Map<String, dynamic>>[
      for (final klass in widget.classes)
        for (final child in ownerList(klass['roster']))
          {...child, 'className': klass['name'], 'classId': klass['id']},
      ...widget.unassigned,
    ]..sort((a, b) => (a['fullName']?.toString() ?? '').compareTo(b['fullName']?.toString() ?? ''));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            ChoiceChip(
              label: const Text('Τάξεις'),
              selected: _byClass,
              selectedColor: const Color(0xFFF3E8F7),
              labelStyle: TextStyle(color: _byClass ? ownerPurple : const Color(0xFF374151), fontWeight: FontWeight.w700),
              onSelected: (_) => setState(() => _byClass = true),
            ),
            const SizedBox(width: 8),
            ChoiceChip(
              label: const Text('Λίστα παιδιών'),
              selected: !_byClass,
              selectedColor: const Color(0xFFF3E8F7),
              labelStyle: TextStyle(color: !_byClass ? ownerPurple : const Color(0xFF374151), fontWeight: FontWeight.w700),
              onSelected: (_) => setState(() => _byClass = false),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_byClass) _ClassGroups(schoolId: widget.schoolId, classes: widget.classes, unassigned: widget.unassigned),
        if (!_byClass)
          _Panel(
            title: 'Όλα τα παιδιά',
            child: children.isEmpty
                ? const Text('Δεν υπάρχουν παιδιά για αυτό το έτος.', style: TextStyle(color: ownerMuted))
                : Column(
                    children: [
                      for (final child in children)
                        _TapRow(
                          name: child['fullName']?.toString() ?? '',
                          photoUrl: child['avatarUrl']?.toString(),
                          subtitle: [
                            if ((child['className']?.toString() ?? '').isNotEmpty) 'Τάξη ${child['className']}' else 'Χωρίς τάξη',
                            if ((child['allergies']?.toString() ?? '').trim().isNotEmpty) 'Αλλεργία ${child['allergies']}',
                          ].join(' · '),
                          trailing: '',
                          onTap: () => openOwnerStudent(context, widget.schoolId, child['id']?.toString() ?? ''),
                        ),
                    ],
                  ),
          ),
      ],
    );
  }
}

class _ClassGroups extends StatelessWidget {
  final String schoolId;
  final List<Map<String, dynamic>> classes;
  final List<Map<String, dynamic>> unassigned;
  const _ClassGroups({required this.schoolId, required this.classes, required this.unassigned});

  @override
  Widget build(BuildContext context) {
    if (classes.isEmpty && unassigned.isEmpty) {
      return const _Panel(title: 'Τάξεις', child: Text('Δεν υπάρχουν τάξεις για αυτό το έτος.', style: TextStyle(color: ownerMuted)));
    }
    final levels = <String, List<Map<String, dynamic>>>{};
    for (final row in classes) {
      final level = row['level']?.toString().isNotEmpty == true ? row['level'].toString() : 'Χωρίς βαθμίδα';
      levels.putIfAbsent(level, () => []).add(row);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in levels.entries) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, left: 4),
            child: Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w800, color: ownerPurple)),
          ),
          for (final klass in entry.value)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ClassCard(schoolId: schoolId, klass: klass),
            ),
        ],
        if (unassigned.isNotEmpty)
          _Panel(
            title: 'Χωρίς τάξη',
            child: Column(
              children: [
                for (final child in unassigned)
                  _TapRow(
                    name: child['fullName']?.toString() ?? '',
                    photoUrl: child['avatarUrl']?.toString(),
                    subtitle: 'Προφίλ μαθητή',
                    trailing: '',
                    onTap: () => openOwnerStudent(context, schoolId, child['id']?.toString() ?? ''),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ClassCard extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> klass;
  const _ClassCard({required this.schoolId, required this.klass});

  @override
  Widget build(BuildContext context) {
    final teachers = ownerList(klass['teachers']);
    final roster = ownerList(klass['roster']);
    final preview = roster.take(6).toList();
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => openOwnerClass(context, schoolId: schoolId, klass: klass),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(klass['name']?.toString() ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: ownerInk))),
                  Text('${klass['students'] ?? roster.length}', style: const TextStyle(fontWeight: FontWeight.w800, color: ownerPurple)),
                  const Icon(Icons.chevron_right_rounded, color: ownerPurple),
                ],
              ),
              if (teachers.isNotEmpty) ...[
                const SizedBox(height: 8),
                SizedBox(
                  height: 36,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: teachers.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final teacher = teachers[index];
                      return InkWell(
                        onTap: () => openOwnerStaff(context, schoolId, teacher['memberId']?.toString() ?? ''),
                        child: Row(
                          children: [
                            PersonFace(name: teacher['fullName']?.toString() ?? '', photoUrl: teacher['avatarUrl']?.toString(), size: 28, radius: 9, fontSize: 12),
                            const SizedBox(width: 6),
                            Text(teacher['fullName']?.toString() ?? '', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
              if (preview.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final child in preview)
                      InkWell(
                        onTap: () => openOwnerStudent(context, schoolId, child['id']?.toString() ?? ''),
                        child: PersonFace(name: child['fullName']?.toString() ?? '', photoUrl: child['avatarUrl']?.toString(), size: 36, radius: 12),
                      ),
                    if (roster.length > preview.length)
                      Text('+${roster.length - preview.length}', style: const TextStyle(color: ownerMuted, fontWeight: FontWeight.w700)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TapRow extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final String subtitle;
  final String trailing;
  final VoidCallback? onTap;
  const _TapRow({required this.name, this.photoUrl, required this.subtitle, required this.trailing, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            PersonFace(name: name, photoUrl: photoUrl, size: 36, radius: 12),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontWeight: FontWeight.w700, color: ownerInk)),
                  if (subtitle.isNotEmpty) Text(subtitle, style: const TextStyle(color: ownerMuted, fontSize: 12)),
                ],
              ),
            ),
            if (trailing.isNotEmpty) Text(trailing, style: const TextStyle(color: ownerMuted, fontSize: 12, fontWeight: FontWeight.w700)),
            if (onTap != null) const Icon(Icons.chevron_right_rounded, color: ownerPurple),
          ],
        ),
      ),
    );
  }
}

double _num(dynamic value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
