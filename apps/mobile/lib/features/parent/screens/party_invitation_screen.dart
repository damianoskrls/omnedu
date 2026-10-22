import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/app_image.dart';

class PartyInvitationScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String invitationId;

  const PartyInvitationScreen({
    super.key,
    required this.schoolId,
    required this.invitationId,
  });

  @override
  ConsumerState<PartyInvitationScreen> createState() => _PartyInvitationScreenState();
}

class _PartyInvitationScreenState extends ConsumerState<PartyInvitationScreen> {
  Map<String, dynamic>? _row;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/party-invitations/${widget.invitationId}',
      );
      if (!mounted) return;
      final data = resp.data;
      setState(() {
        _row = data is Map ? Map<String, dynamic>.from(data) : null;
        _loading = false;
        _error = _row == null ? 'Η πρόσκληση δεν βρέθηκε.' : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Η πρόσκληση δεν φορτώθηκε.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF0F6),
      appBar: AppBar(
        title: Text(_row?['title']?.toString() ?? 'Πρόσκληση Πάρτυ'),
        backgroundColor: const Color(0xFFDB2777),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFDB2777)))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.grey)))
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final row = _row!;
    final title = row['title']?.toString() ?? '';
    final body = row['body']?.toString() ?? '';
    final imageUrl = row['imageUrl']?.toString() ?? '';
    final eventDate = row['eventDate']?.toString() ?? '';
    final sentAt = row['sentAt'];
    final birthdayChild = row['birthdayStudent'] is Map
        ? Map<String, dynamic>.from(row['birthdayStudent'] as Map)
        : <String, dynamic>{};
    final birthdayName = birthdayChild['fullName']?.toString() ?? '';
    final recipients = row['recipientStudents'] is List
        ? (row['recipientStudents'] as List).cast<Map>()
        : <Map>[];

    return ListView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFFDB2777), Color(0xFFEC4899)]),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            children: [
              const Text('🎂', style: TextStyle(fontSize: 44)),
              const SizedBox(height: 10),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
              ),
              if (birthdayName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('από: $birthdayName', style: const TextStyle(fontSize: 14, color: Colors.white70)),
              ],
              if (eventDate.isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text('📅 $eventDate',
                      style: const TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ],
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      sentAt != null ? Icons.check_circle_rounded : Icons.schedule_rounded,
                      size: 14, color: Colors.white,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      sentAt != null ? 'Η πρόσκληση στάλθηκε' : 'Δεν έχει σταλεί ακόμα',
                      style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (imageUrl.isNotEmpty) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AppImage(imageUrl, height: 260, width: double.infinity, fit: BoxFit.cover),
          ),
          const SizedBox(height: 16),
        ],
        if (body.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFCE7F3)),
            ),
            child: Text(body, style: const TextStyle(fontSize: 15, height: 1.55, color: Color(0xFF374151))),
          ),
          const SizedBox(height: 16),
        ],
        if (recipients.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFCE7F3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Προσκεκλημένοι (${recipients.length})',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                const SizedBox(height: 10),
                ...recipients.map((r) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        const Icon(Icons.person_rounded, size: 16, color: Color(0xFFDB2777)),
                        const SizedBox(width: 8),
                        Text(r['fullName']?.toString() ?? '',
                            style: const TextStyle(fontSize: 14, color: Color(0xFF374151))),
                      ]),
                    )),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class PartyInvitationsListScreen extends ConsumerStatefulWidget {
  final String schoolId;
  const PartyInvitationsListScreen({super.key, required this.schoolId});

  @override
  ConsumerState<PartyInvitationsListScreen> createState() => _PartyInvitationsListScreenState();
}

class _PartyInvitationsListScreenState extends ConsumerState<PartyInvitationsListScreen> {
  List<dynamic> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get(
        '/schools/${widget.schoolId}/party-invitations/received',
      );
      if (!mounted) return;
      final data = resp.data;
      setState(() {
        _rows = data is List ? data : [];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF0F6),
      appBar: AppBar(
        title: const Text('Προσκλήσεις Πάρτυ'),
        backgroundColor: const Color(0xFFDB2777),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFDB2777)))
          : _rows.isEmpty
              ? const Center(child: Text('Δεν υπάρχουν προσκλήσεις.', style: TextStyle(color: Colors.grey)))
              : ListView.separated(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final inv = _rows[index] as Map;
                    final imageUrl = inv['imageUrl']?.toString() ?? '';
                    final birthdayChild = inv['birthdayStudent'] is Map
                        ? Map<String, dynamic>.from(inv['birthdayStudent'] as Map)
                        : <String, dynamic>{};
                    return GestureDetector(
                      onTap: () => Navigator.push(context, MaterialPageRoute(
                        builder: (_) => PartyInvitationScreen(
                          schoolId: widget.schoolId,
                          invitationId: inv['id']?.toString() ?? '',
                        ),
                      )),
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFFCE7F3)),
                        ),
                        child: Row(
                          children: [
                            if (imageUrl.isNotEmpty)
                              ClipRRect(
                                borderRadius: const BorderRadius.only(
                                  topLeft: Radius.circular(16), bottomLeft: Radius.circular(16),
                                ),
                                child: AppImage(imageUrl, height: 80, width: 80, fit: BoxFit.cover),
                              ),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(children: [
                                      const Text('🎂', style: TextStyle(fontSize: 16)),
                                      const SizedBox(width: 6),
                                      Expanded(child: Text(
                                        inv['title']?.toString() ?? '',
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF111827)),
                                        maxLines: 1, overflow: TextOverflow.ellipsis,
                                      )),
                                    ]),
                                    const SizedBox(height: 3),
                                    Text(birthdayChild['fullName']?.toString() ?? '',
                                        style: const TextStyle(fontSize: 12, color: Color(0xFFDB2777))),
                                    if ((inv['eventDate']?.toString() ?? '').isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text('📅 ${inv['eventDate']}',
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.only(right: 12),
                              child: Icon(Icons.chevron_right, color: Color(0xFFDB2777), size: 20),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
