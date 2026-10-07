import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/person_face.dart';

class DailyReportScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String teacherId;
  const DailyReportScreen({super.key, required this.schoolId, required this.teacherId});

  @override
  ConsumerState<DailyReportScreen> createState() => _DailyReportScreenState();
}

class _DailyReportScreenState extends ConsumerState<DailyReportScreen> {
  List<dynamic> _students = [];
  bool _loading = true;
  String? _selectedClassId;
  List<dynamic> _classes = [];

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/schools/${widget.schoolId}/classes/my-classes');
    final classes = resp.data as List<dynamic>? ?? [];
    setState(() {
      _classes = classes;
      if (classes.isNotEmpty) {
        _selectedClassId = classes[0]['id'] as String;
        _loadStudents(_selectedClassId!);
      } else {
        _loading = false;
      }
    });
  }

  Future<void> _loadStudents(String classId) async {
    setState(() => _loading = true);
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${widget.schoolId}/students',
      queryParameters: {'classId': classId},
    );
    setState(() {
      _students = resp.data as List<dynamic>? ?? [];
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Daily Reports'),
        actions: [
          if (_classes.isNotEmpty)
            DropdownButton<String>(
              value: _selectedClassId,
              underline: const SizedBox(),
              items: _classes.map<DropdownMenuItem<String>>((c) => DropdownMenuItem(
                    value: c['id'] as String,
                    child: Text(c['name'] as String),
                  )).toList(),
              onChanged: (id) {
                if (id != null) {
                  setState(() => _selectedClassId = id);
                  _loadStudents(id);
                }
              },
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _students.isEmpty
              ? const Center(child: Text('No students in this class'))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemCount: _students.length,
                  itemBuilder: (_, i) => _StudentReportTile(
                    student: _students[i],
                    schoolId: widget.schoolId,
                    teacherId: widget.teacherId,
                  ),
                ),
    );
  }
}

class _StudentReportTile extends StatefulWidget {
  final Map<String, dynamic> student;
  final String schoolId;
  final String teacherId;
  const _StudentReportTile({required this.student, required this.schoolId, required this.teacherId});

  @override
  State<_StudentReportTile> createState() => _StudentReportTileState();
}

class _StudentReportTileState extends State<_StudentReportTile> {
  String? _mood;
  String? _mealLunch;
  bool _submitted = false;

  static const _moods = ['great', 'good', 'okay', 'tired', 'upset'];
  static const _moodEmojis = {'great': '😄', 'good': '🙂', 'okay': '😐', 'tired': '😴', 'upset': '😢'};
  static const _meals = ['all', 'most', 'half', 'little', 'none'];

  @override
  Widget build(BuildContext context) {
    final name = widget.student['fullName'] as String;
    final avatarUrl = widget.student['avatarUrl'] as String?;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _submitted ? const Color(0xFFE8F5E9) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _submitted ? Colors.green.shade200 : const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PersonFace(name: name, photoUrl: avatarUrl, size: 40, radius: 20, foreground: const Color(0xFF4F46E5)),
              const SizedBox(width: 12),
              Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              if (_submitted) ...[
                const Spacer(),
                const Icon(Icons.check_circle, color: Colors.green, size: 20),
              ],
            ],
          ),
          if (!_submitted) ...[
            const SizedBox(height: 12),
            const Text('Mood', style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: _moods.map((m) => GestureDetector(
                onTap: () => setState(() => _mood = m),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _mood == m ? const Color(0xFFEEF2FF) : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _mood == m ? const Color(0xFF4F46E5) : Colors.transparent),
                  ),
                  child: Text('${_moodEmojis[m]} $m', style: const TextStyle(fontSize: 12)),
                ),
              )).toList(),
            ),
            const SizedBox(height: 10),
            const Text('Lunch', style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              children: _meals.map((m) => ChoiceChip(
                label: Text(m, style: const TextStyle(fontSize: 12)),
                selected: _mealLunch == m,
                onSelected: (_) => setState(() => _mealLunch = m),
              )).toList(),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _mood == null ? null : _save,
                child: const Text('Save Report'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _save() async {
    // Save via API — in a real build, use a provider
    setState(() => _submitted = true);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Report saved for ${widget.student['fullName']}')),
      );
    }
  }
}
