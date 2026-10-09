import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

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
              ...mine.map((receipt) => _ReceiptCard(receipt: receipt)),
          ],
        );
      },
    );
  }
}

class ReceiptList extends StatelessWidget {
  final List<Map<String, dynamic>> receipts;
  final void Function(Map<String, dynamic> receipt)? onDownload;
  const ReceiptList({super.key, required this.receipts, this.onDownload});

  @override
  Widget build(BuildContext context) {
    if (receipts.isEmpty) {
      return const Text('Δεν έχουν εκδοθεί αποδείξεις ακόμα.', style: TextStyle(color: Color(0xFF9CA3AF)));
    }
    return Column(
      children: [
        for (final receipt in receipts) _ReceiptCard(receipt: receipt, onDownload: onDownload),
      ],
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  final Map<String, dynamic> receipt;
  final void Function(Map<String, dynamic> receipt)? onDownload;
  const _ReceiptCard({required this.receipt, this.onDownload});

  @override
  Widget build(BuildContext context) {
    final title = receipt['title']?.toString().trim().isNotEmpty == true ? receipt['title'].toString() : 'Απόδειξη';
    final child = receipt['studentName']?.toString() ?? '';
    final when = _receiptDate(receipt['uploadedAt']?.toString());
    final notes = receipt['notes']?.toString() ?? '';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9D5FF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827))),
          if (child.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(child, style: const TextStyle(color: Color(0xFF77328D), fontWeight: FontWeight.w700)),
          ],
          if (when.isNotEmpty || notes.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text([when, notes].where((part) => part.isNotEmpty).join(' · '), style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () {
                if (onDownload != null) {
                  onDownload!(receipt);
                  return;
                }
                downloadReceipt(context, receipt['fileUrl']?.toString() ?? '', title);
              },
              icon: const Icon(Icons.download_rounded),
              label: const Text('Κατέβασμα'),
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

String _receiptDate(String? iso) {
  final date = DateTime.tryParse(iso ?? '');
  if (date == null) return '';
  final local = date.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month/${local.year}';
}

Future<void> downloadReceipt(BuildContext context, String url, String title) async {
  final resolved = fixMediaUrl(url);
  if (resolved.isEmpty) {
    _say(context, 'Η απόδειξη δεν έχει αρχείο.');
    return;
  }
  try {
    final downloads = await getDownloadsDirectory();
    final dir = downloads ?? await getApplicationDocumentsDirectory();
    final safe = title.replaceAll(RegExp(r'[\\/:*?"<>|]'), ' ').trim();
    final stamp = DateTime.now().millisecondsSinceEpoch;
    final segments = Uri.tryParse(resolved)?.pathSegments ?? const <String>[];
    final last = segments.isEmpty ? '' : segments.last;
    final ext = last.contains('.') ? last.split('.').last : 'pdf';
    final path = '${dir.path}/${safe.isEmpty ? 'apodeixi' : safe}-$stamp.$ext';
    await Dio().download(resolved, path);
    if (context.mounted) _say(context, 'Η απόδειξη αποθηκεύτηκε στο κινητό.');
  } catch (_) {
    if (context.mounted) _say(context, 'Το αρχείο δεν αποθηκεύτηκε. Ανοίγει για κατέβασμα.');
  }
  final uri = Uri.tryParse(resolved);
  if (uri != null) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

void _say(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
