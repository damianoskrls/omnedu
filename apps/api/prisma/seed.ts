import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Super admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@omnedu.gr' },
    update: {},
    create: {
      email: 'superadmin@omnedu.gr',
      passwordHash: await bcrypt.hash('omnedu2026!', 12),
      fullName: 'Super Admin',
      isSuperAdmin: true,
    },
  });

  // Demo school
  const school = await prisma.school.upsert({
    where: { slug: 'sunshine-kindergarten' },
    update: {},
    create: {
      name: 'Sunshine Kindergarten',
      slug: 'sunshine-kindergarten',
      timezone: 'Europe/Athens',
      locale: 'el',
      subscriptionPlan: 'starter',
    },
  });

  // School admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sunshine.gr' },
    update: {},
    create: {
      email: 'admin@sunshine.gr',
      passwordHash: await bcrypt.hash('admin1234', 12),
      fullName: 'Μαρία Παπαδοπούλου',
      phone: '6944000001',
    },
  });

  await prisma.schoolMember.upsert({
    where: { schoolId_userId_role: { schoolId: school.id, userId: admin.id, role: 'school_admin' } },
    update: {},
    create: { schoolId: school.id, userId: admin.id, role: 'school_admin' },
  });

  // Teacher 1
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@sunshine.gr' },
    update: {},
    create: {
      email: 'teacher@sunshine.gr',
      passwordHash: await bcrypt.hash('teacher1234', 12),
      fullName: 'Ελένη Κωνσταντίνου',
      phone: '6944000002',
    },
  });

  const teacherMember = await prisma.schoolMember.upsert({
    where: { schoolId_userId_role: { schoolId: school.id, userId: teacher.id, role: 'teacher' } },
    update: {},
    create: { schoolId: school.id, userId: teacher.id, role: 'teacher' },
  });

  // Teacher profile
  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { schoolMemberId: teacherMember.id },
    update: {},
    create: {
      schoolMemberId: teacherMember.id,
      phone: '6944000002',
      address: 'Αθήνα, Κολωνάκι',
      bio: 'Νηπιαγωγός με 8 χρόνια εμπειρία σε βρεφονηπιακούς σταθμούς.',
      specialization: 'Πρώτη παιδική ηλικία & Montessori',
      contractType: 'full_time',
      hireDate: new Date('2018-09-01'),
      monthlyGross: 1400,
      education: [
        { degree: 'Πτυχίο Νηπιαγωγών', institution: 'ΕΚΠΑ', year: 2015 },
        { degree: 'Μεταπτυχιακό Ειδικής Αγωγής', institution: 'Παν. Αθηνών', year: 2017 },
      ],
    },
  });

  // Teacher 2
  const teacher2 = await prisma.user.upsert({
    where: { email: 'teacher2@sunshine.gr' },
    update: {},
    create: {
      email: 'teacher2@sunshine.gr',
      passwordHash: await bcrypt.hash('teacher1234', 12),
      fullName: 'Γιώργος Αλεξίου',
      phone: '6944000005',
    },
  });

  const teacher2Member = await prisma.schoolMember.upsert({
    where: { schoolId_userId_role: { schoolId: school.id, userId: teacher2.id, role: 'teacher' } },
    update: {},
    create: { schoolId: school.id, userId: teacher2.id, role: 'teacher' },
  });

  await prisma.teacherProfile.upsert({
    where: { schoolMemberId: teacher2Member.id },
    update: {},
    create: {
      schoolMemberId: teacher2Member.id,
      phone: '6944000005',
      address: 'Αθήνα, Αμπελόκηποι',
      bio: 'Εκπαιδευτικός πρωτοβάθμιας με εξειδίκευση στα μαθηματικά.',
      specialization: 'Μαθηματικά & STEM',
      contractType: 'part_time',
      hireDate: new Date('2021-09-01'),
      monthlyGross: 900,
      education: [
        { degree: 'Πτυχίο Παιδαγωγικής', institution: 'ΑΠΘ', year: 2019 },
      ],
    },
  });

  // Parent
  const parent = await prisma.user.upsert({
    where: { email: 'parent@example.gr' },
    update: {},
    create: {
      email: 'parent@example.gr',
      passwordHash: await bcrypt.hash('parent1234', 12),
      fullName: 'Νίκος Γεωργίου',
      phone: '6944000003',
    },
  });

  await prisma.schoolMember.upsert({
    where: { schoolId_userId_role: { schoolId: school.id, userId: parent.id, role: 'parent' } },
    update: {},
    create: { schoolId: school.id, userId: parent.id, role: 'parent' },
  });

  // Parent 2 (mother of student)
  const parent2 = await prisma.user.upsert({
    where: { email: 'parent2@example.gr' },
    update: {},
    create: {
      email: 'parent2@example.gr',
      passwordHash: await bcrypt.hash('parent1234', 12),
      fullName: 'Σοφία Γεωργίου',
      phone: '6944000004',
    },
  });

  await prisma.schoolMember.upsert({
    where: { schoolId_userId_role: { schoolId: school.id, userId: parent2.id, role: 'parent' } },
    update: {},
    create: { schoolId: school.id, userId: parent2.id, role: 'parent' },
  });

  // Academic year
  const year = await prisma.academicYear.upsert({
    where: { id: 'ay-2025-2026' },
    update: { isCurrent: true },
    create: {
      id: 'ay-2025-2026',
      schoolId: school.id,
      label: '2025-2026',
      startsOn: new Date('2025-09-01'),
      endsOn: new Date('2026-06-30'),
      isCurrent: true,
    },
  });

  // Previous academic year
  const prevYear = await prisma.academicYear.upsert({
    where: { id: 'ay-2024-2025' },
    update: {},
    create: {
      id: 'ay-2024-2025',
      schoolId: school.id,
      label: '2024-2025',
      startsOn: new Date('2024-09-01'),
      endsOn: new Date('2025-06-30'),
      isCurrent: false,
    },
  });

  // ── Levels (βαθμίδες) ──────────────────────────────────
  const levelBaby = await prisma.level.upsert({
    where: { id: 'level-baby' },
    update: { coordinatorId: teacher.id },
    create: {
      id: 'level-baby',
      schoolId: school.id,
      name: 'Βρεφικό',
      description: 'Τμήματα για βρέφη 2–12 μηνών',
      order: 1,
      coordinatorId: teacher.id,
    },
  });

  const levelToddler = await prisma.level.upsert({
    where: { id: 'level-toddler' },
    update: { coordinatorId: teacher.id },
    create: {
      id: 'level-toddler',
      schoolId: school.id,
      name: 'Μεταβρεφικό',
      description: 'Τμήματα για βρέφη 12–24 μηνών',
      order: 2,
      coordinatorId: teacher2.id,
    },
  });

  const levelPreNursery = await prisma.level.upsert({
    where: { id: 'level-pre-nursery' },
    update: {},
    create: {
      id: 'level-pre-nursery',
      schoolId: school.id,
      name: 'Βρεφονηπιακό',
      description: 'Τμήματα 2–3 χρονών',
      order: 3,
      coordinatorId: teacher.id,
    },
  });

  const levelNursery = await prisma.level.upsert({
    where: { id: 'level-nursery' },
    update: {},
    create: {
      id: 'level-nursery',
      schoolId: school.id,
      name: 'Νηπιακό',
      description: 'Παιδικός σταθμός 3–4 χρονών',
      order: 4,
      coordinatorId: teacher.id,
    },
  });

  const levelKindergarten = await prisma.level.upsert({
    where: { id: 'level-kindergarten' },
    update: {},
    create: {
      id: 'level-kindergarten',
      schoolId: school.id,
      name: 'Νηπιαγωγείο',
      description: 'Νηπιαγωγείο 4–6 χρονών',
      order: 5,
      coordinatorId: teacher2.id,
    },
  });

  // Classes — current year
  const cls = await prisma.class.upsert({
    where: { id: 'class-butterflies' },
    update: { levelId: levelNursery.id, ageGroup: '3-4 χρονών' },
    create: {
      id: 'class-butterflies',
      schoolId: school.id,
      academicYearId: year.id,
      levelId: levelNursery.id,
      name: 'Πεταλούδες',
      ageGroup: '3-4 χρονών',
      capacity: 20,
    },
  });

  const cls2 = await prisma.class.upsert({
    where: { id: 'class-stars' },
    update: { levelId: levelKindergarten.id, ageGroup: '4-5 χρονών' },
    create: {
      id: 'class-stars',
      schoolId: school.id,
      academicYearId: year.id,
      levelId: levelKindergarten.id,
      name: 'Αστεράκια',
      ageGroup: '4-5 χρονών',
      capacity: 18,
    },
  });

  const clsBabies = await prisma.class.upsert({
    where: { id: 'class-babies' },
    update: { levelId: levelBaby.id, ageGroup: '2-12 μηνών' },
    create: {
      id: 'class-babies',
      schoolId: school.id,
      academicYearId: year.id,
      levelId: levelBaby.id,
      name: 'Ηλιαχτίδες',
      ageGroup: '2-12 μηνών',
      capacity: 8,
    },
  });

  const clsToddlers = await prisma.class.upsert({
    where: { id: 'class-toddlers' },
    update: { levelId: levelToddler.id, ageGroup: '12-24 μηνών' },
    create: {
      id: 'class-toddlers',
      schoolId: school.id,
      academicYearId: year.id,
      levelId: levelToddler.id,
      name: 'Αρκουδάκια',
      ageGroup: '12-24 μηνών',
      capacity: 10,
    },
  });

  const clsPreNursery = await prisma.class.upsert({
    where: { id: 'class-pre-nursery' },
    update: { levelId: levelPreNursery.id, ageGroup: '2-3 χρονών' },
    create: {
      id: 'class-pre-nursery',
      schoolId: school.id,
      academicYearId: year.id,
      levelId: levelPreNursery.id,
      name: 'Ουράνιο Τόξο',
      ageGroup: '2-3 χρονών',
      capacity: 15,
    },
  });

  const prevCls = await prisma.class.upsert({
    where: { id: 'class-prev-butterflies' },
    update: { levelId: levelNursery.id },
    create: {
      id: 'class-prev-butterflies',
      schoolId: school.id,
      academicYearId: prevYear.id,
      levelId: levelNursery.id,
      name: 'Πεταλούδες',
      ageGroup: '3-4 χρονών',
      capacity: 20,
    },
  });

  await prisma.classTeacher.upsert({
    where: { classId_userId: { classId: cls.id, userId: teacher.id } },
    update: {},
    create: { classId: cls.id, userId: teacher.id, isPrimary: true },
  });

  await prisma.classTeacher.upsert({
    where: { classId_userId: { classId: cls2.id, userId: teacher2.id } },
    update: {},
    create: { classId: cls2.id, userId: teacher2.id, isPrimary: true },
  });

  await prisma.classTeacher.upsert({
    where: { classId_userId: { classId: clsBabies.id, userId: teacher.id } },
    update: {},
    create: { classId: clsBabies.id, userId: teacher.id, isPrimary: true },
  });

  await prisma.classTeacher.upsert({
    where: { classId_userId: { classId: clsToddlers.id, userId: teacher2.id } },
    update: {},
    create: { classId: clsToddlers.id, userId: teacher2.id, isPrimary: true },
  });

  await prisma.classTeacher.upsert({
    where: { classId_userId: { classId: clsPreNursery.id, userId: teacher.id } },
    update: {},
    create: { classId: clsPreNursery.id, userId: teacher.id, isPrimary: true },
  });

  await prisma.classTeacher.upsert({
    where: { classId_userId: { classId: prevCls.id, userId: teacher.id } },
    update: {},
    create: { classId: prevCls.id, userId: teacher.id, isPrimary: true },
  });

  // Student 1
  const student = await prisma.student.upsert({
    where: { id: 'student-alexis' },
    update: {},
    create: {
      id: 'student-alexis',
      schoolId: school.id,
      fullName: 'Αλέξης Γεωργίου',
      dob: new Date('2022-03-15'),
      allergies: 'Αλλεργία στους ξηρούς καρπούς',
      bloodType: 'A+',
      address: 'Λεωφόρος Αλεξάνδρας 5, Αθήνα',
      notes: 'Αγαπά τη ζωγραφική και τη μουσική.',
    },
  });

  await prisma.studentParent.upsert({
    where: { studentId_userId: { studentId: student.id, userId: parent.id } },
    update: {},
    create: { studentId: student.id, userId: parent.id, relation: 'Πατέρας', isPrimary: true },
  });

  await prisma.studentParent.upsert({
    where: { studentId_userId: { studentId: student.id, userId: parent2.id } },
    update: {},
    create: { studentId: student.id, userId: parent2.id, relation: 'Μητέρα', isPrimary: false },
  });

  await prisma.classEnrollment.upsert({
    where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } },
    update: {},
    create: { studentId: student.id, classId: cls.id, academicYearId: year.id },
  });

  // Previous year enrollment
  await prisma.classEnrollment.upsert({
    where: { studentId_academicYearId: { studentId: student.id, academicYearId: prevYear.id } },
    update: {},
    create: { studentId: student.id, classId: prevCls.id, academicYearId: prevYear.id },
  });

  // Student 2 (sibling)
  const student2 = await prisma.student.upsert({
    where: { id: 'student-sofia' },
    update: {},
    create: {
      id: 'student-sofia',
      schoolId: school.id,
      fullName: 'Σοφία Γεωργίου',
      dob: new Date('2020-07-22'),
      bloodType: 'A+',
      address: 'Λεωφόρος Αλεξάνδρας 5, Αθήνα',
      notes: 'Πολύ κοινωνικό παιδί.',
    },
  });

  await prisma.studentParent.upsert({
    where: { studentId_userId: { studentId: student2.id, userId: parent.id } },
    update: {},
    create: { studentId: student2.id, userId: parent.id, relation: 'Πατέρας', isPrimary: true },
  });

  await prisma.studentParent.upsert({
    where: { studentId_userId: { studentId: student2.id, userId: parent2.id } },
    update: {},
    create: { studentId: student2.id, userId: parent2.id, relation: 'Μητέρα', isPrimary: false },
  });

  await prisma.classEnrollment.upsert({
    where: { studentId_academicYearId: { studentId: student2.id, academicYearId: year.id } },
    update: {},
    create: { studentId: student2.id, classId: cls2.id, academicYearId: year.id },
  });

  // Student 3
  const student3 = await prisma.student.upsert({
    where: { id: 'student-petros' },
    update: {},
    create: {
      id: 'student-petros',
      schoolId: school.id,
      fullName: 'Πέτρος Παπαδάκης',
      dob: new Date('2021-11-05'),
      allergies: 'Γαλακτοκομικά',
      bloodType: 'B+',
    },
  });

  await prisma.classEnrollment.upsert({
    where: { studentId_academicYearId: { studentId: student3.id, academicYearId: year.id } },
    update: {},
    create: { studentId: student3.id, classId: cls.id, academicYearId: year.id },
  });

  // Daily reports for Alexis
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  for (const [date, mood, napMin, breakfast, lunch] of [
    [today, 'χαρούμενος', 90, 'good', 'good'],
    [yesterday, 'ήρεμος', 60, 'partial', 'good'],
    [twoDaysAgo, 'κουρασμένος', 120, 'good', 'refused'],
  ] as [Date, string, number, string, string][]) {
    await prisma.dailyReport.upsert({
      where: { studentId_reportDate: { studentId: student.id, reportDate: date } },
      update: {},
      create: {
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        reportDate: date,
        mealBreakfast: breakfast,
        mealLunch: lunch,
        mealSnack: 'good',
        napDurationMinutes: napMin,
        bathroomCount: 3,
        mood,
        notes: 'Συμμετείχε ενεργά στις δραστηριότητες.',
      },
    });
  }

  // Invoices
  const inv1 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-001' },
    update: {},
    create: {
      schoolId: school.id,
      studentId: student.id,
      parentId: parent.id,
      amount: 250,
      currency: 'EUR',
      description: 'Δίδακτρα Οκτωβρίου 2026',
      dueDate: new Date('2026-10-10'),
      status: 'paid',
      paidAt: new Date('2026-10-05'),
      invoiceNumber: 'INV-2026-001',
    },
  });

  const inv2 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-002' },
    update: {},
    create: {
      schoolId: school.id,
      studentId: student.id,
      parentId: parent.id,
      amount: 250,
      currency: 'EUR',
      description: 'Δίδακτρα Νοεμβρίου 2026',
      dueDate: new Date('2026-11-10'),
      status: 'unpaid',
      invoiceNumber: 'INV-2026-002',
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-003' },
    update: {},
    create: {
      schoolId: school.id,
      studentId: student2.id,
      parentId: parent.id,
      amount: 250,
      currency: 'EUR',
      description: 'Δίδακτρα Οκτωβρίου 2026',
      dueDate: new Date('2026-10-10'),
      status: 'overdue',
      invoiceNumber: 'INV-2026-003',
    },
  });

  // Salary records for teacher
  const months = [
    { month: 9, year: 2026, gross: 1400, ded: 280, net: 1120, paid: new Date('2026-09-30') },
    { month: 8, year: 2026, gross: 1400, ded: 280, net: 1120, paid: new Date('2026-08-31') },
    { month: 7, year: 2026, gross: 1400, ded: 280, net: 1120, paid: new Date('2026-07-31') },
  ];

  for (const s of months) {
    await prisma.salaryRecord.upsert({
      where: { teacherProfileId_month_year: { teacherProfileId: teacherProfile.id, month: s.month, year: s.year } },
      update: {},
      create: {
        teacherProfileId: teacherProfile.id,
        month: s.month,
        year: s.year,
        grossAmount: s.gross,
        deductions: s.ded,
        netAmount: s.net,
        paidAt: s.paid,
      },
    });
  }

  // Leave requests
  await prisma.leaveRequest.upsert({
    where: { id: 'leave-001' },
    update: {},
    create: {
      id: 'leave-001',
      teacherProfileId: teacherProfile.id,
      leaveType: 'annual',
      startDate: new Date('2026-12-23'),
      endDate: new Date('2026-12-31'),
      status: 'approved',
      notes: 'Χριστουγεννιάτικες άδειες',
      approvedById: admin.id,
    },
  });

  await prisma.leaveRequest.upsert({
    where: { id: 'leave-002' },
    update: {},
    create: {
      id: 'leave-002',
      teacherProfileId: teacherProfile.id,
      leaveType: 'sick',
      startDate: new Date('2026-10-14'),
      endDate: new Date('2026-10-15'),
      status: 'pending',
      notes: 'Γιατρός',
    },
  });

  // Parent meetings
  const nextMeeting = new Date();
  nextMeeting.setDate(nextMeeting.getDate() + 10);
  const pastMeeting = new Date();
  pastMeeting.setDate(pastMeeting.getDate() - 30);

  await prisma.parentMeeting.upsert({
    where: { id: 'meeting-001' },
    update: {},
    create: {
      id: 'meeting-001',
      schoolId: school.id,
      title: 'Ενημέρωση Γονέων Νηπιακού',
      description: 'Συνάντηση για την πρόοδο των παιδιών και το εκπαιδευτικό πρόγραμμα του τριμήνου.',
      meetingDate: nextMeeting,
      levelId: levelNursery.id,
    },
  });

  await prisma.parentMeeting.upsert({
    where: { id: 'meeting-002' },
    update: {},
    create: {
      id: 'meeting-002',
      schoolId: school.id,
      title: 'Συνάντηση Τάξης Πεταλούδων',
      description: 'Ατομικές συναντήσεις για κάθε μαθητή.',
      meetingDate: pastMeeting,
      classId: cls.id,
    },
  });

  // Daily menu for current week
  const menuBase = new Date();
  menuBase.setHours(0, 0, 0, 0);
  const menuDays = [
    { d: 0, b: 'Γάλα με δημητριακά', m: 'Κοτόπουλο με ρύζι', l: 'Σπανακόρυζο', a: 'Γιαούρτι με μέλι' },
    { d: 1, b: 'Τοστ με τυρί', m: 'Μακαρόνια με κιμά', l: 'Ψωμί με ταχίνι', a: 'Φρούτα εποχής' },
    { d: 2, b: 'Γάλα με παξιμάδι', m: 'Ψάρι φούρνου με πατάτες', l: 'Φακές', a: 'Μπισκότα ολικής' },
    { d: 3, b: 'Κέικ βρώμης', m: 'Κοτόσουπα με ψωμί', l: 'Σαλάτα εποχής', a: 'Γάλα' },
    { d: 4, b: 'Τοστ με μαρμελάδα', m: 'Κεφτεδάκια με πουρέ', l: 'Χορτόπιτα', a: 'Φρούτα' },
  ];

  for (const day of menuDays) {
    const date = new Date(menuBase);
    date.setDate(menuBase.getDate() + day.d);
    await prisma.dailyMenu.upsert({
      where: { schoolId_date: { schoolId: school.id, date } },
      update: { breakfast: day.b, lunch: day.m, midMorning: day.l, afternoon: day.a },
      create: {
        schoolId: school.id,
        date,
        breakfast: day.b,
        midMorning: day.l,
        lunch: day.m,
        afternoon: day.a,
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log('\nAccounts:');
  console.log('  Super Admin: superadmin@omnedu.gr / omnedu2026!');
  console.log('  School Admin: admin@sunshine.gr / admin1234');
  console.log('  Teacher: teacher@sunshine.gr / teacher1234');
  console.log('  Teacher 2: teacher2@sunshine.gr / teacher1234');
  console.log('  Parent: parent@example.gr / parent1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
