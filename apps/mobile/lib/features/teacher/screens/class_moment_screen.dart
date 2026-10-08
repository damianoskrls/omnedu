import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/person_face.dart';

class ClassMomentScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String classId;
  final String className;
  final bool forClass;
  const ClassMomentScreen({
    super.key,
    required this.schoolId,
    required this.classId,
    required this.className,
    required this.forClass,
  });

  @override
  ConsumerState<ClassMomentScreen> createState() => _ClassMomentScreenState();
}

class _PendingFile {
  final XFile file;
  final bool video;
  final Uint8List? bytes;
  _PendingFile(this.file, this.video, this.bytes);
}

class _ClassMomentScreenState extends ConsumerState<ClassMomentScreen> {
  final _picker = ImagePicker();
  final _text = TextEditingController();
  final _pending = <_PendingFile>[];
  List<Map<String, dynamic>> _students = [];
  bool _loadingStudents = false;
  String? _studentId;
  bool _publishing = false;
  String _progress = '';

  @override
  void initState() {
    super.initState();
    if (!widget.forClass) _loadStudents();
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _loadStudents() async {
    setState(() => _loadingStudents = true);
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/students',
        queryParameters: {'classId': widget.classId},
      );
      final rows = resp.data is List ? resp.data as List : const [];
      if (!mounted) return;
      setState(() {
        _students = [
          for (final row in rows)
            if (row is Map) Map<String, dynamic>.from(row),
        ];
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Οι μαθητές δεν φορτώθηκαν.')));
      }
    } finally {
      if (mounted) setState(() => _loadingStudents = false);
    }
  }

  Map<String, dynamic>? get _student {
    for (final row in _students) {
      if (row['id']?.toString() == _studentId) return row;
    }
    return null;
  }

  String get _title {
    if (widget.forClass) return 'Σήμερα στην τάξη ${widget.className}';
    final name = _student?['fullName']?.toString() ?? '';
    return '$name γιορτάζει σήμερα';
  }

  Future<void> _keep(XFile file, {required bool video}) async {
    if (_pending.length >= 30) return;
    Uint8List? bytes;
    if (!video) {
      try {
        bytes = await file.readAsBytes();
      } catch (_) {}
    }
    if (!mounted || _pending.length >= 30) return;
    setState(() => _pending.add(_PendingFile(file, video, bytes)));
  }

  Future<void> _addPhotos() async {
    final files = await _picker.pickMultiImage(imageQuality: 85);
    if (!mounted || files.isEmpty) return;
    for (final file in files) {
      await _keep(file, video: false);
    }
  }

  Future<void> _addCamera() async {
    final file =
        await _picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (!mounted || file == null) return;
    await _keep(file, video: false);
  }

  Future<void> _addVideo(ImageSource source) async {
    final file = await _picker.pickVideo(source: source);
    if (!mounted || file == null) return;
    await _keep(file, video: true);
  }

