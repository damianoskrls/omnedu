import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';
import '../../parent/screens/school_posts_screen.dart';

String foundItemLetter(String item) {
  final name = item.trim().isEmpty ? 'ζακέτα' : item.trim();
  final phrase = name.toLowerCase() == 'ζακέτα' ? 'η ζακέτα της φωτογραφίας' : 'το «$name» της φωτογραφίας';
  final pronoun = name.toLowerCase() == 'ζακέτα' ? 'την' : 'το';
  return 'Αγαπητοί μας γονείς,\n'
      'έχει ξεχαστεί στο χώρο του νηπιαγωγείου $phrase. '
      'Παρακαλούμε επικοινωνήστε με τη γραμματεία του σχολείου σε περίπτωση που $pronoun έχει ξεχάσει το παιδάκι σας.\n'
      'Με εκτίμηση,\n'
      'από τη γραμματεία του σχολείου';
}

class FoundItemsScreen extends ConsumerWidget {
  final String schoolId;
  const FoundItemsScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final postsAsync = ref.watch(schoolPostsProvider((schoolId: schoolId, type: 'found', studentId: null)));
    return Scaffold(
      backgroundColor: const Color(0xFFF8F4FC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF3D1152),
        title: const Text('Ευρήματα'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF77328D),
        foregroundColor: Colors.white,
        onPressed: () async {
          final sent = await Navigator.of(context).push<bool>(MaterialPageRoute(
            builder: (_) => FoundItemComposer(schoolId: schoolId),
          ));
          if (sent == true) ref.invalidate(schoolPostsProvider((schoolId: schoolId, type: 'found', studentId: null)));
        },
        icon: const Icon(Icons.add_a_photo_rounded),
        label: const Text('Νέο εύρημα'),
      ),
      body: postsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
        error: (_, __) => const Center(child: Text('Τα ευρήματα δεν φορτώθηκαν.')),
        data: (posts) {
          if (posts.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Όταν βρεθεί κάτι στο σχολείο, ανέβασε φωτογραφία και η ενημέρωση φεύγει σε όλους τους γονείς.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.4),
                ),
              ),
            );
          }
          return RefreshIndicator(
            color: const Color(0xFF77328D),
            onRefresh: () => ref.refresh(schoolPostsProvider((schoolId: schoolId, type: 'found', studentId: null)).future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: posts.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, index) {
                final post = posts[index] is Map ? Map<String, dynamic>.from(posts[index] as Map) : <String, dynamic>{};
                return _FoundStaffCard(
                  post: post,
                  onOpen: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => SchoolPostScreen(schoolId: schoolId, postId: post['id']?.toString() ?? ''),
                  )),
                  onDelete: () => _delete(context, ref, post['id']?.toString() ?? ''),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, String id) async {
    if (id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Διαγραφή ευρήματος'),
        content: const Text('Η ενημέρωση θα φύγει από την εφαρμογή των γονέων.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Άκυρο')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Διαγραφή')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).delete('/schools/$schoolId/posts/$id');
      ref.invalidate(schoolPostsProvider((schoolId: schoolId, type: 'found', studentId: null)));
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η διαγραφή δεν ολοκληρώθηκε.')));
      }
    }
  }
}

class _FoundStaffCard extends StatelessWidget {
  final Map<String, dynamic> post;
  final VoidCallback onOpen;
  final VoidCallback onDelete;
  const _FoundStaffCard({required this.post, required this.onOpen, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final title = post['title']?.toString() ?? 'Εύρημα';
    final content = post['content']?.toString() ?? '';
    final urls = post['mediaUrls'] is List ? (post['mediaUrls'] as List).map((item) => item.toString()).toList() : <String>[];
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: urls.isEmpty
                    ? const ColoredBox(
                        color: Color(0xFFF3E8F7),
                        child: SizedBox(width: 64, height: 64, child: Icon(Icons.checkroom_rounded, color: Color(0xFF77328D))),
                      )
                    : AppImage(urls.first, width: 64, height: 64, fit: BoxFit.cover),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                    if (content.isNotEmpty)
                      Text(content, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), height: 1.3)),
                  ],
                ),
              ),
              IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFB42318))),
            ],
          ),
        ),
      ),
    );
  }
}

class FoundItemComposer extends ConsumerStatefulWidget {
  final String schoolId;
  const FoundItemComposer({super.key, required this.schoolId});

