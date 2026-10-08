import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/person_face.dart';

const ownerPurple = Color(0xFF77328D);
const ownerInk = Color(0xFF3D1152);
const ownerOrange = Color(0xFFE95926);
const ownerMuted = Color(0xFF6B7280);

String ownerMoney(dynamic value) {
  final amount = value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
  return '${amount.toStringAsFixed(2)} €';
}

String ownerDate(dynamic value) {
  final raw = value?.toString() ?? '';
  if (raw.length < 10) return '';
  final parts = raw.substring(0, 10).split('-');
  if (parts.length != 3) return raw;
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

Map<String, dynamic> ownerMap(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

List<Map<String, dynamic>> ownerList(dynamic value) =>
    value is List ? value.whereType<Map>().map(ownerMap).toList() : const [];

void openOwnerStudent(BuildContext context, String schoolId, String studentId) {
  if (studentId.isEmpty) return;
  Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => OwnerStudentPage(schoolId: schoolId, studentId: studentId),
  ));
}

void openOwnerStaff(BuildContext context, String schoolId, String memberId) {
  if (memberId.isEmpty) return;
  Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => OwnerStaffPage(schoolId: schoolId, memberId: memberId),
  ));
}

void openOwnerClass(
  BuildContext context, {
  required String schoolId,
  required Map<String, dynamic> klass,
  List<Map<String, dynamic>>? teachers,
}) {
  Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => OwnerClassPage(schoolId: schoolId, klass: klass, teachers: teachers),
  ));
}

class OwnerHBars extends StatelessWidget {
  final List<({String label, double value})> rows;
  final Color color;
  const OwnerHBars({super.key, required this.rows, required this.color});

  @override
  Widget build(BuildContext context) {
    final maxValue = rows.fold<double>(0, (max, row) => row.value > max ? row.value : max);
    if (rows.isEmpty || maxValue <= 0) {
      return const Text('Δεν υπάρχουν δεδομένα για γράφημα.', style: TextStyle(color: ownerMuted));
    }
    return Column(
      children: [
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 92,
                  child: Text(row.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: row.value / maxValue,
                      minHeight: 10,
                      backgroundColor: const Color(0xFFF3E8F7),
                      color: color,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(width: 28, child: Text(row.value.toStringAsFixed(0), textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
              ],
            ),
          ),
      ],
    );
  }
}

class OwnerMonthChart extends StatelessWidget {
  final List<Map<String, dynamic>> series;
  final String month;
  final String year;
  const OwnerMonthChart({super.key, required this.series, required this.month, required this.year});

  @override
  Widget build(BuildContext context) {
    final maxValue = series.fold<double>(0, (max, row) {
      final due = _num(row['due']);
      final paid = _num(row['paid']);
      return due > max ? due : (paid > max ? paid : max);
    });
    if (series.isEmpty || maxValue <= 0) {
      return const Text('Δεν υπάρχουν χρεώσεις για αυτό το διάστημα.', style: TextStyle(color: ownerMuted));
    }
    return SizedBox(
      height: 148,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: series.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final row = series[index];
          final selected = '${row['month']}' == month && '${row['year']}' == year;
          return Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _Bar(value: _num(row['due']), max: maxValue, color: ownerPurple, selected: selected),
                  const SizedBox(width: 3),
                  _Bar(value: _num(row['paid']), max: maxValue, color: ownerOrange, selected: selected),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                row['label']?.toString() ?? '',
                style: TextStyle(fontSize: 11, fontWeight: selected ? FontWeight.w800 : FontWeight.w600, color: selected ? ownerPurple : ownerMuted),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  final double value;
  final double max;
  final Color color;
  final bool selected;
  const _Bar({required this.value, required this.max, required this.color, required this.selected});

  @override
  Widget build(BuildContext context) {
    final height = max <= 0 ? 0.0 : 96 * (value / max);
    return Container(
      width: selected ? 14 : 10,
      height: height < 4 && value > 0 ? 4 : height,
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6)),
    );
  }
}

class OwnerSplitBar extends StatelessWidget {
  final List<({String label, double value, Color color})> parts;
  const OwnerSplitBar({super.key, required this.parts});

