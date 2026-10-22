import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/person_face.dart';
import 'day_history.dart';
import 'party_invitation_screen.dart';

class ChildDetailScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> child;

  const ChildDetailScreen({super.key, required this.child});

  @override
  ConsumerState<ChildDetailScreen> createState() => _ChildDetailScreenState();
}

class _ChildDetailScreenState extends ConsumerState<ChildDetailScreen> {
  final _scrollController = ScrollController();
  bool _showTitle = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      final collapsed = _scrollController.offset > 130;
      if (collapsed != _showTitle) setState(() => _showTitle = collapsed);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final studentId = widget.child['id'] as String? ?? '';
      final schoolId = ref.read(authProvider).user?.schoolId ?? '';
      if (studentId.isNotEmpty && schoolId.isNotEmpty) {
        ref.invalidate(childDayReportsProvider((schoolId: schoolId, studentId: studentId)));
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user!;
    final schoolId = user.schoolId ?? '';
    final name = widget.child['fullName'] as String? ?? '';
    final photo = widget.child['avatarUrl'] as String?;
    final firstName = name.split(' ').first;
    final enrollments = widget.child['enrollments'] as List<dynamic>? ?? [];
    final className = enrollments.isNotEmpty
        ? (enrollments.first['class']?['name'] as String? ?? '')
        : '';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F3FA),
        body: CustomScrollView(
          controller: _scrollController,
          slivers: [
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              backgroundColor: dayHistoryColors[0],
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
              title: AnimatedOpacity(
                opacity: _showTitle ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 200),
                child: Text(firstName,
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: dayHistoryColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: SafeArea(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 40),
                        PersonFace(
                          name: name,
                          photoUrl: photo,
                          size: 80,
                          radius: 26,
                          fontSize: 36,
                          background: Colors.white.withValues(alpha: 0.25),
                          foreground: Colors.white,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          firstName,
                          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                        ),
                        if (className.isNotEmpty)
                          Text(className, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: DayHistoryPanel(schoolId: schoolId, child: widget.child),
            ),
            SliverToBoxAdapter(
              child: _PartySection(
                schoolId: schoolId,
                childId: widget.child['id'] as String? ?? '',
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }
}

class _PartySection extends ConsumerStatefulWidget {
  final String schoolId;
  final String childId;
  const _PartySection({required this.schoolId, required this.childId});

  @override
  ConsumerState<_PartySection> createState() => _PartySectionState();
}

class _PartySectionState extends ConsumerState<_PartySection> {
  List<Map<String, dynamic>> _sent = [];
  List<Map<String, dynamic>> _received = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final dio = ref.read(dioProvider);
      final base = '/schools/${widget.schoolId}/party-invitations';
      final results = await Future.wait([
        dio.get('$base/sent-by-my-child'),
        dio.get('$base/received'),
      ]);
      if (!mounted) return;
      final sent = (results[0].data as List? ?? [])
          .cast<Map>()
          .where((r) => r['birthdayStudentId'] == widget.childId)
          .map((r) => Map<String, dynamic>.from(r))
          .toList();
      final received = (results[1].data as List? ?? [])
          .cast<Map>()
          .where((r) {
            final ids = r['recipientStudentIds'];
            return ids is List && ids.contains(widget.childId);
          })
          .map((r) => Map<String, dynamic>.from(r))
          .toList();
      setState(() {
        _sent = sent;
        _received = received;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || (_sent.isEmpty && _received.isEmpty)) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Πάρτυ 🎂',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          const SizedBox(height: 8),
          ..._sent.map((inv) => _PartyCard(
                schoolId: widget.schoolId,
                inv: inv,
                isOrganizer: true,
              )),
          ..._received.map((inv) => _PartyCard(
                schoolId: widget.schoolId,
                inv: inv,
                isOrganizer: false,
              )),
        ],
      ),
    );
  }
}

class _PartyCard extends StatelessWidget {
  final String schoolId;
  final Map<String, dynamic> inv;
  final bool isOrganizer;
  const _PartyCard({required this.schoolId, required this.inv, required this.isOrganizer});

  @override
  Widget build(BuildContext context) {
    final title = inv['title']?.toString() ?? '';
    final eventDate = inv['eventDate']?.toString() ?? '';
    final sentAt = inv['sentAt'];
    final recipientCount = (inv['recipientStudentIds'] as List?)?.length ?? 0;
    final birthdayName = (inv['birthdayStudent'] as Map?)?['fullName']?.toString() ?? '';

    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
        builder: (_) => PartyInvitationScreen(
          schoolId: schoolId,
          invitationId: inv['id']?.toString() ?? '',
        ),
      )),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFCE7F3)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFFDF2F8),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(child: Text('🎂', style: TextStyle(fontSize: 22))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  if (!isOrganizer && birthdayName.isNotEmpty)
                    Text('από: $birthdayName',
                        style: const TextStyle(fontSize: 12, color: Color(0xFFDB2777))),
                  if (eventDate.isNotEmpty)
                    Text('📅 $eventDate', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                  if (isOrganizer) ...[
                    const SizedBox(height: 3),
                    Row(children: [
                      Icon(
                        sentAt != null ? Icons.check_circle_rounded : Icons.schedule_rounded,
                        size: 13,
                        color: sentAt != null ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        sentAt != null ? 'Εστάλη · $recipientCount παιδιά' : 'Δεν έχει σταλεί ακόμα',
                        style: TextStyle(
                          fontSize: 12,
                          color: sentAt != null ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ]),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFDB2777), size: 18),
          ],
        ),
      ),
    );
  }
}
