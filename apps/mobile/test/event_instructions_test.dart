import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/features/parent/screens/event_instructions.dart';

void main() {
  testWidgets('day instructions keep each line under the useful-instructions heading', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: UsefulInstructions(
            text: '❖ τα παιδιά θα μεταφερθούν στο χώρο με πούλμαν.\n❖ Το κόστος συμμετοχής ανά παιδί είναι 15€.',
          ),
        ),
      ),
    );

    expect(find.text('Χρήσιμες οδηγίες'), findsOneWidget);
    expect(find.text('τα παιδιά θα μεταφερθούν στο χώρο με πούλμαν.'), findsOneWidget);
    expect(find.text('Το κόστος συμμετοχής ανά παιδί είναι 15€.'), findsOneWidget);
    expect(find.text('❖'), findsNWidgets(2));
  });
}
