import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/core/api/api_client.dart';
import 'package:omnedu/features/teacher/screens/class_moment_screen.dart';

class _OkAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final path = options.uri.path;
    final body = path.contains('/students')
        ? '[{"id":"student-1","fullName":"Μαρία Παπα"}]'
        : '{}';
    return ResponseBody.fromString(
      body,
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

Future<void> _pump(
  WidgetTester tester, {
  required bool forClass,
  double keyboard = 0,
}) async {
  final dio = Dio()..httpClientAdapter = _OkAdapter();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [dioProvider.overrideWithValue(dio)],
      child: MaterialApp(
        builder: (context, child) {
          final data = MediaQuery.of(context);
          return MediaQuery(
            data: data.copyWith(viewInsets: EdgeInsets.only(bottom: keyboard)),
            child: child!,
          );
        },
        home: ClassMomentScreen(
          schoolId: 'school',
          classId: 'class',
          className: 'Α1',
          forClass: forClass,
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
      'moments composer dismisses the keyboard and keeps save reachable',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const keyboard = 320.0;
    await _pump(tester, forClass: true, keyboard: keyboard);

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.resizeToAvoidBottomInset, isTrue);
    expect(scaffold.bottomNavigationBar, isNull);
    expect(find.text('Σήμερα στην τάξη'), findsOneWidget);

    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.textInputAction, TextInputAction.newline);
    expect(field.keyboardType, TextInputType.multiline);

    final list = tester.widget<ListView>(find.byType(ListView));
    final padding = list.padding! as EdgeInsets;
    expect(padding.bottom, greaterThanOrEqualTo(keyboard));

    expect(
        find.descendant(
            of: find.byType(ListView),
            matching: find.text('Ανέβασμα για τους γονείς')),
        findsOneWidget);

    await tester.tap(find.byType(TextField));
    await tester.pump();
    await tester.enterText(find.byType(TextField), 'Σήμερα παίξαμε στην αυλή');
    await tester.pump();
    expect(
        tester
            .widget<EditableText>(find.byType(EditableText))
            .focusNode
            .hasFocus,
        isTrue);

    await tester.tap(find.textContaining('Οι γονείς της τάξης'));
    await tester.pump();
    expect(
        tester
            .widget<EditableText>(find.byType(EditableText))
            .focusNode
            .hasFocus,
        isFalse);
    expect(find.byType(ClassMomentScreen), findsOneWidget);

    final save = find.text('Ανέβασμα για τους γονείς');
    await tester.scrollUntilVisible(
      save,
      80,
      scrollable: find.ancestor(of: save, matching: find.byType(Scrollable)),
    );
    await tester.tap(save);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Οι γονείς ειδοποιήθηκαν.'), findsOneWidget);
  });

  testWidgets('celebration composer uses the same keyboard-safe form',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const keyboard = 280.0;
    await _pump(tester, forClass: false, keyboard: keyboard);

    expect(find.text('Γιορτάζει'), findsOneWidget);
    expect(
        tester.widget<Scaffold>(find.byType(Scaffold)).resizeToAvoidBottomInset,
        isTrue);
    expect(find.byType(GestureDetector), findsWidgets);

    final padding = tester
        .widget<ListView>(find.byType(ListView).first)
        .padding! as EdgeInsets;
    expect(padding.bottom, greaterThanOrEqualTo(24 + keyboard));

    expect(find.text('Μαρία Παπα'), findsOneWidget);
    await tester.tap(find.byType(TextField));
    await tester.pump();
    await tester.enterText(find.byType(TextField), 'Χρόνια πολλά');
    await tester.pump();

    await tester.tap(find.text('Παιδί'));
    await tester.pump();
    expect(
        tester
            .widget<EditableText>(find.byType(EditableText))
            .focusNode
            .hasFocus,
        isFalse);

    await tester.tap(find.text('Μαρία Παπα'));
    await tester.pump();
    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);

    final save = find.text('Ανέβασμα για τους γονείς');
    final scrollable = tester.state<ScrollableState>(
      find.ancestor(of: save, matching: find.byType(Scrollable)),
    );
    scrollable.position.jumpTo(scrollable.position.maxScrollExtent);
    await tester.pump();
    await tester.tap(save);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Οι γονείς ειδοποιήθηκαν.'), findsOneWidget);
  });
}