  @override
  Widget build(BuildContext context) {
    final total = parts.fold<double>(0, (sum, part) => sum + part.value);
    if (total <= 0) return const Text('Δεν υπάρχουν αναλύσεις χρεώσεων.', style: TextStyle(color: ownerMuted));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            height: 14,
            child: Row(
              children: [
                for (final part in parts)
                  if (part.value > 0) Expanded(flex: (part.value * 100).round().clamp(1, 100000), child: ColoredBox(color: part.color)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 12,
          runSpacing: 6,
          children: [
            for (final part in parts)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: part.color, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Text('${part.label} ${ownerMoney(part.value)}', style: const TextStyle(fontSize: 12, color: ownerInk)),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

class OwnerClassPage extends ConsumerStatefulWidget {
  final String schoolId;
  final Map<String, dynamic> klass;
  final List<Map<String, dynamic>>? teachers;
  const OwnerClassPage({super.key, required this.schoolId, required this.klass, this.teachers});

  @override
  ConsumerState<OwnerClassPage> createState() => _OwnerClassPageState();
}

class _OwnerClassPageState extends ConsumerState<OwnerClassPage> {
  List<Map<String, dynamic>>? _loaded;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.klass['roster'] is! List) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final resp = await dio.get('/schools/${widget.schoolId}/students', queryParameters: {'classId': widget.klass['id']});
      final rows = ownerList(resp.data).map((row) => {
            'id': row['id'],
            'fullName': row['fullName'],
            'avatarUrl': row['avatarUrl'],
            'allergies': row['allergies'],
          }).toList();
      if (!mounted) return;
      setState(() => _loaded = rows);
    } catch (_) {
      if (mounted) setState(() => _error = 'Οι μαθητές δεν φορτώθηκαν');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.klass['name']?.toString() ?? 'Τάξη';
    final level = widget.klass['level']?.toString() ?? '';
    final capacity = widget.klass['capacity'];
    final teachers = widget.teachers ?? ownerList(widget.klass['teachers']);
    final roster = _loaded ?? ownerList(widget.klass['roster']);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _BackBar(title: name, subtitle: [level, if (capacity != null) 'Χωρητικότητα $capacity'].where((item) => item.isNotEmpty).join(' · ')),
          if (teachers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Εκπαιδευτικοί', style: TextStyle(fontWeight: FontWeight.w800, color: ownerPurple)),
                      const SizedBox(height: 8),
                      for (final teacher in teachers)
                        _PersonTile(
                          name: teacher['fullName']?.toString() ?? '',
                          photoUrl: teacher['avatarUrl']?.toString(),
                          subtitle: teacher['isPrimary'] == true ? 'Υπεύθυνος τάξης' : 'Εκπαιδευτικός',
                          onTap: () => openOwnerStaff(context, widget.schoolId, teacher['memberId']?.toString() ?? ''),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Text('Μαθητές · ${roster.length}', style: const TextStyle(fontWeight: FontWeight.w800, color: ownerInk)),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: ownerPurple))
                : _error != null
                    ? Center(child: Text(_error!))
                    : roster.isEmpty
                        ? const Center(child: Text('Δεν υπάρχουν μαθητές σε αυτή την τάξη.', style: TextStyle(color: ownerMuted)))
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                            itemCount: roster.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final child = roster[index];
                              final allergy = child['allergies']?.toString().trim() ?? '';
                              return _PersonTile(
                                name: child['fullName']?.toString() ?? '',
                                photoUrl: child['avatarUrl']?.toString(),
                                subtitle: allergy.isEmpty ? 'Προφίλ μαθητή' : 'Αλλεργία: $allergy',
                                onTap: () => openOwnerStudent(context, widget.schoolId, child['id']?.toString() ?? ''),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class OwnerStudentPage extends ConsumerStatefulWidget {
  final String schoolId;
  final String studentId;
  const OwnerStudentPage({super.key, required this.schoolId, required this.studentId});

  @override
  ConsumerState<OwnerStudentPage> createState() => _OwnerStudentPageState();
}

class _OwnerStudentPageState extends ConsumerState<OwnerStudentPage> {
  Map<String, dynamic>? _student;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final resp = await dio.get('/schools/${widget.schoolId}/students/${widget.studentId}');
      if (!mounted) return;
      setState(() => _student = ownerMap(resp.data));
    } catch (_) {
      if (mounted) setState(() => _error = 'Το προφίλ δεν φορτώθηκε');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openTeacher(String userId) async {
    if (userId.isEmpty) return;
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/${widget.schoolId}/staff');
    final rows = ownerList(resp.data);
    Map<String, dynamic>? match;
    for (final row in rows) {
      final user = ownerMap(row['user']);
      if (user['id']?.toString() != userId) continue;
      match = row;
      if (row['role']?.toString() == 'teacher') break;
    }
    if (!mounted || match == null) return;
    openOwnerStaff(context, widget.schoolId, match['id']?.toString() ?? '');
  }

  @override
  Widget build(BuildContext context) {
    final student = _student;
    if (_loading) {
      return const Scaffold(backgroundColor: Color(0xFFF8F4FC), body: Center(child: CircularProgressIndicator(color: ownerPurple)));
    }
    if (_error != null || student == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F4FC),
        body: Column(children: [
          const _BackBar(title: 'Μαθητής'),
          Expanded(child: Center(child: Text(_error ?? 'Το προφίλ δεν φορτώθηκε'))),
        ]),
      );
    }
    final name = student['fullName']?.toString() ?? '';
    final enrollment = ownerList(student['enrollments']).isEmpty ? null : ownerList(student['enrollments']).first;
    final klass = enrollment == null ? <String, dynamic>{} : ownerMap(enrollment['class']);
    final teachers = ownerList(klass['teachers']);
    final className = klass['name']?.toString() ?? '';
    final level = ownerMap(klass['level'])['name']?.toString() ?? '';
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          _BackBar(title: name, subtitle: [if (className.isNotEmpty) 'Τάξη $className', if (level.isNotEmpty) level].join(' · ')),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                PersonFace(name: name, photoUrl: student['avatarUrl']?.toString(), size: 72, radius: 22, fontSize: 28, background: const Color(0xFFF3E8F7)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: ownerInk)),
                      if (className.isNotEmpty) Text('Τάξη $className', style: const TextStyle(color: ownerMuted)),
                      if (teachers.isNotEmpty)
                        Text('Εκπαιδευτικός ${teachers.map((row) => ownerMap(row['user'])['fullName']).where((item) => '$item'.isNotEmpty).join(', ')}', style: const TextStyle(color: ownerMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (teachers.isNotEmpty)
            _Section(title: 'Εκπαιδευτικοί', children: [
              for (final teacher in teachers)
                _PersonTile(
                  name: ownerMap(teacher['user'])['fullName']?.toString() ?? '',
                  photoUrl: ownerMap(teacher['user'])['avatarUrl']?.toString(),
                  subtitle: teacher['isPrimary'] == true ? 'Υπεύθυνος τάξης' : 'Εκπαιδευτικός',
                  onTap: () => _openTeacher(ownerMap(teacher['user'])['id']?.toString() ?? teacher['userId']?.toString() ?? ''),
                ),
            ]),
          _Section(title: 'Στοιχεία', children: [
            _Line('Ημερομηνία γέννησης', ownerDate(student['dob'])),
            _Line('Διεύθυνση', student['address']?.toString() ?? ''),
            _Line('Ομάδα αίματος', student['bloodType']?.toString() ?? ''),
            _Line('Αλλεργίες', student['allergies']?.toString() ?? ''),
            _Line('Σημειώσεις', student['notes']?.toString() ?? ''),
            _Line('Κατάσταση', student['isActive'] == false ? 'Ανενεργός' : 'Ενεργός'),
          ]),
          _Section(title: 'Γονείς', children: [
            for (final parent in ownerList(student['parents']))
              _PersonTile(
                name: ownerMap(parent['user'])['fullName']?.toString() ?? '',
                photoUrl: ownerMap(parent['user'])['avatarUrl']?.toString(),
                subtitle: [ownerMap(parent['user'])['phone'], ownerMap(parent['user'])['email']].where((item) => item != null && '$item'.isNotEmpty).join(' · '),
              ),
          ]),
          _Section(title: 'Αδέλφια', children: [
            for (final sibling in ownerList(student['siblings']))
              _PersonTile(
                name: sibling['fullName']?.toString() ?? '',
                photoUrl: sibling['avatarUrl']?.toString(),
                subtitle: 'Προφίλ μαθητή',
                onTap: () => openOwnerStudent(context, widget.schoolId, sibling['id']?.toString() ?? ''),
              ),
          ]),
          _Section(title: 'Υπηρεσίες', children: [
            for (final row in ownerList(student['studentServices']))
              _Line(ownerMap(row['service'])['name']?.toString() ?? 'Υπηρεσία', [
                ownerMap(row['route'])['name'],
                ownerMap(row['stop'])['name'],
                ownerMap(row['service'])['serviceType'],
              ].where((item) => item != null && '$item'.isNotEmpty).join(' · ')),
          ]),
          _Section(title: 'Δραστηριότητες', children: [
            for (final row in ownerList(student['activityRegistrations']))
              _Line(ownerMap(row['activity'])['title']?.toString() ?? ownerMap(row['activity'])['name']?.toString() ?? 'Δραστηριότητα', row['status']?.toString() ?? ''),
          ]),
          _Section(title: 'Εκδηλώσεις', children: [
            for (final row in ownerList(student['eventEnrollments']))
              _Line(ownerMap(row['event'])['title']?.toString() ?? 'Εκδήλωση', ownerDate(ownerMap(row['event'])['eventDate'])),
          ]),
          _Section(title: 'Ημερήσιες αναφορές', children: [
            for (final row in ownerList(student['dailyReports']))
              _Line(ownerDate(row['reportDate']), [
                if ((row['mood']?.toString() ?? '').isNotEmpty) 'Διάθεση ${row['mood']}',
                if (row['napDurationMinutes'] != null) 'Ύπνος ${row['napDurationMinutes']}′',
                if ((row['notes']?.toString() ?? '').isNotEmpty) row['notes'],
              ].join(' · ')),
          ]),
          _Section(title: 'Τιμολόγια', children: [
            for (final row in ownerList(student['invoices']))
              _Line(row['description']?.toString().isNotEmpty == true ? row['description'].toString() : (row['invoiceNumber']?.toString() ?? 'Τιμολόγιο'), '${ownerMoney(row['amount'])} · ${_payLabel(row['status'])}'),
          ]),
          _Section(title: 'Ιστορικό τάξεων', children: [
            for (final row in ownerList(student['enrollments']))
              _Line(ownerMap(row['class'])['name']?.toString() ?? 'Τάξη', ownerMap(row['academicYear'])['label']?.toString() ?? ''),
          ]),
        ],
      ),
    );
  }
}

class OwnerStaffPage extends ConsumerStatefulWidget {
  final String schoolId;
  final String memberId;
  const OwnerStaffPage({super.key, required this.schoolId, required this.memberId});

  @override
  ConsumerState<OwnerStaffPage> createState() => _OwnerStaffPageState();
}

class _OwnerStaffPageState extends ConsumerState<OwnerStaffPage> {
  Map<String, dynamic>? _member;
  bool _loading = true;
  String? _error;

  static const _roles = {
    'teacher': 'Εκπαιδευτικός',
    'school_admin': 'Διαχειριστής',
    'owner': 'Ιδιοκτήτης',
  };
  static const _contracts = {
    'full_time': 'Πλήρης απασχόληση',
    'part_time': 'Μερική απασχόληση',
    'hourly': 'Ωρομίσθιο',
  };
  static const _leaveStatus = {
    'pending': 'Εκκρεμεί',
    'approved': 'Εγκρίθηκε',
    'rejected': 'Απορρίφθηκε',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final resp = await dio.get('/schools/${widget.schoolId}/staff/${widget.memberId}');
      if (!mounted) return;
      setState(() => _member = ownerMap(resp.data));
    } catch (_) {
      if (mounted) setState(() => _error = 'Το προφίλ δεν φορτώθηκε');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final member = _member;
    if (_loading) {
      return const Scaffold(backgroundColor: Color(0xFFF8F4FC), body: Center(child: CircularProgressIndicator(color: ownerPurple)));
    }
    if (_error != null || member == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F4FC),
        body: Column(children: [
          const _BackBar(title: 'Προσωπικό'),
          Expanded(child: Center(child: Text(_error ?? 'Το προφίλ δεν φορτώθηκε'))),
        ]),
      );
    }
    final user = ownerMap(member['user']);
    final profile = ownerMap(member['teacherProfile']);
    final name = user['fullName']?.toString() ?? '';
    final role = _roles[member['role']?.toString()] ?? '';
    final education = profile['education'] is List ? profile['education'] as List : const [];
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          _BackBar(title: name, subtitle: role),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                PersonFace(name: name, photoUrl: user['avatarUrl']?.toString(), size: 72, radius: 22, fontSize: 28, background: const Color(0xFFF3E8F7)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: ownerInk)),
                      Text(role, style: const TextStyle(color: ownerPurple, fontWeight: FontWeight.w700)),
                      if ((user['phone']?.toString() ?? '').isNotEmpty) Text(user['phone'].toString(), style: const TextStyle(color: ownerMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _Section(title: 'Στοιχεία', children: [
            _Line('Κινητό', user['phone']?.toString() ?? profile['phone']?.toString() ?? ''),
            _Line('Email', user['email']?.toString() ?? ''),
            _Line('Διεύθυνση', profile['address']?.toString() ?? ''),
            _Line('Ειδικότητα', profile['specialization']?.toString() ?? ''),
            _Line('Σύμβαση', _contracts[profile['contractType']?.toString()] ?? ''),
            _Line('Πρόσληψη', ownerDate(profile['hireDate'])),
            _Line('Μηνιαίος μισθός', profile['monthlyGross'] == null ? '' : ownerMoney(profile['monthlyGross'])),
            _Line('Ημέρες άδειας', profile['annualLeaveDays'] == null ? '' : '${profile['annualLeaveDays']}'),
            _Line('Βιογραφικό', profile['bio']?.toString() ?? ''),
          ]),
          _Section(title: 'Σπουδές', children: [
            for (final raw in education)
              if (raw is Map)
                _Line(raw['degree']?.toString() ?? 'Σπουδές', [raw['institution'], raw['year']].where((item) => item != null && '$item'.isNotEmpty).join(' · ')),
          ]),
          _Section(title: 'Τάξεις', children: [
            for (final row in ownerList(member['classes']))
              _PersonTile(
                name: ownerMap(row['class'])['name']?.toString() ?? 'Τάξη',
                subtitle: ownerMap(ownerMap(row['class'])['academicYear'])['label']?.toString() ?? '',
                onTap: () => openOwnerClass(
                  context,
                  schoolId: widget.schoolId,
                  klass: {
                    'id': ownerMap(row['class'])['id'],
                    'name': ownerMap(row['class'])['name'],
                    'level': ownerMap(ownerMap(row['class'])['academicYear'])['label'] ?? '',
                  },
                  teachers: [
                    {
                      'fullName': name,
                      'avatarUrl': user['avatarUrl'],
                      'memberId': widget.memberId,
                      'userId': user['id'],
                      'isPrimary': row['isPrimary'] == true,
                    },
                  ],
                ),
              ),
          ]),
          _Section(title: 'Μισθοδοσία', children: [
            for (final row in ownerList(profile['salaryRecords']))
              _Line('${row['month']}/${row['year']}', 'Μικτά ${ownerMoney(row['grossAmount'])} · Καθαρά ${ownerMoney(row['netAmount'])}${row['paidAt'] == null ? '' : ' · Πληρώθηκε ${ownerDate(row['paidAt'])}'}'),
          ]),
          _Section(title: 'Άδειες', children: [
            for (final row in ownerList(profile['leaveRequests']))
              _Line('${ownerDate(row['startDate'])} – ${ownerDate(row['endDate'])}', '${row['leaveType'] ?? ''} · ${_leaveStatus[row['status']?.toString()] ?? row['status'] ?? ''}'),
          ]),
        ],
      ),
    );
  }
}

