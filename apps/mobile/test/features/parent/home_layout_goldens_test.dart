import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnedu/features/parent/home/home_widgets.dart';

void main() {
  testWidgets('home composition at mobile widths', (tester) async {
    for (final width in [360.0, 390.0, 430.0]) {
      await tester.binding.setSurfaceSize(Size(width, 900));
      await tester.pumpWidget(MaterialApp(
        theme: ThemeData(fontFamily: 'Roboto', useMaterial3: true),
        home: Scaffold(
          backgroundColor: const Color(0xFFF6F3FA),
          body: ListView(
            children: [
              const HomeGreeting(firstName: 'Δαμιανέ', childCount: 2),
              HomeChildSelector(
                children: const [
                  {
                    'id': '1',
                    'fullName': 'Μαρίνα Παπαδοπούλου',
                    'gender': 'female',
                    'enrollments': [
                      {
                        'class': {'name': 'Προνήπιο Α'},
                      },
                    ],
                  },
                  {
                    'id': '2',
                    'fullName': 'Νίκος Παπαδόπουλος',
                    'gender': 'male',
                    'enrollments': [
                      {
                        'class': {'name': 'Νήπιο Β'},
                      },
                    ],
                  },
                ],
                onOpenHub: (_) {},
              ),
              HomeMeetingTile(
                child: const <String, dynamic>{
                  'id': '1',
                  'fullName': 'Μαρίνα Παπαδοπούλου',
                  'avatarUrl': null,
                },
                meeting: {
                  'meetingDate': DateTime.now().add(const Duration(days: 3)).toIso8601String(),
                  'acceptedSlot': '10:30',
                },
                onTap: () {},
              ),
              HomePartyInviteTile(
                invitation: {
                  'title': 'Πάρτυ γενεθλίων',
                  'eventDate': '2026-11-11T13:20:00.000Z',
                  'birthdayStudent': {
                    'id': '9',
                    'fullName': 'Ελένη',
                    'gender': 'female',
                  },
                  'forMyChildren': [
                    {'id': '1', 'fullName': 'Μαρίνα'},
                  ],
                },
                showChildren: true,
                onTap: () {},
              ),
              HomePartyInviteTile(
                invitation: {
                  'title': 'Πάρτυ του Γιώργου',
                  'eventDate': '2026-11-14T16:00:00.000Z',
                  'birthdayStudent': {
                    'id': '8',
                    'fullName': 'Γιώργος',
                    'gender': 'male',
                  },
                  'forMyChildren': [
                    {'id': '2', 'fullName': 'Νίκος'},
                  ],
                },
                showChildren: true,
                onTap: () {},
              ),
              const SizedBox(height: 24),
            ],
          ),
          bottomNavigationBar: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
            child: Container(
              height: 70,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(36),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF77328D).withValues(alpha: 0.18),
                    blurRadius: 32,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    flex: 5,
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF77328D), Color(0xFFE95926)],
                        ),
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.home_rounded, color: Colors.white, size: 22),
                          SizedBox(height: 2),
                          Text('Αρχική', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                  const Expanded(flex: 3, child: Icon(Icons.sports_soccer_outlined, color: Color(0xFFBBB8D4))),
                  const Expanded(flex: 3, child: Icon(Icons.event_outlined, color: Color(0xFFBBB8D4))),
                  const Expanded(flex: 3, child: Icon(Icons.account_balance_wallet_outlined, color: Color(0xFFBBB8D4))),
                ],
              ),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.textContaining('Δαμιανέ'), findsOneWidget);
      expect(find.textContaining('Μαρίνα'), findsWidgets);
      expect(find.text('Προνήπιο Α'), findsOneWidget);
      expect(find.textContaining('Συνάντηση με εκπαιδευτικό'), findsOneWidget);
      expect(find.textContaining('Από την Ελένη'), findsOneWidget);
      expect(find.textContaining('Από τον Γιώργο'), findsOneWidget);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/parent_home_${width.toInt()}.png'),
      );
    }
  });
}
