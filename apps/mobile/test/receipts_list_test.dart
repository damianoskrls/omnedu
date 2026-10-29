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

  testWidgets('receipts on billing are grouped by year in an accordion', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ReceiptList(
            receipts: const [
              {
                'title': 'Απόδειξη Σεπτεμβρίου 2026',
                'studentName': 'Ίριδα',
                'academicYear': '2026-09',
                'uploadedAt': '2026-09-15T08:00:00.000Z',
                'fileUrl': 'https://example.com/sep.pdf',
              },
              {
                'title': 'Απόδειξη Ιανουαρίου 2025',
                'studentName': 'Ίριδα',
                'academicYear': '2025-01',
                'uploadedAt': '2025-01-10T08:00:00.000Z',
                'fileUrl': 'https://example.com/jan.pdf',
              },
            ],
            groupByYear: true,
            onDownload: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('2026'), findsOneWidget);
    expect(find.text('2025'), findsOneWidget);
    // Newest year starts expanded
    expect(find.text('Απόδειξη Σεπτεμβρίου 2026'), findsOneWidget);
    // Older year collapsed until tapped
    expect(find.text('Απόδειξη Ιανουαρίου 2025'), findsNothing);
    await tester.tap(find.text('2025'));
    await tester.pumpAndSettle();
    expect(find.text('Απόδειξη Ιανουαρίου 2025'), findsOneWidget);
    expect(find.text('Κατέβασμα'), findsNWidgets(2));
  });
}
