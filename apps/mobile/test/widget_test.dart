import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/app.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: OmneduApp()));
    expect(find.byType(OmneduApp), findsOneWidget);
  });
}
