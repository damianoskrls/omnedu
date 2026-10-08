import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';

final classAssignmentsProvider = FutureProvider.family<List<dynamic>, ({String schoolId, String? classId, String? studentId})>(
  (ref, key) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get(
      '/schools/${key.schoolId}/assignments',
      queryParameters: {
        if (key.classId != null && key.classId!.isNotEmpty) 'classId': key.classId,
        if (key.studentId != null && key.studentId!.isNotEmpty) 'studentId': key.studentId,
      },
    );
    return resp.data is List ? resp.data as List<dynamic> : [];
  },
);

class TeacherAssignmentsScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String? initialClassId;
  const TeacherAssignmentsScreen({super.key, required this.schoolId, this.initialClassId});

  @override
  ConsumerState<TeacherAssignmentsScreen> createState() => _TeacherAssignmentsScreenState();
}

class _TeacherAssignmentsScreenState extends ConsumerState<TeacherAssignmentsScreen> {
  String? _classId;

  @override
  void initState() {
    super.initState();
    _classId = widget.initialClassId;
  }

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(_assignmentClassesProvider(widget.schoolId));
    final classId = _classId;
    final work = classId == null
        ? const AsyncValue<List<dynamic>>.data([])
        : ref.watch(classAssignmentsProvider((schoolId: widget.schoolId, classId: classId, studentId: null)));

    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF3D1152),
        title: const Text('Εργασίες'),
      ),
      floatingActionButton: classId == null
          ? null
          : FloatingActionButton.extended(
              backgroundColor: const Color(0xFF77328D),
              foregroundColor: Colors.white,
              onPressed: () async {
                final classes = classesAsync.valueOrNull ?? [];
                final name = classes.cast<dynamic>().whereType<Map>().cast<Map>().firstWhere(
                      (row) => row['id']?.toString() == classId,
                      orElse: () => {},
                    )['name']?.toString() ??
                    'Τάξη';
                final sent = await Navigator.of(context).push<bool>(MaterialPageRoute(
                  builder: (_) => AssignmentComposer(schoolId: widget.schoolId, classId: classId, className: name),
                ));
                if (sent == true) {
                  ref.invalidate(classAssignmentsProvider((schoolId: widget.schoolId, classId: classId, studentId: null)));
                }
              },
              icon: const Icon(Icons.note_add_rounded),
              label: const Text('Νέα εργασία'),
            ),
      body: classesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Οι τάξεις δεν φορτώθηκαν.')),
        data: (classes) {
          if (classes.isEmpty) {
            return const Center(child: Text('Δεν υπάρχει τάξη για να ανεβάσεις εργασία.'));
          }
          final selected = classId ?? classes.first['id']?.toString();
          if (_classId == null && selected != null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _classId == null) setState(() => _classId = selected);
            });
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: DropdownButtonFormField<String>(
                  key: ValueKey(selected),
                  initialValue: selected,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    labelText: 'Τάξη',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  items: [
                    for (final raw in classes)
                      if (raw is Map)
                        DropdownMenuItem(
                          value: raw['id']?.toString(),
                          child: Text(raw['name']?.toString() ?? 'Τάξη'),
                        ),
                  ],
                  onChanged: (value) => setState(() => _classId = value),
                ),
              ),
              Expanded(
                child: work.when(
                  loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
                  error: (_, __) => const Center(child: Text('Οι εργασίες δεν φορτώθηκαν.')),
                  data: (rows) => rows.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32),
                            child: Text(
                              'Ανέβασε οδηγίες και ένα JPG ή PDF για να το τυπώσουν οι γονείς.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          color: const Color(0xFF77328D),
                          onRefresh: () => ref.refresh(classAssignmentsProvider((schoolId: widget.schoolId, classId: selected, studentId: null)).future),
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                            itemCount: rows.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (_, index) {
                              final row = rows[index] is Map ? Map<String, dynamic>.from(rows[index] as Map) : <String, dynamic>{};
                              return AssignmentCard(
                                assignment: row,
                                onDelete: () => _delete(row['id']?.toString() ?? '', selected ?? ''),
                              );
                            },
                          ),
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _delete(String id, String classId) async {
    if (id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Διαγραφή εργασίας'),
        content: const Text('Η εργασία θα φύγει από την εφαρμογή των γονέων.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Άκυρο')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Διαγραφή')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).delete('/schools/${widget.schoolId}/assignments/$id');
      ref.invalidate(classAssignmentsProvider((schoolId: widget.schoolId, classId: classId, studentId: null)));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η διαγραφή δεν ολοκληρώθηκε.')));
      }
    }
  }
}

