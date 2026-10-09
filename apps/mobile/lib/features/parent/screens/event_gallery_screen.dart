import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_player/video_player.dart';

import '../../../core/api/api_client.dart';
import '../../../core/utils/event_status.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/app_image.dart';
import 'event_instructions.dart';

List<Map<String, dynamic>> eventMediaList(dynamic raw) {
  if (raw is! List) return [];
  return [
    for (final item in raw)
      if (item is Map) Map<String, dynamic>.from(item),
  ];
}

void openEventGallery(BuildContext context, Map event) {
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => EventGalleryScreen(
        title: event['title'] as String? ?? 'Εκδήλωση',
        eventDate: event['eventDate'] as String?,
        status: event['status'] as String?,
        description: event['description'] as String?,
        dayInstructions: event['dayInstructions'] as String?,
        arriveBy: event['arriveBy']?.toString(),
        busOperates: event['busOperates'],
        recap: event['recap'] as String?,
        media: eventMediaList(event['postMedia']),
      ),
    ),
  );
}

class EventGalleryScreen extends StatelessWidget {
  final String title;
  final String? eventDate;
  final String? status;
  final String? description;
  final String? dayInstructions;
  final String? arriveBy;
  final Object? busOperates;
  final String? recap;
  final String? detailsLine;
  final List<Map<String, dynamic>> media;

  const EventGalleryScreen({
    super.key,
    required this.title,
    required this.media,
    this.eventDate,
    this.status,
    this.description,
    this.dayInstructions,
    this.arriveBy,
    this.busOperates,
    this.recap,
    this.detailsLine,
  });

  bool get _hasPost =>
      media.isNotEmpty ||
      (recap ?? '').trim().isNotEmpty ||
      (description ?? '').trim().isNotEmpty ||
      instructionLines(dayInstructions).isNotEmpty ||
      (arriveBy ?? '').trim().isNotEmpty ||
      busRuns(busOperates) != null ||
      (detailsLine ?? '').trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
        children: [
          if (!_hasPost && eventDisplayStatus(status, eventDate) != 'completed')
            const _GalleryNotice(
              icon: Icons.photo_library_outlined,
              title: 'Το υλικό δεν είναι ακόμα διαθέσιμο',
              message: 'Ο εκπαιδευτικός ανεβάζει την ανάρτηση μετά την εκδήλωση.',
            )
          else if (!_hasPost)
            const _GalleryNotice(
              icon: Icons.photo_camera_outlined,
              title: 'Χωρίς ανάρτηση',
              message: 'Ο εκπαιδευτικός δεν έχει ανεβάσει ακόμα κείμενο, φωτογραφίες ή βίντεο.',
            )
          else ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if ((detailsLine ?? '').trim().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(detailsLine!.trim(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF77328D))),
                    ),
                  if ((description ?? '').trim().isNotEmpty) ...[
                    const Text('Περιγραφή', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF77328D))),
                    const SizedBox(height: 6),
                    Text(description!.trim(), style: const TextStyle(fontSize: 15, height: 1.45, color: Color(0xFF374151))),
                  ],
                  if (instructionLines(dayInstructions).isNotEmpty) ...[
                    const SizedBox(height: 14),
                    UsefulInstructions(text: dayInstructions),
                  ],
                  const SizedBox(height: 12),
                  EventDayFacts(arriveBy: arriveBy, busOperates: busOperates),
                  if ((recap ?? '').trim().isNotEmpty) ...[
                    if ((description ?? '').trim().isNotEmpty) const SizedBox(height: 10),
                    Text(recap!.trim(), style: const TextStyle(fontSize: 16, height: 1.45, color: Color(0xFF2C2422))),
                  ],
                  if (media.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    const Text('Πάτα ένα αρχείο για να το δεις και να το αποθηκεύσεις.', style: TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: media.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemBuilder: (_, index) {
                final item = media[index];
                final url = item['url'] as String? ?? '';
                final isVideo = item['mediaType'] == 'video';
                return GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => EventMediaViewer(url: url, isVideo: isVideo),
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: isVideo
                        ? const ColoredBox(
                            color: Color(0xFF2C2422),
                            child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 36),
                          )
                        : AppImage(url, fit: BoxFit.cover),
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _GalleryNotice extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  const _GalleryNotice({required this.icon, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 48),
      child: Column(
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
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF6B7280), height: 1.4)),
        ],
      ),
    );
  }
}

