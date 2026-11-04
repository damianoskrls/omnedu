import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_client.dart';

List<dynamic> _asList(dynamic raw) {
  if (raw is List) return List<dynamic>.from(raw);
  if (raw is Map && raw['data'] is List) return List<dynamic>.from(raw['data'] as List);
  if (raw is Map && raw['items'] is List) return List<dynamic>.from(raw['items'] as List);
  return const [];
}

final myReceiptsProvider = FutureProvider.family<List<dynamic>, String>((ref, schoolId) async {
  final dio = ref.read(dioProvider);
  final receiptsResp = await dio.get('/schools/$schoolId/billing/receipts/mine');
  final receipts = _asList(receiptsResp.data);
  List<dynamic> fiscal = const [];
  Object? fiscalError;
  try {
    final fiscalResp = await dio.get('/schools/$schoolId/fiscal-documents/mine');
    fiscal = _asList(fiscalResp.data);
  } on DioException catch (err) {
    // 404 = older API without fiscal routes. Anything else: keep a marker row so the UI is not blank.
    final code = err.response?.statusCode;
    if (code != 404) fiscalError = err;
  } catch (err) {
    fiscalError = err;
  }
  final merged = <Map<String, dynamic>>[];
  for (final row in receipts) {
    if (row is! Map) continue;
    final map = Map<String, dynamic>.from(row);
    map['kind'] = map['kind'] ?? 'receipt';
    final studentName = (map['studentName'] ?? '').toString().trim();
    final uploaded = DateTime.tryParse(map['uploadedAt']?.toString() ?? '');
    if (uploaded != null) {
      final local = uploaded.toLocal();
      map['academicYear'] ??= '${local.year}-${local.month.toString().padLeft(2, '0')}';
      final monthName = _monthNames[local.month];
      map['dashboardTitle'] = studentName.isNotEmpty
          ? 'Παραστατικό μαθητή $studentName για μήνα $monthName'
          : 'Παραστατικό για μήνα $monthName';
    } else {
      map['dashboardTitle'] = studentName.isNotEmpty
          ? 'Παραστατικό μαθητή $studentName'
          : (map['title']?.toString() ?? 'Απόδειξη');
    }
    merged.add(map);
  }
  for (final row in fiscal) {
    if (row is! Map) continue;
    final map = Map<String, dynamic>.from(row);
    map['kind'] = 'fiscal';
    // Reuse receipt card fields. Empty fileUrl = pending verification link.
    final openUrl = (map['verificationUrl'] ?? map['qrUrl'] ?? map['fileUrl'] ?? '').toString().trim();
    map['fileUrl'] = openUrl;
    map['verificationUrl'] = map['verificationUrl'] ?? openUrl;
    map['uploadedAt'] = map['uploadedAt'] ?? map['issueDate'] ?? map['createdAt'];
    final gross = _formatEuro(map['grossValue']);
    map['amountLabel'] = gross;
    if ((map['title'] ?? '').toString().trim().isEmpty) {
      final series = map['series']?.toString() ?? '';
      final number = map['number']?.toString() ?? '';
      final kindLabel = map['documentKind']?.toString() == 'service_invoice' ? 'Τιμολόγιο' : 'Απόδειξη';
      map['title'] = '$kindLabel $series-$number'.trim();
    }
    map['notes'] = [
      if ((map['description'] ?? '').toString().trim().isNotEmpty) map['description'].toString().trim(),
      if ((map['mark'] ?? '').toString().isNotEmpty) 'MARK ${map['mark']}',
    ].where((part) => part.toString().trim().isNotEmpty).join(' · ');
    final issue = (map['issueDate'] ?? map['uploadedAt'] ?? '').toString();
    final issueDate = DateTime.tryParse(issue);
    if (issueDate != null) {
      final local = issueDate.toLocal();
      map['academicYear'] = '${local.year}-${local.month.toString().padLeft(2, '0')}';
      final studentName = (map['studentName'] ?? '').toString().trim();
      final monthName = _monthNames[local.month];
      map['dashboardTitle'] = studentName.isNotEmpty
          ? 'Παραστατικό μαθητή $studentName για μήνα $monthName'
          : 'Παραστατικό για μήνα $monthName';
    } else {
      map['academicYear'] = issue.length >= 4 ? issue.substring(0, 4) : null;
      final studentName = (map['studentName'] ?? '').toString().trim();
      map['dashboardTitle'] = studentName.isNotEmpty
          ? 'Παραστατικό μαθητή $studentName'
          : (map['title']?.toString() ?? 'Παραστατικό');
    }
    merged.add(map);
  }
  if (fiscalError != null && fiscal.isEmpty) {
    merged.add({
      'kind': 'fiscal_error',
      'title': 'Τα φορολογικά παραστατικά δεν φορτώθηκαν',
      'notes': 'Τράβηξε για ανανέωση ή δοκίμασε αργότερα.',
      'fileUrl': 'error',
      'uploadedAt': DateTime.now().toIso8601String(),
      'studentId': null,
    });
  }
  merged.sort((a, b) {
    final aDate = DateTime.tryParse(a['uploadedAt']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
    final bDate = DateTime.tryParse(b['uploadedAt']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
    return bDate.compareTo(aDate);
  });
  return merged;
});

class ReceiptsScreen extends ConsumerWidget {
  final String schoolId;
  const ReceiptsScreen({super.key, required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F3FA),
      appBar: AppBar(
        title: const Text('Αποδείξεις & παραστατικά'),
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
  /// Dashboard mode: human titles, no amounts, group by year.
  final bool dashboardMode;
  const ParentReceipts({
    super.key,
    required this.schoolId,
    this.studentId,
    this.showHeading = true,
    this.dashboardMode = false,
  });

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
          final kind = row['kind']?.toString() ?? 'receipt';
          final fileUrl = row['fileUrl']?.toString().trim() ?? '';
          // Classic receipts need a file; fiscal may be pending without URL yet.
          if (kind == 'fiscal' || kind == 'fiscal_error') {
            if (studentId == null || studentId!.isEmpty) return true;
            if (kind == 'fiscal_error') return true;
            return row['studentId']?.toString() == studentId;
          }
          if (fileUrl.isEmpty) return false;
          if (studentId == null || studentId!.isEmpty) return true;
          return row['studentId']?.toString() == studentId;
        }).map((row) => Map<String, dynamic>.from(row as Map)).toList();
        final fiscal = mine.where((r) => r['kind']?.toString() == 'fiscal' || r['kind']?.toString() == 'fiscal_error').toList();
        final classic = mine.where((r) => r['kind']?.toString() != 'fiscal' && r['kind']?.toString() != 'fiscal_error').toList();
        if (dashboardMode) {
          final docs = [...fiscal, ...classic];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showHeading) ...[
                const Text('Παραστατικά', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
                const SizedBox(height: 4),
                const Text(
                  'Κατέβασε τα παραστατικά της τρέχουσας χρονιάς.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 12),
              ],
              if (docs.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('Δεν υπάρχουν παραστατικά ακόμα.', style: TextStyle(color: Color(0xFF9CA3AF)))),
                )
              else
                _ReceiptsByYear(
                  receipts: docs,
                  schoolId: schoolId,
                  hideAmount: true,
                  useDashboardTitle: true,
                ),
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (showHeading) ...[
              const Text('Παραστατικά & αποδείξεις', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
              const SizedBox(height: 8),
            ],
            // Dedicated Elorus block — always first and expanded so parents can download.
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Φορολογικά παραστατικά (Elorus)',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Απόδειξη / τιμολόγιο myDATA. Πάτα «Άνοιγμα / λήψη» για να το κατεβάσεις.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF047857), height: 1.35),
                  ),
                  const SizedBox(height: 10),
                  if (fiscal.isEmpty)
                    const Text(
                      'Δεν υπάρχει ακόμα φορολογικό παραστατικό.',
                      style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                    )
                  else
                    ...fiscal.map((doc) => _ReceiptCard(receipt: doc, schoolId: schoolId)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Αποδείξεις είσπραξης',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF111827)),
            ),
            const SizedBox(height: 4),
            const Text(
              'Εσωτερικές αποδείξεις πληρωμής (όχι Elorus).',
              style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 8),
            if (classic.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text('Δεν υπάρχουν αποδείξεις είσπραξης ακόμα.', style: TextStyle(color: Color(0xFF9CA3AF))),
              )
            else
              _ReceiptsByYear(receipts: classic, schoolId: schoolId),
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
  final bool hideAmount;
  final bool useDashboardTitle;
  const _ReceiptsByYear({
    required this.receipts,
    required this.schoolId,
    this.onDownload,
    this.hideAmount = false,
    this.useDashboardTitle = false,
  });

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
                    hideAmount: hideAmount,
                    useDashboardTitle: useDashboardTitle,
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
  final bool hideAmount;
  final bool useDashboardTitle;
  final void Function(Map<String, dynamic> receipt)? onDownload;
  const _ReceiptCard({
    required this.receipt,
    required this.schoolId,
    this.onDownload,
    this.nested = false,
    this.hideAmount = false,
    this.useDashboardTitle = false,
  });

  @override
  ConsumerState<_ReceiptCard> createState() => _ReceiptCardState();
}

class _ReceiptCardState extends ConsumerState<_ReceiptCard> {
  bool _downloading = false;
  bool _refreshing = false;

  bool get _isFiscal => (widget.receipt['kind']?.toString() ?? 'receipt') == 'fiscal';

  String get _fiscalOpenUrl =>
      (widget.receipt['verificationUrl'] ?? widget.receipt['qrUrl'] ?? widget.receipt['fileUrl'])
          ?.toString()
          .trim() ??
      '';

  bool get _fiscalPending {
    if (!_isFiscal) return false;
    final status = widget.receipt['status']?.toString() ?? '';
    return _fiscalOpenUrl.isEmpty || status == 'pending';
  }

  Future<void> _refreshFiscal() async {
    final docId = widget.receipt['id']?.toString() ?? '';
    if (docId.isEmpty || widget.schoolId.isEmpty) {
      ref.invalidate(myReceiptsProvider(widget.schoolId));
      return;
    }
    setState(() => _refreshing = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/schools/${widget.schoolId}/fiscal-documents/mine/$docId/refresh');
      if (!mounted) return;
      ref.invalidate(myReceiptsProvider(widget.schoolId));
      _say(context, 'Ανανεώθηκε το παραστατικό.');
    } catch (_) {
      if (mounted) {
        ref.invalidate(myReceiptsProvider(widget.schoolId));
        _say(context, 'Δεν είναι έτοιμο ακόμα — δοκίμασε σε λίγο.');
      }
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _download() async {
    if (widget.onDownload != null) { widget.onDownload!(widget.receipt); return; }
    final kind = widget.receipt['kind']?.toString() ?? 'receipt';
    if (kind == 'fiscal') {
      final url = _fiscalOpenUrl;
      if (url.isEmpty) {
        await _refreshFiscal();
        return;
      }
      setState(() => _downloading = true);
      try {
        final uri = Uri.tryParse(url);
        if (uri == null) { _say(context, 'Άκυρος σύνδεσμος παραστατικού.'); return; }
        final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!opened && mounted) _say(context, 'Δεν άνοιξε ο σύνδεσμος του παραστατικού.');
      } catch (_) {
        if (mounted) _say(context, 'Σφάλμα κατά το άνοιγμα του παραστατικού.');
      } finally {
        if (mounted) setState(() => _downloading = false);
      }
      return;
    }
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
    final kind = receipt['kind']?.toString() ?? 'receipt';
    if (kind == 'fiscal_error') {
      return Container(
        margin: EdgeInsets.only(bottom: widget.nested ? 8 : 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7ED),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFED7AA)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(receipt['title']?.toString() ?? 'Σφάλμα', style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF9A3412))),
            const SizedBox(height: 4),
            Text(receipt['notes']?.toString() ?? '', style: const TextStyle(fontSize: 13, color: Color(0xFF9A3412))),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => ref.invalidate(myReceiptsProvider(widget.schoolId)),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Δοκίμασε ξανά'),
              ),
            ),
          ],
        ),
      );
    }
    final isFiscal = _isFiscal;
    final pending = _fiscalPending;
    final dashTitle = receipt['dashboardTitle']?.toString().trim() ?? '';
    final title = widget.useDashboardTitle && dashTitle.isNotEmpty
        ? dashTitle
        : (receipt['title']?.toString().trim().isNotEmpty == true
            ? receipt['title'].toString()
            : (isFiscal ? 'Παραστατικό' : 'Απόδειξη'));
    final child = receipt['studentName']?.toString() ?? '';
    final when = _receiptDate(receipt['uploadedAt']?.toString());
    final notes = receipt['notes']?.toString() ?? '';
    final monthLabel = _monthLabel(receipt['academicYear']?.toString());
    final amountLabel = widget.hideAmount
        ? ''
        : ((receipt['amountLabel']?.toString().trim().isNotEmpty == true)
            ? receipt['amountLabel'].toString()
            : (isFiscal ? _formatEuro(receipt['grossValue']) : ''));
    final busy = _downloading || _refreshing;
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827))),
              ),
              if (amountLabel.isNotEmpty)
                Text(
                  amountLabel,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: isFiscal ? const Color(0xFF059669) : const Color(0xFF111827),
                  ),
                ),
            ],
          ),
          if (!widget.useDashboardTitle && isFiscal) ...[
            const SizedBox(height: 2),
            Text(
              pending ? 'Φορολογικό παραστατικό · Σε επεξεργασία' : 'Φορολογικό παραστατικό (Elorus)',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: pending ? const Color(0xFFD97706) : const Color(0xFF059669),
              ),
            ),
          ],
          if (!widget.useDashboardTitle && monthLabel.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(monthLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF77328D))),
          ],
          if (!widget.useDashboardTitle && child.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(child, style: const TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w600)),
          ],
          if (when.isNotEmpty || (!widget.useDashboardTitle && notes.isNotEmpty)) ...[
            const SizedBox(height: 4),
            Text(
              [when, if (!widget.useDashboardTitle) notes].where((part) => part.isNotEmpty).join(' · '),
              style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
          ],
          if (pending && widget.useDashboardTitle) ...[
            const SizedBox(height: 4),
            const Text('Σε επεξεργασία', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFD97706))),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: busy ? null : (pending ? _refreshFiscal : _download),
              icon: busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Icon(pending
                      ? Icons.refresh_rounded
                      : (isFiscal ? Icons.open_in_new_rounded : Icons.download_rounded)),
              label: Text(
                busy
                    ? 'Φόρτωση...'
                    : (pending
                        ? 'Ανανέωση'
                        : (isFiscal ? 'Άνοιγμα / λήψη' : 'Κατέβασμα')),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: pending ? const Color(0xFFD97706) : const Color(0xFF77328D),
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

String _formatEuro(dynamic value) {
  if (value == null) return '';
  final n = value is num ? value.toDouble() : double.tryParse(value.toString().replaceAll(',', '.'));
  if (n == null) return '';
  return '€${n.toStringAsFixed(2)}';
}

void _say(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
