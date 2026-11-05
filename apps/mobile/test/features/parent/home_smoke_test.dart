import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/features/parent/home/home_widgets.dart';
import 'package:omnedu/features/parent/home/parent_icons.dart';
import 'package:omnedu/features/parent/home/parent_home_tokens.dart';

void main() {
  testWidgets('greeting and icons render', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: Column(
          children: [
            HomeGreeting(firstName: 'Δαμιανέ', childCount: 1),
            ParentIcon(ParentIconData.home, size: 24),
            ParentIcon(ParentIconData.cake, size: 32),
            ParentIcon(ParentIconData.sun, size: 44),
          ],
        ),
      ),
    ));
    expect(find.textContaining('Δαμιανέ'), findsOneWidget);
    expect(find.textContaining('ματιά'), findsOneWidget);
    expect(ParentHomeTokens.primary.value, 0xFF783B96);
  });
}
