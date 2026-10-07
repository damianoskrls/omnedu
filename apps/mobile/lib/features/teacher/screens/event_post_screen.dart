import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';

class EventPostScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final Map<String, dynamic> event;
  const EventPostScreen({super.key, required this.schoolId, required this.event});

  @override
  ConsumerState<EventPostScreen> createState() => _EventPostScreenState();
}

class _PendingFile {
  final XFile file;
  final bool video;
  _PendingFile(this.file, this.video);
}

class _EventPostScreenState extends ConsumerState<EventPostScreen> {
  final _picker = ImagePicker();
  late final TextEditingController _text;
  late final String _initialText;
  late List<Map<String, dynamic>> _uploaded;
  final _pending = <_PendingFile>[];
  bool _publishing = false;
  String _progress = '';

  @override
  void initState() {
    super.initState();
    _initialText = (widget.event['recap'] as String? ?? '').trim();
    _text = TextEditingController(text: _initialText);
    final raw = widget.event['postMedia'];
    _uploaded = [
      for (final item in (raw is List ? raw : const []))
        if (item is Map) Map<String, dynamic>.from(item),
    ];
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _addPhotos() async {
    final files = await _picker.pickMultiImage(imageQuality: 85);
    if (!mounted || files.isEmpty) return;
    setState(() {
      for (final file in files) {
        if (_pending.length + _uploaded.length >= 40) break;
        _pending.add(_PendingFile(file, false));
      }
    });
  }

  Future<void> _addCameraPhoto() async {
    final file = await _picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (!mounted || file == null) return;
    if (_pending.length + _uploaded.length >= 40) return;
    setState(() => _pending.add(_PendingFile(file, false)));
  }

  Future<void> _addVideo(ImageSource source) async {
    final file = await _picker.pickVideo(source: source);
    if (!mounted || file == null) return;
    if (_pending.length + _uploaded.length >= 40) return;
    setState(() => _pending.add(_PendingFile(file, true)));
  }

  Future<void> _removeUploaded(Map<String, dynamic> item) async {
    final id = item['id']?.toString() ?? '';
    final eventId = widget.event['id']?.toString() ?? '';
    if (id.isEmpty || eventId.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Αφαίρεση'),
        content: const Text('Να αφαιρεθεί αυτό το αρχείο από την ανάρτηση;'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Άκυρο')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Αφαίρεση')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(dioProvider).delete('/schools/${widget.schoolId}/events/$eventId/media/$id');
      if (mounted) setState(() => _uploaded.removeWhere((row) => row['id']?.toString() == id));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Το αρχείο δεν αφαιρέθηκε.')),
        );
      }
    }
  }

  Future<void> _publish() async {
    final eventId = widget.event['id']?.toString() ?? '';
    if (eventId.isEmpty || _publishing) return;
    setState(() {
      _publishing = true;
      _progress = '';
    });
    final dio = ref.read(dioProvider);
    var uploadedNow = 0;
    try {
      final queue = List<_PendingFile>.from(_pending);
      for (var i = 0; i < queue.length; i++) {
        final item = queue[i];
        if (mounted) setState(() => _progress = 'Ανέβασμα ${i + 1} από ${queue.length}');
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(item.file.path, filename: item.file.name),
        });
        await dio.post(
          '/schools/${widget.schoolId}/events/$eventId/media',
          data: form,
        );
        uploadedNow++;
        _pending.remove(item);
      }
      final text = _text.text.trim();
      final changed = text != _initialText || uploadedNow > 0;
      await dio.patch(
        '/schools/${widget.schoolId}/events/$eventId/recap',
        data: {'recap': text, 'notify': changed && (text.isNotEmpty || _uploaded.isNotEmpty || uploadedNow > 0)},
      );
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Η ανάρτηση δεν ανέβηκε ολόκληρη. Δοκίμασε ξανά ό,τι έμεινε.')),
        );
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

  @override
  Widget build(BuildContext context) {
    final title = widget.event['title']?.toString() ?? 'Εκδήλωση';
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Ανάρτηση εκδήλωσης'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF2C2422),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
          const SizedBox(height: 6),
          const Text(
            'Γράψε τι έγινε και διάλεξε τις φωτογραφίες και τα βίντεο. Ό,τι δεν θέλεις το αφαιρείς πριν τη δημοσίευση.',
            style: TextStyle(color: Color(0xFF6B7280), height: 1.35),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _text,
            minLines: 4,
            maxLines: 8,
            decoration: InputDecoration(
              hintText: 'Πήγαμε εκεί και τα παιδιά έκαναν...',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE7D4F0))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE7D4F0))),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _AddChip(icon: Icons.photo_library_outlined, label: 'Φωτογραφίες', onTap: _publishing ? null : _addPhotos),
              _AddChip(icon: Icons.add_a_photo_outlined, label: 'Κάμερα', onTap: _publishing ? null : _addCameraPhoto),
              _AddChip(icon: Icons.video_library_outlined, label: 'Βίντεο', onTap: _publishing ? null : () => _addVideo(ImageSource.gallery)),
              _AddChip(icon: Icons.videocam_outlined, label: 'Βίντεο κάμερα', onTap: _publishing ? null : () => _addVideo(ImageSource.camera)),
            ],
          ),
          if (_uploaded.isEmpty && _pending.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Text('Δεν έχεις διαλέξει υλικό ακόμα.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF9CA3AF))),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _uploaded.length + _pending.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemBuilder: (_, index) {
                if (index < _uploaded.length) {
                  final item = _uploaded[index];
                  final url = item['url']?.toString() ?? '';
                  final video = item['mediaType'] == 'video';
                  return _Tile(
                    video: video,
                    onRemove: _publishing ? null : () => _removeUploaded(item),
                    child: video
                        ? const ColoredBox(color: Color(0xFF2C2422), child: Icon(Icons.play_circle_fill_rounded, color: Colors.white))
                        : AppImage(url, fit: BoxFit.cover),
                  );
                }
                final item = _pending[index - _uploaded.length];
                return _Tile(
                  video: item.video,
                  onRemove: _publishing ? null : () => setState(() => _pending.remove(item)),
                  child: item.video
                      ? const ColoredBox(color: Color(0xFF2C2422), child: Icon(Icons.videocam_rounded, color: Colors.white))
                      : Image.file(File(item.file.path), fit: BoxFit.cover),
                );
              },
            ),
          const SizedBox(height: 18),
          if (_progress.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_progress, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
            ),
          FilledButton(
            onPressed: _publishing ? null : _publish,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF77328D),
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _publishing
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Δημοσίευση ανάρτησης', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _AddChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  const _AddChip({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 18, color: const Color(0xFF77328D)),
      label: Text(label),
      onPressed: onTap,
      backgroundColor: Colors.white,
      side: const BorderSide(color: Color(0xFFE7D4F0)),
    );
  }
}

class _Tile extends StatelessWidget {
  final Widget child;
  final bool video;
  final VoidCallback? onRemove;
  const _Tile({required this.child, required this.video, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        fit: StackFit.expand,
        children: [
          child,
          if (video)
            const Align(
              alignment: Alignment.bottomLeft,
              child: Padding(
                padding: EdgeInsets.all(4),
                child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 18),
              ),
            ),
          Positioned(
            top: 4,
            right: 4,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onRemove,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close_rounded, color: Colors.white, size: 16),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
