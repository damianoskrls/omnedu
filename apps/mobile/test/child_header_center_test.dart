import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/core/widgets/person_face.dart';
import 'package:omnedu/features/parent/screens/bus_closure.dart';
import 'package:omnedu/features/parent/screens/child_hub_screen.dart';

void main() {
  testWidgets('child header centers photo, name, class, level, and teacher', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: ChildHubScreen(
            schoolId: 'school-1',
            child: {
              'id': 'child-1',
              'fullName': 'Σοφία Γεωργίου',
              'enrollments': [
                {
                  'academicYear': {'isCurrent': true},
                  'class': {
                    'id': 'class-1',
                    'name': 'Αστεράκια',
                    'level': {'name': 'Νηπιαγωγείο'},
                    'teachers': [
                      {
                        'user': {'id': 'teacher-1', 'fullName': 'Γιώργος Αλεξίου'},
                      },
                    ],
                  },
                },
              ],
            },
          ),
        ),
      ),
    );
    await tester.pump();

    final width = tester.getSize(find.byType(Scaffold)).width;
    void expectCentered(Finder finder) {
      expect(finder, findsOneWidget);
      expect(tester.getCenter(finder).dx, closeTo(width / 2, 1));
    }

    expectCentered(find.byWidgetPredicate((widget) => widget is PersonFace && widget.size == 64));
    expectCentered(find.byWidgetPredicate((widget) => widget is Text && widget.data == 'Σοφία Γεωργίου' && widget.style?.fontSize == 20));
    expectCentered(find.text('Τάξη Αστεράκια'));
    expectCentered(find.text('Βαθμίδα Νηπιαγωγείο'));
    expectCentered(
      find.ancestor(
        of: find.text('Γιώργος Αλεξίου'),
        matching: find.byWidgetPredicate((widget) => widget is Material && widget.borderRadius == BorderRadius.circular(20)),
      ),
    );

    final back = tester.getCenter(find.byIcon(Icons.arrow_back_rounded));
    expect(back.dx, lessThan(40));
    expect(back.dx, lessThan(width / 2 - 80));
    expect(find.text('Δες πού είναι το σχολικό'), findsNothing);

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -500));
    await tester.pump();

    final collapsedName = find.byWidgetPredicate((widget) => widget is Text && widget.data == 'Σοφία Γεωργίου' && widget.style?.fontSize == 16);
    expectCentered(find.ancestor(of: collapsedName, matching: find.byType(Row)));
    expect(tester.getCenter(find.byIcon(Icons.arrow_back_rounded)).dx, lessThan(40));
  });

  testWidgets('a child with a school bus shows the map shortcut above the regulations', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          busClosureTodayProvider.overrideWith((ref, schoolId) async => null),
        ],
        child: MaterialApp(
          home: ChildHubScreen(
            schoolId: 'school-1',
            child: {
              'id': 'child-1',
              'fullName': 'Σοφία Γεωργίου',
              'studentServices': [
                {
                  'service': {'name': 'Πρωινό σχολικό', 'serviceType': 'bus'},
                },
              ],
            },
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Δες πού είναι το σχολικό'), findsOneWidget);
    final bus = tester.getTopLeft(find.text('Δες πού είναι το σχολικό'));
    final rules = tester.getTopLeft(find.text('Κανονισμοί'));
    expect(bus.dy, lessThan(rules.dy));
  });

  testWidgets('a closed bus day replaces the map shortcut with the reason', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          busClosureTodayProvider.overrideWith((ref, schoolId) async => {'closed': true, 'reason': 'Απεργία'}),
        ],
        child: const MaterialApp(
          home: ChildHubScreen(
            schoolId: 'school-1',
            child: {
              'id': 'child-1',
              'fullName': 'Σοφία Γεωργίου',
              'studentServices': [
                {
                  'service': {'name': 'Πρωινό σχολικό', 'serviceType': 'bus'},
                },
              ],
            },
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Σήμερα δεν θα έχει σχολικό'), findsOneWidget);
    expect(find.text('Απεργία'), findsOneWidget);
    expect(find.text('Δες πού είναι το σχολικό'), findsNothing);
  });
}
