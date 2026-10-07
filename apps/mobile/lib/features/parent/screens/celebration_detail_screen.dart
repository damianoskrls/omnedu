import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/utils/system_insets.dart';
import '../../../core/widgets/app_image.dart';

class CelebrationDetailScreen extends ConsumerStatefulWidget {
  final String schoolId;
  final String celebrationId;
  final Map<String, dynamic>? initial;

  const CelebrationDetailScreen({
    super.key,
    required this.schoolId,
    required this.celebrationId,
    this.initial,
  });

  @override
  ConsumerState<CelebrationDetailScreen> createState() => _CelebrationDetailScreenState();
}

class _CelebrationDetailScreenState extends ConsumerState<CelebrationDetailScreen> {
  Map<String, dynamic>? _row;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _row = widget.initial;
    _load();
  }

  Future<void> _load() async {
    try {
      final resp = await ref.read(dioProvider).get('/schools/${widget.schoolId}/celebrations/${widget.celebrationId}');
      final data = resp.data;
      if (!mounted) return;
      setState(() {
        _row = data is Map ? Map<String, dynamic>.from(data) : _row;
        _loading = false;
        _error = _row == null ? 'Η γιορτή δεν βρέθηκε.' : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _row == null ? 'Η γιορτή δεν φορτώθηκε.' : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final row = _row;
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(title: Text(row?['title']?.toString() ?? 'Γιορτή')),
      body: _loading && row == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF77328D)))
          : row == null
              ? Center(child: Text(_error ?? 'Η γιορτή δεν βρέθηκε.'))
              : ListView(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + systemBottomInset(context)),
                  children: [
                    _CelebrationBody(celebration: row),
                  ],
                ),
    );
  }
}

class _CelebrationBody extends StatelessWidget {
  final Map<String, dynamic> celebration;
  const _CelebrationBody({required this.celebration});

  @override
  Widget build(BuildContext context) {
    final title = celebration['title']?.toString() ?? '';
    final place = celebration['place']?.toString() ?? '';
    final details = celebration['details']?.toString() ?? '';
    final arrival = celebration['arrivalTime']?.toString() ?? '';
    final date = formatCelebrationDate(celebration['eventDate']?.toString());
    final items = celebrationItems(celebration['items']);
    final before = items.where((item) => item['phase'] != 'after').toList();
    final after = items.where((item) => item['phase'] == 'after').toList();
    final image = celebration['imageUrl']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE9D5FF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (image.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: AppImage(image, height: 220, width: double.infinity, fit: BoxFit.cover),
              ),
            ),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF111827))),
          const SizedBox(height: 4),
          Text(celebrationAudienceLabel(celebration['audienceType']?.toString()), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF77328D))),
          if (date.isNotEmpty || arrival.isNotEmpty || place.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              [date, if (arrival.isNotEmpty) 'Προσέλευση $arrival', place].where((part) => part.isNotEmpty).join('\n'),
              style: const TextStyle(fontSize: 15, height: 1.45, color: Color(0xFF374151)),
            ),
          ],
          if (details.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(details, style: const TextStyle(fontSize: 15, height: 1.5, color: Color(0xFF2C2422))),
          ],
          CelebrationItemBlock(title: 'Πριν τη γιορτή', items: before),
          CelebrationItemBlock(title: 'Μετά τη γιορτή', items: after),
        ],
      ),
    );
  }
}

class CelebrationItemBlock extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  const CelebrationItemBlock({super.key, required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF77328D))),
          const SizedBox(height: 6),
          ...items.map((item) {
            final name = item['name']?.toString() ?? '';
            final cost = item['cost'];
            final price = cost == null || cost.toString().isEmpty ? '' : ' · $cost €';
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('$name$price', style: const TextStyle(fontSize: 15, height: 1.35, color: Color(0xFF374151))),
            );
          }),
        ],
      ),
    );
  }
}

String celebrationAudienceLabel(String? type) {
  if (type == 'class') return 'Για την τάξη';
  if (type == 'level') return 'Για τη βαθμίδα';
  if (type == 'teachers') return 'Για τους εκπαιδευτικούς';
  return 'Όλο το σχολείο';
}

String formatCelebrationDate(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final date = DateTime.tryParse(iso);
  if (date == null) return '';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}

List<Map<String, dynamic>> celebrationItems(dynamic raw) {
  dynamic parsed = raw;
  if (raw is String && raw.isNotEmpty) {
    try {
      parsed = jsonDecode(raw);
    } catch (_) {
      return [];
    }
  }
  if (parsed is! List) return [];
  return parsed.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
}