class _BackBar extends StatelessWidget {
  final String title;
  final String subtitle;
  const _BackBar({required this.title, this.subtitle = ''});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 16, 12),
        child: Row(
          children: [
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_rounded, color: ownerPurple),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: ownerInk)),
                  if (subtitle.isNotEmpty) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: ownerMuted, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    final visible = children.where((child) {
      if (child is _Line) return child.filled;
      return true;
    }).toList();
    if (visible.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: ownerPurple)),
              const SizedBox(height: 6),
              ...visible,
            ],
          ),
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  final String label;
  final String value;
  const _Line(this.label, this.value);

  bool get filled => value.trim().isNotEmpty && value.trim() != '–';

  @override
  Widget build(BuildContext context) {
    if (!filled) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: ownerMuted)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, color: ownerInk)),
        ],
      ),
    );
  }
}

class _PersonTile extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final String subtitle;
  final VoidCallback? onTap;
  const _PersonTile({required this.name, this.photoUrl, this.subtitle = '', this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: const Color(0xFFFBF8FD),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                PersonFace(name: name, photoUrl: photoUrl, size: 40, radius: 12),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, color: ownerInk)),
                      if (subtitle.isNotEmpty) Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: ownerMuted)),
                    ],
                  ),
                ),
                if (onTap != null) const Icon(Icons.chevron_right_rounded, color: ownerPurple),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

double _num(dynamic value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

String _payLabel(dynamic status) {
  switch (status?.toString()) {
    case 'paid':
      return 'Πληρωμένο';
    case 'partial':
      return 'Μερικό';
    case 'unpaid':
      return 'Απλήρωτο';
    default:
      return status?.toString() ?? '';
  }
}