class EventMediaViewer extends StatefulWidget {
  final String url;
  final bool isVideo;
  const EventMediaViewer({super.key, required this.url, required this.isVideo});

  @override
  State<EventMediaViewer> createState() => _EventMediaViewerState();
}

class _EventMediaViewerState extends State<EventMediaViewer> {
  VideoPlayerController? _video;
  bool _saving = false;
  String? _notice;

  @override
  void initState() {
    super.initState();
    if (widget.isVideo) {
      final controller = VideoPlayerController.networkUrl(Uri.parse(fixMediaUrl(widget.url)));
      _video = controller;
      controller.initialize().then((_) {
        if (mounted) {
          setState(() {});
          controller.play();
        }
      }).catchError((_) {
        if (mounted) setState(() => _notice = 'Το βίντεο δεν άνοιξε. Μπορείς να το αποθηκεύσεις στο κινητό.');
      });
    }
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _notice = null;
    });
    try {
      final access = await Gal.hasAccess(toAlbum: true);
      if (!access) {
        final granted = await Gal.requestAccess(toAlbum: true);
        if (!granted) {
          setState(() => _notice = 'Χρειάζεται άδεια για να αποθηκευτεί στη συλλογή.');
          return;
        }
      }
      final resolved = fixMediaUrl(widget.url);
      final dir = await getTemporaryDirectory();
      final uri = Uri.parse(resolved);
      var name = uri.pathSegments.isEmpty ? 'oneirochora' : uri.pathSegments.last;
      name = name.split('?').first;
      if (!name.contains('.')) name = '$name.${widget.isVideo ? 'mp4' : 'jpg'}';
      final path = '${dir.path}/${DateTime.now().millisecondsSinceEpoch}_$name';
      await Dio().download(resolved, path);
      if (widget.isVideo) {
        await Gal.putVideo(path, album: 'Ονειροχώρα');
      } else {
        await Gal.putImage(path, album: 'Ονειροχώρα');
      }
      try {
        await File(path).delete();
      } catch (_) {}
      if (mounted) setState(() => _notice = 'Αποθηκεύτηκε στη συλλογή του κινητού.');
    } on GalException {
      if (mounted) setState(() => _notice = 'Δεν αποθηκεύτηκε. Έλεγξε την άδεια της συλλογής.');
    } catch (_) {
      if (mounted) setState(() => _notice = 'Η αποθήκευση δεν ολοκληρώθηκε.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final video = _video;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.isVideo ? 'Βίντεο' : 'Φωτογραφία'),
        actions: [
          IconButton(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.download_rounded),
            tooltip: 'Αποθήκευση',
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: widget.isVideo
                  ? (video != null && video.value.isInitialized
                      ? AspectRatio(
                          aspectRatio: video.value.aspectRatio == 0 ? 16 / 9 : video.value.aspectRatio,
                          child: VideoPlayer(video),
                        )
                      : const CircularProgressIndicator(color: Colors.white))
                  : InteractiveViewer(child: AppImage(widget.url, fit: BoxFit.contain)),
            ),
          ),
          if (widget.isVideo && video != null && video.value.isInitialized)
            IconButton(
              onPressed: () => setState(() => video.value.isPlaying ? video.pause() : video.play()),
              icon: Icon(video.value.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill, color: Colors.white, size: 42),
            ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + systemBottomInset(context)),
            child: Column(
              children: [
                if (_notice != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(_notice!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
                  ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE95926), minimumSize: const Size.fromHeight(48)),
                    onPressed: _saving ? null : _save,
                    icon: const Icon(Icons.download_rounded),
                    label: Text(_saving ? 'Αποθήκευση...' : 'Αποθήκευση στο κινητό'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
