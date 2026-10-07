import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/app_image.dart';

final schoolPostsProvider = FutureProvider.family<List<dynamic>, ({String schoolId, String? type})>(
  (ref, args) async {
    final dio = ref.read(dioProvider);
    final params = args.type != null ? {'type': args.type} : null;
    final resp = await dio.get('/schools/${args.schoolId}/posts', queryParameters: params);
    final data = resp.data;
    return data is List ? data : [];
  },
);

class SchoolPostsScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const SchoolPostsScreen({super.key, required this.schoolId});

  @override
  ConsumerState<SchoolPostsScreen> createState() => _SchoolPostsScreenState();
}

class _SchoolPostsScreenState extends ConsumerState<SchoolPostsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  final _tabs = const [
    (label: 'Όλα', type: null),
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
        title: const Text('Νέα & Εκδηλώσεις', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          labelColor: const Color(0xFF77328D),
          unselectedLabelColor: const Color(0xFF9CA3AF),
          indicatorColor: const Color(0xFF77328D),
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: _tabs.map((t) => Tab(text: t.label)).toList(),
        ),
      ),
      body: TabBarView(
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
  const _PostsList({required this.schoolId, this.type});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = (schoolId: schoolId, type: type);
    final postsAsync = ref.watch(schoolPostsProvider(args));

    return postsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Σφάλμα φόρτωσης')),
      data: (posts) {
        if (posts.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.photo_library_outlined, size: 64, color: Color(0xFFD1D5DB)),
                SizedBox(height: 16),
                Text('Δεν υπάρχουν αναρτήσεις', style: TextStyle(color: Color(0xFF9CA3AF))),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(schoolPostsProvider(args).future),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: posts.length,
            itemBuilder: (_, i) => _PostCard(post: posts[i] as Map<String, dynamic>),
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
                        CircleAvatar(
                          radius: 10,
                          backgroundColor: const Color(0xFFEEF2FF),
                          child: Text(
                            authorName[0].toUpperCase(),
                            style: const TextStyle(fontSize: 9, color: Color(0xFF77328D), fontWeight: FontWeight.bold),
                          ),
                        ),
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
      return AppImage(urls[0], height: 200, width: double.infinity, fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const SizedBox.shrink());
    }
    return SizedBox(
      height: 180,
      child: GridView.count(
        crossAxisCount: urls.length == 2 ? 2 : 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: urls.take(6).map((url) => AppImage(url, fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(color: const Color(0xFFF3F4F6)))).toList(),
      ),
    );
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
                      itemBuilder: (_, i) => AppImage(
                        mediaUrls[i],
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(color: const Color(0xFFF3F4F6)),
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
                    const Text('Φωτογραφίες',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
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
                        onTap: () => _openFullscreen(context, mediaUrls, i),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: AppImage(mediaUrls[i], fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(color: const Color(0xFFF3F4F6))),
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

  void _openFullscreen(BuildContext context, List<String> urls, int index) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => _FullscreenGallery(urls: urls, initialIndex: index),
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

class _FullscreenGallery extends StatefulWidget {
  final List<String> urls;
  final int initialIndex;
  const _FullscreenGallery({required this.urls, required this.initialIndex});

  @override
  State<_FullscreenGallery> createState() => _FullscreenGalleryState();
}

class _FullscreenGalleryState extends State<_FullscreenGallery> {
  late PageController _pageCtrl;
  late int _current;

  @override
  void initState() {
    super.initState();
    _current = widget.initialIndex;
    _pageCtrl = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${_current + 1} / ${widget.urls.length}',
            style: const TextStyle(color: Colors.white, fontSize: 14)),
      ),
      body: PageView.builder(
        controller: _pageCtrl,
        itemCount: widget.urls.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (_, i) => InteractiveViewer(
          child: Center(
            child: AppImage(widget.urls[i],
                errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white60, size: 64)),
          ),
        ),
      ),
    );
  }
}