final _assignmentClassesProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/classes/my-classes');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class AssignmentComposer extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;
  const AssignmentComposer({super.key, required this.schoolId, required this.classId, required this.className});

  @override
  ConsumerState<AssignmentComposer> createState() => _AssignmentComposerState();
}

class _PickedFile {
  final String name;
  final String path;
  final bool pdf;
  const _PickedFile({required this.name, required this.path, required this.pdf});
}

class _AssignmentComposerState extends ConsumerState<AssignmentComposer> {
  final _title = TextEditingController();
  final _instructions = TextEditingController();
  final _files = <_PickedFile>[];
  bool _sending = false;
  String _progress = '';

  @override
  void dispose() {
    _title.dispose();
    _instructions.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 90);
    if (!mounted || file == null || _files.length >= 6) return;
    setState(() => _files.add(_PickedFile(name: file.name, path: file.path, pdf: false)));
  }

  Future<void> _addPdf() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      withData: false,
    );
    final file = result?.files.single;
    if (!mounted || file == null || file.path == null || _files.length >= 6) return;
    final name = file.name.toLowerCase();
    setState(() => _files.add(_PickedFile(name: file.name, path: file.path!, pdf: name.endsWith('.pdf'))));
  }

  Future<void> _send() async {
    if (_sending) return;
    final title = _title.text.trim();
    final instructions = _instructions.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Γράψε τίτλο για την εργασία.')));
      return;
    }
    if (instructions.isEmpty && _files.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Γράψε οδηγίες ή πρόσθεσε JPG ή PDF.')));
      return;
    }
    setState(() {
      _sending = true;
      _progress = '';
    });
    final dio = ref.read(dioProvider);
    final urls = <String>[];
    try {
      for (var i = 0; i < _files.length; i++) {
        if (mounted) setState(() => _progress = 'Ανέβασμα ${i + 1} από ${_files.length}');
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(_files[i].path, filename: _files[i].name),
        });
        final resp = await dio.post(
          '/schools/${widget.schoolId}/assignments/media',
          data: form,
          options: Options(
            contentType: 'multipart/form-data',
            sendTimeout: const Duration(minutes: 3),
            receiveTimeout: const Duration(minutes: 3),
          ),
        );
        final data = resp.data;
        final url = data is Map ? data['url']?.toString() ?? '' : '';
        if (url.isEmpty) throw Exception('empty');
        urls.add(url);
      }
      if (mounted) setState(() => _progress = 'Αποστολή στους γονείς');
      await dio.post('/schools/${widget.schoolId}/assignments', data: {
        'classId': widget.classId,
        'title': title,
        'instructions': instructions,
        'fileUrls': urls,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η εργασία στάλθηκε στους γονείς της τάξης.')));
        Navigator.pop(context, true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η αποστολή δεν ολοκληρώθηκε. Δοκίμασε ξανά.')));
      }
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
          _progress = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF3D1152),
        title: Text('Εργασία · ${widget.className}'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          const Text(
            'Οι γονείς της τάξης βλέπουν τις οδηγίες και το αρχείο για να το τυπώσουν.',
            style: TextStyle(color: Color(0xFF6B7280), height: 1.35),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _title,
            decoration: _field('Τίτλος', 'π.χ. Φθινοπωρινό δέντρο'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _instructions,
            minLines: 4,
            maxLines: 8,
            decoration: _field('Οδηγίες', 'Τι θα τυπώσουν και πώς θα το κάνουν τα παιδιά'),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _sending ? null : _addPhoto,
                icon: const Icon(Icons.image_rounded),
                label: const Text('JPG'),
              ),
              OutlinedButton.icon(
                onPressed: _sending ? null : _addPdf,
                icon: const Icon(Icons.picture_as_pdf_rounded),
                label: const Text('PDF ή εικόνα'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < _files.length; i++)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(_files[i].pdf ? Icons.picture_as_pdf_rounded : Icons.image_rounded, color: const Color(0xFF77328D)),
              title: Text(_files[i].name, maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: IconButton(
                onPressed: _sending ? null : () => setState(() => _files.removeAt(i)),
                icon: const Icon(Icons.close_rounded),
              ),
            ),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF77328D), minimumSize: const Size.fromHeight(48)),
            onPressed: _sending ? null : _send,
            child: Text(_sending ? (_progress.isEmpty ? 'Αποστολή...' : _progress) : 'Αποστολή στους γονείς'),
          ),
        ],
      ),
    );
  }

  InputDecoration _field(String label, String hint) {
    return InputDecoration(
      filled: true,
      fillColor: Colors.white,
      labelText: label,
      hintText: hint,
      alignLabelWithHint: true,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE9D5F2))),
    );
  }
}