  Future<void> _publish() async {
    _dismissKeyboard();
    if (_publishing) return;
    if (!widget.forClass && (_studentId == null || _studentId!.isEmpty)) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Διάλεξε παιδί.')));
      return;
    }
    final note = _text.text.trim();
    if (note.isEmpty && _pending.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Γράψε λίγα λόγια ή πρόσθεσε φωτογραφία ή βίντεο.')));
      return;
    }
    setState(() {
      _publishing = true;
      _progress = '';
    });
    final dio = ref.read(dioProvider);
    final urls = <String>[];
    try {
      for (var i = 0; i < _pending.length; i++) {
        if (mounted) {
          setState(() => _progress = 'Ανέβασμα ${i + 1} από ${_pending.length}');
        }
        final item = _pending[i];
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(item.file.path,
              filename: item.file.name),
        });
        final resp = await dio.post(
          '/schools/${widget.schoolId}/posts/media',
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
      if (mounted) setState(() => _progress = 'Δημοσίευση');
      await dio.post('/schools/${widget.schoolId}/posts', data: {
        'title': _title,
        'content': note,
        'postType': widget.forClass ? 'classroom' : 'celebration',
        'mediaUrls': urls,
        'audienceType': widget.forClass ? 'class' : 'student',
        'audienceIds': widget.forClass ? [widget.classId] : [_studentId],
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Οι γονείς ειδοποιήθηκαν.')));
        Navigator.pop(context, true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Η ανάρτηση δεν ολοκληρώθηκε. Δοκίμασε ξανά.')));
      }
    } finally {
      if (mounted) {
        setState(() {
          _publishing = false;
          _progress = '';
        });
      }
    }
  }

  void _dismissKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final student = _student;
    // Read the inset from this context, above the Scaffold. The body MediaQuery
    // drops viewInsets when the scaffold resizes, so the scroll padding would
    // otherwise stay 0 and the save button could not clear the keyboard.
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: const Color(0xFFF8F4FC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF3D1152),
        title: Text(widget.forClass ? 'Σήμερα στην τάξη' : 'Γιορτάζει'),
      ),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _dismissKeyboard,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
              16, 16, 16, 24 + systemBottomInset(context) + keyboard),
          children: [
            if (!widget.forClass) ...[
              const Text('Παιδί',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
              const SizedBox(height: 8),
              if (_loadingStudents)
                const LinearProgressIndicator(color: Color(0xFF77328D)),
              if (!_loadingStudents && _students.isEmpty)
                const Text('Δεν υπάρχουν μαθητές σε αυτή την τάξη.',
                    style: TextStyle(color: Color(0xFF6B7280))),
              for (final row in _students)
                _StudentChoice(
                  name: row['fullName']?.toString() ?? '',
                  photoUrl: row['avatarUrl']?.toString(),
                  selected: row['id']?.toString() == _studentId,
                  onTap: () =>
                      setState(() => _studentId = row['id']?.toString()),
                ),
              if (student != null) ...[
                const SizedBox(height: 12),
                Text(_title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, color: Color(0xFF3D1152))),
              ],
            ] else
              Text(
                  'Οι γονείς της τάξης ${widget.className} θα δουν το κείμενο και το υλικό.',
                  style: const TextStyle(color: Color(0xFF6B7280))),
            const SizedBox(height: 16),
            TextField(
              controller: _text,
              minLines: 4,
              maxLines: 8,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                hintText: widget.forClass
                    ? 'Σήμερα κάναμε αυτό στην τάξη...'
                    : 'Λίγα λόγια για τη στιγμή, προαιρετικά',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: Color(0xFFE9D5F2))),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                    onPressed: _publishing ? null : _addPhotos,
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Φωτογραφίες')),
                OutlinedButton.icon(
                    onPressed: _publishing ? null : _addCamera,
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Κάμερα')),
                OutlinedButton.icon(
                    onPressed: _publishing
                        ? null
                        : () => _addVideo(ImageSource.gallery),
                    icon: const Icon(Icons.video_library_outlined),
                    label: const Text('Βίντεο')),
                OutlinedButton.icon(
                    onPressed: _publishing
                        ? null
                        : () => _addVideo(ImageSource.camera),
                    icon: const Icon(Icons.videocam_outlined),
                    label: const Text('Τράβηγμα')),
              ],
            ),
            if (_pending.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                height: 96,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _pending.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, index) {
                    final item = _pending[index];
                    return Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: item.bytes != null
                              ? Image.memory(item.bytes!,
                                  width: 96, height: 96, fit: BoxFit.cover)
                              : ColoredBox(
                                  color: const Color(0xFFF3E8F7),
                                  child: SizedBox(
                                    width: 96,
                                    height: 96,
                                    child: Icon(
                                        item.video
                                            ? Icons.play_circle_fill_rounded
                                            : Icons.image_outlined,
                                        color: const Color(0xFF77328D),
                                        size: 36),
                                  ),
                                ),
                        ),
                        Positioned(
                          top: 0,
                          right: 0,
                          child: IconButton(
                            visualDensity: VisualDensity.compact,
                            onPressed: _publishing
                                ? null
                                : () =>
                                    setState(() => _pending.removeAt(index)),
                            icon: const DecoratedBox(
                              decoration: BoxDecoration(
                                  color: Color(0xCC3D1152),
                                  shape: BoxShape.circle),
                              child: Icon(Icons.cancel_rounded,
                                  color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF77328D),
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: _publishing ? null : _publish,
              child: Text(_publishing
                  ? (_progress.isEmpty ? 'Ανέβασμα...' : _progress)
                  : 'Ανέβασμα για τους γονείς'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StudentChoice extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final bool selected;
  final VoidCallback onTap;
  const _StudentChoice(
      {required this.name,
      required this.photoUrl,
      required this.selected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? const Color(0xFFF3E8F7) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                PersonFace(
                    name: name, photoUrl: photoUrl, size: 40, radius: 12),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(name,
                        style: const TextStyle(fontWeight: FontWeight.w700))),
                if (selected)
                  const Icon(Icons.check_circle_rounded,
                      color: Color(0xFF77328D)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
