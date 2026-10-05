import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BREAKFAST = 'Ψωμάκι, τυράκι, σαλάτα και φρούτο εποχής';

// Afternoon snack by day of week (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri)
const AFTERNOON: Record<number, string> = {
  1: 'Φρουτοσαλάτα εποχής (μήλο-αχλάδι-μπανάνα)',
  2: 'Τοστ με τυράκι',
  3: 'Φρουτοσαλάτα',
  4: 'Τοστ με ταχίνι',
  5: 'Δημητριακά',
};

const NOTES = 'Για παιδιά που παραμένουν μετά τις 15:30. Όλα τα φαγητά μαγειρεύονται με εξαιρετικό παρθένο ελαιόλαδο.';

type DayEntry = {
  date: string; // YYYY-MM-DD
  midMorning: string;
  lunch: string;
};

const MENU: DayEntry[] = [
  // Week 1
  { date: '2026-10-01', midMorning: 'Σπιτική μηλόπιτα', lunch: 'Γιουβαρλάκια' },
  { date: '2026-10-02', midMorning: 'Σπιτική τυρόπιτα με βαρελίσια φέτα', lunch: 'Όσπριο: Φακές' },
  // Week 2
  { date: '2026-10-05', midMorning: 'Γιαούρτι σερβιρισμένο με δημητριακά και μπανάνα', lunch: 'Κοφτό μακαρονάκι με κόκκινη σάλτσα βασιλικού' },
  { date: '2026-10-06', midMorning: 'Σπιτικό banana bread', lunch: 'Σουπίτσα μοσχαρίσια με φρέσκα λαχανικά και κριθαράκι' },
  { date: '2026-10-07', midMorning: 'Τοστ με τυρί', lunch: 'Κοτόπουλο λεμονάτο με πιλάφι' },
  { date: '2026-10-08', midMorning: 'Σπιτικό pancake φούρνου', lunch: 'Κοφτό μακαρονάκι με μοσχαρίσιο κιμά' },
  { date: '2026-10-09', midMorning: 'Σπιτική τυρόπιτα με βαρελίσια φέτα', lunch: 'Όσπριο: Φακές' },
  // Week 3
  { date: '2026-10-12', midMorning: 'Ψωμί με ταχίνι κακάο', lunch: 'Μπριάμ φούρνου με φρέσκα λαχανικά, πατατούλες και ρυζάκι' },
  { date: '2026-10-13', midMorning: 'Σπιτικά αλμυρά muffins με φρέσκα λαχανικά', lunch: 'Κοτόπουλο λεμονάτο με πιλάφι' },
  { date: '2026-10-14', midMorning: 'Τοστ με τυράκι', lunch: 'Κοφτό μακαρονάκι με μοσχαρίσιο κιμά' },
  { date: '2026-10-15', midMorning: 'Σπιτικό κέικ marble cake', lunch: 'Σουπίτσα με στήθος φιλέτο κοτόπουλου, φρέσκα λαχανικά και ρυζάκι' },
  { date: '2026-10-16', midMorning: 'Σπιτική τυρόπιτα με βαρελίσια φέτα', lunch: 'Όσπριο: Φακές' },
  // Week 4
  { date: '2026-10-19', midMorning: 'Σπιτικά muffins αλμυρά με τυρί', lunch: 'Λαχανόρυζο' },
  { date: '2026-10-20', midMorning: 'Ψωμί με μαρμελάδα βερίκοκο', lunch: 'Σουτζουκάκια κοκκινιστά με κοφτό μακαρονάκι' },
  { date: '2026-10-21', midMorning: 'Σπιτικό κέικ πορτοκαλιού', lunch: 'Σουπίτσα με στήθος φιλέτο κοτόπουλου, φρέσκα λαχανικά και ρυζάκι' },
  { date: '2026-10-22', midMorning: 'Σπιτική μηλόπιτα', lunch: 'Κοφτό μακαρονάκι με μοσχαρίσιο κιμά' },
  { date: '2026-10-23', midMorning: 'Σπιτική τυρόπιτα με βαρελίσια φέτα', lunch: 'Όσπριο: Φακές' },
  // Week 5
  { date: '2026-10-26', midMorning: 'Σπιτικό carrot cake', lunch: 'Μπριάμ φούρνου με φρέσκα λαχανικά, πατατούλες και ρυζάκι' },
  { date: '2026-10-27', midMorning: 'Τοστ με ταχίνι κακάο', lunch: 'Σουπίτσα με στήθος φιλέτο κοτόπουλου, φρέσκα λαχανικά και ρυζάκι' },
  // 28 Oct = national holiday (28η Οκτωβρίου) - no school
  { date: '2026-10-29', midMorning: 'Σπιτικό pancake φούρνου με ταχίνι', lunch: 'Γιουβετσάκι μοσχαράκι' },
  { date: '2026-10-30', midMorning: 'Σπιτική τυρόπιτα με βαρελίσια φέτα', lunch: 'Όσπριο: Φακές' },
];

async function main() {
  console.log('🥗 Seeding October 2026 menu...');

  const school = await prisma.school.findFirst({ where: { slug: 'sunshine-kindergarten' } });
  if (!school) {
    console.error('School not found — run the main seed first.');
    process.exit(1);
  }

  for (const entry of MENU) {
    const d = new Date(entry.date + 'T12:00:00Z');
    const dow = d.getUTCDay(); // 0=Sun, 1=Mon...6=Sat
    // Convert to 1=Mon...5=Fri
    const dayNum = dow === 0 ? 7 : dow;

    await prisma.dailyMenu.upsert({
      where: { schoolId_date: { schoolId: school.id, date: new Date(entry.date) } },
      create: {
        schoolId: school.id,
        date: new Date(entry.date),
        breakfast: BREAKFAST,
        midMorning: entry.midMorning,
        lunch: entry.lunch,
        afternoon: AFTERNOON[dayNum] ?? null,
        notes: NOTES,
      },
      update: {
        breakfast: BREAKFAST,
        midMorning: entry.midMorning,
        lunch: entry.lunch,
        afternoon: AFTERNOON[dayNum] ?? null,
        notes: NOTES,
      },
    });
    console.log(`  ✓ ${entry.date}`);
  }

  console.log(`\n✅ Loaded ${MENU.length} days for October 2026`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
