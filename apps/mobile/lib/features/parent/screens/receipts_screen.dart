import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/api/api_client.dart';

final myReceiptsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/schools/$schoolId/billing/receipts/mine');
  return resp.data is List ? resp.data as List<dynamic> : [];
});

class ReceiptsScreen extends ConsumerWidget {
  final String schoolId;
  const ReceiptsScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Οι αποδείξεις μου'),
        actions: [
          IconButton(onPressed: () => ref.invalidate(myReceiptsProvider(schoolId)), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ParentReceipts(schoolId: schoolId, showHeading: false),
        ],
      ),
    );
  }
}

class ParentReceipts extends ConsumerWidget {
  final String schoolId;
  final String? studentId;
  final bool showHeading;
  const ParentReceipts({super.key, required this.schoolId, this.studentId, this.showHeading = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receipts = ref.watch(myReceiptsProvider(schoolId));
    return receipts.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(child: CircularProgressIndicator(color: Color(0xFF77328D))),
      ),
      error: (_, __) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Text('Οι αποδείξεις δεν φορτώθηκαν.', style: TextStyle(color: Color(0xFF9CA3AF))),
      ),
      data: (rows) {
        final mine = rows.where((row) {
          if (row is! Map) return false;
          final fileUrl = row['fileUrl']?.toString().trim() ?? '';
          if (fileUrl.isEmpty) return false;
          if (studentId == null || studentId!.isEmpty) return true;
          return row['studentId']?.toString() == studentId;
        }).map((row) => Map<String, dynamic>.from(row as Map)).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (showHeading) ...[
              const Text('Οι αποδείξεις μου', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
              const SizedBox(height: 8),
            ],
            if (mine.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text('Δεν έχουν εκδοθεί αποδείξεις ακόμα.', style: TextStyle(color: Color(0xFF9CA3AF))),
              )
            else
              _ReceiptsByYear(receipts: mine, schoolId: schoolId),
          ],
        );
      },
    );
  }
}

/// Groups receipts into year accordion panels (newest year first).
class _ReceiptsByYear extends StatelessWidget {
  final List<Map<String, dynamic>> receipts;
  final String schoolId;
  final void Function(Map<String, dynamic> receipt)? onDownload;
  const _ReceiptsByYear({required this.receipts, required this.schoolId, this.onDownload});

  @override
  Widget build(BuildContext context) {
    final byYear = <int, List<Map<String, dynamic>>>{};
    for (final receipt in receipts) {
      final year = _receiptYear(receipt);
      byYear.putIfAbsent(year, () => []).add(receipt);
    }
    final years = byYear.keys.toList()..sort((a, b) => b.compareTo(a));
    final newest = years.isEmpty ? DateTime.now().year : years.first;

    return Column(
      children: [
        for (final year in years)
          _YearAccordion(
            key: ValueKey(year),
            year: year,
            count: byYear[year]!.length,
            initiallyExpanded: year == newest,
            child: Column(
              children: [
                for (final receipt in byYear[year]!)
                  _ReceiptCard(
                    receipt: receipt,
                    schoolId: schoolId,
                    onDownload: onDownload,
                    nested: true,
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _YearAccordion extends StatelessWidget {
  final int year;
  final int count;
  final bool initiallyExpanded;
  final Widget child;
  const _YearAccordion({
    super.key,
    required this.year,
    required this.count,
    required this.initiallyExpanded,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final label = year <= 0 ? 'Χωρίς έτος' : '$year';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9D5FF)),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
          collapsedShape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
          iconColor: const Color(0xFF77328D),
          collapsedIconColor: const Color(0xFF77328D),
          title: Row(
            children: [
              const Icon(Icons.folder_outlined, size: 20, color: Color(0xFF77328D)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF111827)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3E8F7),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF642678)),
                ),
              ),
            ],
          ),
          children: [child],
        ),
      ),
    );
  }
}

class ReceiptList extends StatelessWidget {
  final List<Map<String, dynamic>> receipts;
  final String schoolId;
  final bool groupByYear;
  final void Function(Map<String, dynamic> receipt)? onDownload;
  const ReceiptList({
    super.key,
    required this.receipts,
    this.schoolId = '',
    this.groupByYear = false,
    this.onDownload,
  });

  @override
  Widget build(BuildContext context) {
    if (receipts.isEmpty) {
      return const Text('Δεν έχουν εκδοθεί αποδείξεις ακόμα.', style: TextStyle(color: Color(0xFF9CA3AF)));
    }
    if (groupByYear) {
      return _ReceiptsByYear(receipts: receipts, schoolId: schoolId, onDownload: onDownload);
    }
    return Column(
      children: [
        for (final receipt in receipts) _ReceiptCard(receipt: receipt, schoolId: schoolId, onDownload: onDownload),
      ],
    );
  }
}