  @override
  ConsumerState<FoundItemComposer> createState() => _FoundItemComposerState();
}

class _FoundItemComposerState extends ConsumerState<FoundItemComposer> {
  final _picker = ImagePicker();
  final _item = TextEditingController(text: 'ζακέτα');
  final _letter = TextEditingController(text: foundItemLetter('ζακέτα'));
  final _photos = <XFile>[];
  bool _letterEdited = false;
  bool _sending = false;
  String _progress = '';

  @override
  void dispose() {
    _item.dispose();
    _letter.dispose();
    super.dispose();
  }

  void _setItem(String value) {
    if (!_letterEdited) _letter.text = foundItemLetter(value);
  }

  Future<void> _addPhotos() async {
    final files = await _picker.pickMultiImage(imageQuality: 85);
    if (!mounted || files.isEmpty) return;
    setState(() {
      for (final file in files) {
        if (_photos.length >= 6) break;
        _photos.add(file);
      }
    });
  }

  Future<void> _addCamera() async {
    final file = await _picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (!mounted || file == null || _photos.length >= 6) return;
    setState(() => _photos.add(file));
  }

  Future<void> _send() async {
    if (_sending) return;
    final item = _item.text.trim();
    final letter = _letter.text.trim();
    if (item.isEmpty || letter.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Συμπλήρωσε τι βρέθηκε και το κείμενο.')));
      return;
    }
    if (_photos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Πρόσθεσε φωτογραφία του αντικειμένου.')));
      return;
    }
    setState(() {
      _sending = true;
      _progress = '';
    });
    final dio = ref.read(dioProvider);
    final urls = <String>[];
    try {
      for (var i = 0; i < _photos.length; i++) {
        if (mounted) setState(() => _progress = 'Ανέβασμα ${i + 1} από ${_photos.length}');
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(_photos[i].path, filename: _photos[i].name),
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
      if (mounted) setState(() => _progress = 'Αποστολή');
      await dio.post('/schools/${widget.schoolId}/posts', data: {
        'title': 'Βρέθηκε $item',
        'content': letter,
        'postType': 'found',
        'mediaUrls': urls,
        'audienceType': 'all',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Η ενημέρωση στάλθηκε σε όλους τους γονείς.')));
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
        title: const Text('Νέο εύρημα'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          const Text(
            'Η φωτογραφία και το κείμενο φεύγουν ως ενημέρωση σε όλους τους γονείς.',
            style: TextStyle(color: Color(0xFF6B7280), height: 1.35),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _item,
            onChanged: _setItem,
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              labelText: 'Τι βρέθηκε',
              hintText: 'ζακέτα, μπουφάν, κασκόλ',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE9D5F2))),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _letter,
            minLines: 8,
            maxLines: 14,
            onChanged: (_) => _letterEdited = true,
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              labelText: 'Κείμενο για τους γονείς',
              alignLabelWithHint: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE9D5F2))),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(onPressed: _sending ? null : _addPhotos, icon: const Icon(Icons.photo_library_outlined), label: const Text('Φωτογραφίες')),
              OutlinedButton.icon(onPressed: _sending ? null : _addCamera, icon: const Icon(Icons.photo_camera_outlined), label: const Text('Κάμερα')),
            ],
          ),
          const SizedBox(height: 12),
          if (_photos.isNotEmpty)
            SizedBox(
              height: 92,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, index) {
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: FutureBuilder(
                          future: _photos[index].readAsBytes(),
                          builder: (_, snap) {
                            final bytes = snap.data;
                            if (bytes == null) {
                              return const ColoredBox(
                                color: Color(0xFFF3E8F7),
                                child: SizedBox(width: 92, height: 92, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
                              );
                            }
                            return Image.memory(bytes, width: 92, height: 92, fit: BoxFit.cover);
                          },
                        ),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: IconButton(
                          onPressed: _sending ? null : () => setState(() => _photos.removeAt(index)),
                          icon: const Icon(Icons.cancel_rounded, color: Colors.white),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE95926), minimumSize: const Size.fromHeight(48)),
            onPressed: _sending ? null : _send,
            child: Text(_sending ? (_progress.isEmpty ? 'Αποστολή...' : _progress) : 'Αποστολή σε όλους τους γονείς'),
          ),
        ],
      ),
    );
  }
}
