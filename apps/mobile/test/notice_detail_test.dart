import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/core/notifications/notification_center.dart';

void main() {
  testWidgets('a notice opens with the full text, the time, and a close button', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: NoticeDetailScreen(
          notice: {
            'title': 'Ενημέρωση αυλής',
            'body': 'Το κείμενο της ενημέρωσης είναι ολόκληρο και δεν κόβεται στη μέση της πρότασης.',
            'sentAt': '2026-10-09T08:57:00.000Z',
            'data': {},
          },
        ),
      ),
    );

    expect(find.text('Ενημέρωση αυλής'), findsOneWidget);
    expect(find.textContaining('Το κείμενο της ενημέρωσης είναι ολόκληρο'), findsOneWidget);
    expect(find.textContaining('·'), findsOneWidget);
    expect(find.text('Κλείσιμο'), findsOneWidget);

    await tester.tap(find.text('Κλείσιμο'));
    await tester.pumpAndSettle();
    expect(find.text('Ενημέρωση αυλής'), findsNothing);
  });
}
