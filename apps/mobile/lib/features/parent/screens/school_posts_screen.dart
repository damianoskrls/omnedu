import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/person_face.dart';
import 'event_gallery_screen.dart';

bool postMediaIsVideo(String url) {
  final value = url.toLowerCase();
  return value.contains('/video/upload/') || value.contains('.mp4') || value.contains('.mov') || value.contains('.m4v') || value.contains('.webm');
}

final schoolPostsProvider = FutureProvider.family<List<dynamic>, ({String schoolId, String? type, String? studentId})>(
  (ref, args) async {
    final dio = ref.read(dioProvider);
    final params = <String, String>{};
    if (args.type != null) params['type'] = args.type!;
    if (args.studentId != null && args.studentId!.isNotEmpty) params['studentId'] = args.studentId!;
    final resp = await dio.get('/schools/${args.schoolId}/posts', queryParameters: params.isEmpty ? null : params);
    final data = resp.data;
    return data is List ? data : [];
  },
);

class SchoolPostsScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String? studentId;
  final String? noticeType;
  final String title;
  const SchoolPostsScreen({super.key, required this.schoolId, this.studentId, this.noticeType, this.title = 'Νέα & Εκδηλώσεις'});

  @override
  ConsumerState<SchoolPostsScreen> createState() => _SchoolPostsScreenState();
}

class _SchoolPostsScreenState extends ConsumerState<SchoolPostsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  final _tabs = const [
    (label: 'Όλα', type: null),
    (label: 'Στιγμές', type: 'moment'),
    (label: 'Εκδρομές', type: 'excursion'),
    (label: 'Θέατρο', type: 'theater'),
    (label: 'Εκδηλώσεις', type: 'event'),
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        bottom: widget.studentId != null || widget.noticeType != null
            ? null
            : TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          labelColor: const Color(0xFF77328D),
          unselectedLabelColor: const Color(0xFF9CA3AF),
          indicatorColor: const Color(0xFF77328D),
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: _tabs.map((t) => Tab(text: t.label)).toList(),
        ),
      ),
      body: widget.studentId != null
          ? _PostsList(schoolId: widget.schoolId, studentId: widget.studentId, emptyLabel: 'Δεν υπάρχουν ακόμα στιγμές για αυτό το παιδί.')
          : widget.noticeType != null
          ? _PostsList(
              schoolId: widget.schoolId,
              type: widget.noticeType,
              emptyLabel: 'Δεν υπάρχουν ακόμα ενημερώσεις για ξεχασμένα αντικείμενα.',
            )
          : TabBarView(
              controller: _tabCtrl,
              children: _tabs.map((t) => _PostsList(
                schoolId: widget.schoolId,
                type: t.type,
              )).toList(),
            ),
    );
  }
}

class _PostsList extends ConsumerWidget {
  final String schoolId;
  final String? type;
  final String? studentId;
  final String emptyLabel;
  const _PostsList({required this.schoolId, this.type, this.studentId, this.emptyLabel = 'Δεν υπάρχουν αναρτήσεις'});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = (schoolId: schoolId, type: type, studentId: studentId);
    final postsAsync = ref.watch(schoolPostsProvider(args));

    return postsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Σφάλμα φόρτωσης')),
      data: (posts) {
        final visible = type == null
            ? posts.where((row) => row is! Map || row['postType']?.toString() != 'found').toList()
            : posts;
        if (visible.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.photo_library_outlined, size: 64, color: Color(0xFFD1D5DB)),
                const SizedBox(height: 16),
                Text(emptyLabel, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF9CA3AF))),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(schoolPostsProvider(args).future),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: visible.length,
            itemBuilder: (_, i) => _PostCard(post: Map<String, dynamic>.from(visible[i] as Map)),
          ),
        );
      },
    );
  }
}

class _PostCard extends StatelessWidget {
  final Map<String, dynamic> post;
  const _PostCard({required this.post});

  static const _typeColors = {
    'excursion': (bg: Color(0xFFECFDF5), icon: Color(0xFF059669), label: 'Εκδρομή'),
    'theater': (bg: Color(0xFFFAF5FF), icon: Color(0xFF7C3AED), label: 'Θέατρο'),
    'event': (bg: Color(0xFFFFF7ED), icon: Color(0xFFEA580C), label: 'Εκδήλωση'),
    'general': (bg: Color(0xFFEFF6FF), icon: Color(0xFF2563EB), label: 'Γενικό'),
    'birthday': (bg: Color(0xFFFDF2F8), icon: Color(0xFFBE185D), label: 'Γενέθλια'),
    'nameday': (bg: Color(0xFFFFF7ED), icon: Color(0xFFE95926), label: 'Γιορτή'),
    'classroom': (bg: Color(0xFFF3E8F7), icon: Color(0xFF77328D), label: 'Τάξη'),
    'found': (bg: Color(0xFFFFF1EA), icon: Color(0xFFE95926), label: 'Εύρημα'),
  };

