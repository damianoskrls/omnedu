import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'receipts_screen.dart';

Future<void> showBillingDocsSheet(BuildContext context, {required String schoolId}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _BillingDocsSheet(schoolId: schoolId),
  );
}

class _BillingDocsSheet extends ConsumerWidget {
  final String schoolId;
  const _BillingDocsSheet({required this.schoolId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final height = MediaQuery.sizeOf(context).height * 0.88;
    return Container(
      height: height,
      decoration: const BoxDecoration(
        color: Color(0xFFF9FAFB),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFD1D5DB),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Παραστατικά',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF111827)),
                  ),
                ),
                IconButton(
                  onPressed: () => ref.invalidate(myReceiptsProvider(schoolId)),
                  icon: const Icon(Icons.refresh_rounded),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                ParentReceipts(
                  schoolId: schoolId,
                  showHeading: false,
                  dashboardMode: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
