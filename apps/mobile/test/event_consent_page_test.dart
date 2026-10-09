import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/features/parent/screens/events_screen.dart';

void main() {
  Map<String, dynamic> enrollment(String status) => {
        'id': 'enr-1',
        'status': status,
        'student': {'id': 'child-1', 'fullName': 'Σοφία'},
        'event': {
          'id': 'event-1',
          'title': 'Εκδρομή στο δάσος',
          'eventType': 'excursion',
          'description': 'Περπατάμε στο δάσος.',
          'dayInstructions': '❖ Να είναι στο σχολείο έως τις 8:00.',
          'arriveBy': '08:00',
          'busOperates': false,
          'eventDate': '2026-10-20T08:00:00.000Z',
          'costPerChild': '15',
          'status': 'published',
        },
      };

  Future<void> pump(WidgetTester tester, String status) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          parentEventsProvider.overrideWith((ref, schoolId) async => [enrollment(status)]),
        ],
        child: const MaterialApp(
          home: ParentEventScreen(schoolId: 'school-1', eventId: 'event-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a pending event shows the details and consent buttons', (tester) async {
    await pump(tester, 'pending_consent');

    expect(find.text('Εκδρομή στο δάσος'), findsOneWidget);
    expect(find.text('Περιγραφή'), findsOneWidget);
    expect(find.text('Περπατάμε στο δάσος.'), findsOneWidget);
    expect(find.text('Χρήσιμες οδηγίες'), findsOneWidget);
    expect(find.text('Να είναι στο σχολείο έως τις 8:00.'), findsOneWidget);
    expect(find.text('Κόστος συμμετοχής ανά παιδί: 15.00 €'), findsOneWidget);
    expect(find.text('Σοφία'), findsOneWidget);
    expect(find.text('Το παιδί πρέπει να είναι στο σχολείο το αργότερο έως τις 08:00.'), findsOneWidget);
    expect(find.text('Το δρομολόγιο του σχολικού δεν θα λειτουργήσει εκείνη την ημέρα.'), findsOneWidget);
    expect(find.text('Συναινώ'), findsOneWidget);
    expect(find.text('Όχι'), findsOneWidget);
  });

  testWidgets('consent that needs payment tells the parent to visit the secretary', (tester) async {
    await pump(tester, 'pending_payment');

    expect(find.text('Εκκρεμεί η πληρωμή. Επισκέψου τη γραμματεία για να την τακτοποιήσεις.'), findsOneWidget);
    expect(find.text('Συναινώ'), findsNothing);
  });

  testWidgets('an answered event keeps the details and hides the consent buttons', (tester) async {
    await pump(tester, 'consent_given');

    expect(find.text('Περπατάμε στο δάσος.'), findsOneWidget);
    expect(find.text('Συναίνεση ✓'), findsOneWidget);
    expect(find.text('Συναινώ'), findsNothing);
    expect(find.text('Όχι'), findsNothing);
  });
}