  @override
  Widget build(BuildContext context) {
    final title = post['title'] as String? ?? '';
    final content = post['content'] as String? ?? '';
    final postType = post['postType'] as String? ?? 'general';
    final rawUrls = post['mediaUrls'];
    final mediaUrls = rawUrls is List ? rawUrls.cast<String>() : <String>[];
    final publishedAt = post['publishedAt'] as String?;
    final author = post['author'] as Map<String, dynamic>?;
    final authorName = author?['fullName'] as String? ?? '';
    final authorPhoto = author?['avatarUrl'] as String?;

    final typeInfo = _typeColors[postType] ?? _typeColors['general']!;

    return GestureDetector(
      onTap: () => _openPost(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (mediaUrls.isNotEmpty)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                child: _MediaPreview(urls: mediaUrls),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: typeInfo.bg,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(typeInfo.label,
                            style: TextStyle(color: typeInfo.icon, fontSize: 11, fontWeight: FontWeight.w600)),
                      ),
                      const Spacer(),
                      if (publishedAt != null)
                        Text(_formatDate(publishedAt),
                            style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(title,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                  if (content.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      content,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280), height: 1.5),
                    ),
                  ],
                  if (authorName.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        PersonFace(name: authorName, photoUrl: authorPhoto, size: 20, radius: 10, fontSize: 9),
                        const SizedBox(width: 6),
                        Text(authorName,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openPost(BuildContext context) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => _PostDetailScreen(post: post)));
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      const months = ['', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      return '${dt.day} ${months[dt.month]} ${dt.year}';
    } catch (_) {
      return '';
    }
  }
}

class _MediaPreview extends StatelessWidget {
  final List<String> urls;
  const _MediaPreview({required this.urls});

  @override
  Widget build(BuildContext context) {
    if (urls.length == 1) {
      return SizedBox(height: 200, width: double.infinity, child: _PostThumb(url: urls[0]));
    }
    return SizedBox(
      height: 180,
      child: GridView.count(
        crossAxisCount: urls.length == 2 ? 2 : 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: urls.take(6).map((url) => _PostThumb(url: url)).toList(),
      ),
    );
  }
}

class _PostThumb extends StatelessWidget {
  final String url;
  const _PostThumb({required this.url});

  @override
  Widget build(BuildContext context) {
    if (postMediaIsVideo(url)) {
      return const ColoredBox(
        color: Color(0xFF3D1152),
        child: Center(child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 42)),
      );
    }
    return AppImage(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: const Color(0xFFF3F4F6)));
  }
}

class SchoolPostScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String postId;
  const SchoolPostScreen({super.key, required this.schoolId, required this.postId});

  @override
  ConsumerState<SchoolPostScreen> createState() => _SchoolPostScreenState();
}

class _SchoolPostScreenState extends ConsumerState<SchoolPostScreen> {
  Map<String, dynamic>? _post;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get('/schools/${widget.schoolId}/posts/${widget.postId}');
      final data = resp.data;
      if (!mounted) return;
      setState(() {
        _post = data is Map ? Map<String, dynamic>.from(data) : null;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFF77328D))));
    }
    final post = _post;
    if (post == null) return const Scaffold(body: Center(child: Text('Η ανάρτηση δεν βρέθηκε.')));
    return _PostDetailScreen(post: post);
  }
}

class _PostDetailScreen extends StatelessWidget {
  final Map<String, dynamic> post;
  const _PostDetailScreen({required this.post});

  @override
  Widget build(BuildContext context) {
    final title = post['title'] as String? ?? '';
    final content = post['content'] as String? ?? '';
    final rawUrls = post['mediaUrls'];
    final mediaUrls = rawUrls is List ? rawUrls.cast<String>() : <String>[];
    final publishedAt = post['publishedAt'] as String?;

    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: mediaUrls.isNotEmpty ? 260 : 0,
            pinned: true,
            backgroundColor: Colors.white,
            foregroundColor: Colors.black87,
            flexibleSpace: mediaUrls.isNotEmpty
                ? FlexibleSpaceBar(
                    background: PageView.builder(
                      itemCount: mediaUrls.length,
                      itemBuilder: (_, i) => GestureDetector(
                        onTap: () => _openMedia(context, mediaUrls[i]),
                        child: _PostThumb(url: mediaUrls[i]),
                      ),
                    ),
                  )
                : null,
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (publishedAt != null)
                    Text(_formatDate(publishedAt),
                        style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
                  const SizedBox(height: 8),
                  Text(title,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
                  if (content.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(content,
                        style: const TextStyle(fontSize: 15, color: Color(0xFF374151), height: 1.65)),
                  ],
                  if (mediaUrls.length > 1) ...[
                    const SizedBox(height: 24),
                    Text(mediaUrls.any(postMediaIsVideo) ? 'Φωτογραφίες και βίντεο' : 'Φωτογραφίες',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                    const SizedBox(height: 12),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 4,
                        mainAxisSpacing: 4,
                      ),
                      itemCount: mediaUrls.length,
                      itemBuilder: (_, i) => GestureDetector(
                        onTap: () => _openMedia(context, mediaUrls[i]),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: _PostThumb(url: mediaUrls[i]),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openMedia(BuildContext context, String url) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => EventMediaViewer(url: url, isVideo: postMediaIsVideo(url)),
    ));
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      const months = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου',
        'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
      return '${dt.day} ${months[dt.month]} ${dt.year}';
    } catch (_) {
      return '';
    }
  }
}