class _ReceiptCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> receipt;
  final String schoolId;
  final bool nested;
  final void Function(Map<String, dynamic> receipt)? onDownload;
  const _ReceiptCard({
    required this.receipt,
    required this.schoolId,
    this.onDownload,
    this.nested = false,
  });

  @override
  ConsumerState<_ReceiptCard> createState() => _ReceiptCardState();
}

class _ReceiptCardState extends ConsumerState<_ReceiptCard> {
  bool _downloading = false;

  Future<void> _download() async {
    if (widget.onDownload != null) { widget.onDownload!(widget.receipt); return; }
    final docId = widget.receipt['id']?.toString() ?? '';
    final fileUrl = widget.receipt['fileUrl']?.toString().trim() ?? '';
    if (docId.isEmpty || fileUrl.isEmpty) { _say(context, 'Η απόδειξη δεν έχει αρχείο.'); return; }
    setState(() => _downloading = true);
    try {
      final dioClient = ref.read(dioProvider);
      final dir = await getTemporaryDirectory();
      final fileType = widget.receipt['fileType']?.toString() ?? '';
      final ext = _receiptExt(fileType);
      final filePath = '${dir.path}/receipt_${docId.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_')}.$ext';
      // API streams the file bytes (fetches Cloudinary server-side) so the phone
      // never hits a private/restricted Cloudinary URL directly.
      await dioClient.download(
        '/schools/${widget.schoolId}/billing/receipts/$docId/download',
        filePath,
        options: Options(responseType: ResponseType.bytes),
      );
      if (!mounted) return;
      final file = File(filePath);
      if (!await file.exists() || await file.length() == 0) {
        if (!mounted) return;
        _say(context, 'Η απόδειξη δεν έχει αρχείο.');
        return;
      }
      if (!mounted) return;
      final result = await OpenFilex.open(filePath);
      if (result.type != ResultType.done && mounted) {
        _say(context, 'Το αρχείο αποθηκεύτηκε, αλλά δεν άνοιξε.');
      }
    } catch (_) {
      if (mounted) _say(context, 'Σφάλμα κατά το κατέβασμα.');
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = widget.receipt;
    final title = receipt['title']?.toString().trim().isNotEmpty == true ? receipt['title'].toString() : 'Απόδειξη';
    final child = receipt['studentName']?.toString() ?? '';
    final when = _receiptDate(receipt['uploadedAt']?.toString());
    final notes = receipt['notes']?.toString() ?? '';
    final monthLabel = _monthLabel(receipt['academicYear']?.toString());
    return Container(
      margin: EdgeInsets.only(bottom: widget.nested ? 8 : 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: widget.nested ? const Color(0xFFFaf5fc) : Colors.white,
        borderRadius: BorderRadius.circular(widget.nested ? 12 : 16),
        border: Border.all(color: widget.nested ? const Color(0xFFF3E8F7) : const Color(0xFFE9D5FF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827))),
          if (monthLabel.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(monthLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF77328D))),
          ],
          if (child.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(child, style: const TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w600)),
          ],
          if (when.isNotEmpty || notes.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text([when, notes].where((part) => part.isNotEmpty).join(' · '), style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _downloading ? null : _download,
              icon: _downloading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.download_rounded),
              label: Text(_downloading ? 'Φόρτωση...' : 'Κατέβασμα'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF77328D),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(46),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

int _receiptYear(Map<String, dynamic> receipt) {
  final academicYear = receipt['academicYear']?.toString() ?? '';
  if (academicYear.contains('-')) {
    final year = int.tryParse(academicYear.split('-').first);
    if (year != null && year > 1990) return year;
  }
  final uploaded = DateTime.tryParse(receipt['uploadedAt']?.toString() ?? '');
  if (uploaded != null) return uploaded.toLocal().year;
  return 0;
}

String _receiptExt(String fileType) {
  if (!fileType.startsWith('image/')) return 'pdf';
  final parts = fileType.split('/');
  final raw = parts.length > 1 ? parts[1].split(';').first.split('+').first : '';
  switch (raw) {
    case 'jpeg':
    case 'jpg':
      return 'jpg';
    case 'png':
    case 'webp':
    case 'gif':
      return raw;
    default:
      return 'jpg';
  }
}

const _monthNames = ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

String _monthLabel(String? academicYear) {
  if (academicYear == null || academicYear.isEmpty) return '';
  final parts = academicYear.split('-');
  if (parts.length != 2) return '';
  final year = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  if (year == null || month == null || month < 1 || month > 12) return '';
  return '${_monthNames[month]} $year';
}

String _receiptDate(String? iso) {
  final date = DateTime.tryParse(iso ?? '');
  if (date == null) return '';
  final local = date.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month/${local.year}';
}

void _say(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
