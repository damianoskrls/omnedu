import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/features/parent/home/home_widgets.dart';
import 'package:omnedu/features/parent/home/parent_home_tokens.dart';
import 'package:omnedu/features/parent/home/parent_icons.dart';
import 'package:omnedu/features/parent/screens/parent_shell.dart';

void main() {
  testWidgets('home composition at mobile widths', (tester) async {
    for (final width in [360.0, 390.0, 430.0]) {
      await tester.binding.setSurfaceSize(Size(width, 800));
      await tester.pumpWidget(MaterialApp(
        theme: ThemeData(fontFamily: 'Roboto', useMaterial3: true),
        home: Scaffold(
          backgroundColor: ParentHomeTokens.background,
          body: ListView(
            children: [
              const HomeGreeting(firstName: 'Δαμιανέ', childCount: 2),
              HomeChildSelector(
                children: const [
                  {'id': '1', 'fullName': 'Μαρίνα Παπαδοπούλου'},
                  {'id': '2', 'fullName': 'Νίκος Παπαδόπουλος'},
                ],
                selectedId: '1',
                onSelect: (_) {},
                onOpenHub: (_) {},
              ),
              const HomeSectionHeader(title: 'Σήμερα', icon: ParentIconData.mood),
              HomeSurfaceCard(
                color: ParentHomeTokens.lilac.withValues(alpha: 0.35),
                child: const Row(
                  children: [
                    ParentIcon(ParentIconData.emptyToday, size: 40),
                    SizedBox(width: 12),
                    Expanded(child: Text('Δεν έχει καταχωριστεί ακόμη ενημέρωση για σήμερα.')),
                  ],
                ),
              ),
              const HomeSectionHeader(title: 'Προσεχώς', icon: ParentIconData.calendar),
              HomePartyInviteTile(
                invitation: {
                  'title': 'Πάρτυ γενεθλίων',
                  'eventDate': '2026-11-11T13:20:00.000Z',
                  'forMyChildren': [
                    {'id': '1', 'fullName': 'Μαρίνα'},
                  ],
                },
                showChildren: true,
                onTap: () {},
              ),
              const HomeSectionHeader(title: 'Το σημερινό μενού', icon: ParentIconData.food),
              HomeSurfaceCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final row in [
                      (ParentIconData.snack, 'Δεκατιανό', 'Φρυγανιές με μέλι'),
                      (ParentIconData.lunch, 'Μεσημεριανό', 'Κοτόπουλο με ρύζι και σαλάτα'),
                      (ParentIconData.afternoon, 'Απογευματινό', 'Γιαούρτι με φρούτα'),
                    ])
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        child: Row(
                          children: [
                            ParentIcon(row.$1, size: 18),
                            const SizedBox(width: 12),
                            Expanded(child: Text('${row.$2}: ${row.$3}')),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
          bottomNavigationBar: Material(
            child: SizedBox(
              height: 70,
              child: Row(
                children: const [
                  Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [ParentIcon(ParentIconData.home, size: 22), Text('Αρχική', style: TextStyle(fontSize: 10))])),
                  Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [ParentIcon(ParentIconData.activities, size: 22), Text('Δραστηριότητες', style: TextStyle(fontSize: 10))])),
                  Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [ParentIcon(ParentIconData.events, size: 22), Text('Εκδηλώσεις', style: TextStyle(fontSize: 10))])),
                  Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [ParentIcon(ParentIconData.billing, size: 22), Text('Οικονομικά', style: TextStyle(fontSize: 10))])),
                ],
              ),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.textContaining('Δαμιανέ'), findsOneWidget);
      expect(find.textContaining('ματιά'), findsOneWidget);
      expect(find.text('Σήμερα'), findsOneWidget);
      expect(find.text('Προσεχώς'), findsOneWidget);
      expect(find.text('Το σημερινό μενού'), findsOneWidget);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/parent_home_${width.toInt()}.png'),
      );
    }
  });
}
