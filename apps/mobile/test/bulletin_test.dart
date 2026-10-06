import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/features/parent/screens/bulletin_screen.dart';

void main() {
  testWidgets('daily bulletin shows meal, hygiene, nap and activities', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: DailyBulletinCard(report: {
            'mealBreakfast': 'all',
            'mealLunch': 'all',
            'bathroomCount': 0,
            'diaperChanges': 1,
            'napDurationMinutes': 0,
            'nap2DurationMinutes': 0,
            'activities': ['Γλώσσα', 'Εικαστικά'],
            'notes': 'καλό σας μεσημέρι!',
          }),
        ),
      ),
    ));

    expect(find.text('Διατροφή'), findsOneWidget);
    expect(find.text('Όλο'), findsNWidgets(2));
    expect(find.text('Κακά'), findsOneWidget);
    expect(find.text('Τσισα'), findsOneWidget);
    expect(find.text('Καθόλου'), findsNWidgets(2));
    expect(find.text('Γλώσσα'), findsOneWidget);
    expect(find.textContaining('καλό σας μεσημέρι!'), findsOneWidget);
  });
}
