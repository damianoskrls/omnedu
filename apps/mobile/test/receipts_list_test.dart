import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/features/parent/screens/receipts_screen.dart';

void main() {
  testWidgets('the receipt list shows each file with a download button', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ReceiptList(
            receipts: const [
              {
                'title': 'Απόδειξη 15.00€ · Εκδρομή',
                'studentName': 'Ίριδα',
                'notes': 'Προς Μαρία',
                'uploadedAt': '2026-10-09T08:00:00.000Z',
                'fileUrl': 'https://example.com/apodeixi.pdf',
              },
            ],
            onDownload: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Απόδειξη 15.00€ · Εκδρομή'), findsOneWidget);
    expect(find.text('Ίριδα'), findsOneWidget);
    expect(find.text('Κατέβασμα'), findsOneWidget);
  });
}