class AssignmentCard extends StatelessWidget {
  final Map<String, dynamic> assignment;
  final VoidCallback? onDelete;
  const AssignmentCard({super.key, required this.assignment, this.onDelete});

  @override
  Widget build(BuildContext context) {
    final title = assignment['title']?.toString() ?? 'Εργασία';
    final instructions = assignment['instructions']?.toString() ?? '';
    final author = assignment['author'] is Map ? (assignment['author'] as Map)['fullName']?.toString() ?? '' : '';
    final klass = assignment['class'] is Map ? (assignment['class'] as Map)['name']?.toString() ?? '' : '';
    final urls = assignment['fileUrls'] is List ? (assignment['fileUrls'] as List).map((item) => item.toString()).where((url) => url.isNotEmpty).toList() : <String>[];
    final created = DateTime.tryParse(assignment['createdAt']?.toString() ?? '');
    final when = created == null ? '' : '${created.day.toString().padLeft(2, '0')}/${created.month.toString().padLeft(2, '0')}/${created.year}';
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.assignment_rounded, color: Color(0xFF77328D)),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                if (onDelete != null) IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFB42318))),
              ],
            ),
            if (klass.isNotEmpty || author.isNotEmpty || when.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  [if (klass.isNotEmpty) 'Τάξη $klass', if (author.isNotEmpty) author, if (when.isNotEmpty) when].join(' · '),
                  style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                ),
              ),
            if (instructions.isNotEmpty)
              Text(instructions, style: const TextStyle(height: 1.4, color: Color(0xFF2C2422))),
            if (urls.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final url in urls) AssignmentFile(url: url),
            ],
          ],
        ),
      ),
    );
  }
}

class AssignmentFile extends StatelessWidget {
  final String url;
  const AssignmentFile({super.key, required this.url});

  bool get _pdf => url.toLowerCase().contains('.pdf') || url.toLowerCase().contains('/raw/upload/');

  Future<void> _open(BuildContext context) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Το αρχείο δεν άνοιξε.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_pdf) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: InkWell(
          onTap: () => _open(context),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: AppImage(url, height: 180, width: double.infinity, fit: BoxFit.cover),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: const Color(0xFFF3E8F7),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _open(context),
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Icon(Icons.picture_as_pdf_rounded, color: Color(0xFF77328D)),
                SizedBox(width: 8),
                Expanded(child: Text('Άνοιγμα PDF για εκτύπωση', style: TextStyle(fontWeight: FontWeight.w700))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
