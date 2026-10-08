import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { schoolYearBounds } from '../billing/billing-quote';

type StudentRow = {
  id: string;
  fullName: string;
  allergies: string | null;
  className: string;
  classId: string | null;
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async overview(schoolId: string) {
    const today = athensToday();
    const now = new Date(`${today}T12:00:00.000Z`);
    const month = Number(today.slice(5, 7));
    const year = Number(today.slice(0, 4));
    const schoolYear = schoolYearBounds(now);

    const [students, classes, charges, yearCharges, parents, staff, inactive] = await Promise.all([
      this.prisma.student.findMany({
        where: { schoolId, isActive: true },
        select: {
          id: true,
          fullName: true,
          allergies: true,
          enrollments: {
            where: { academicYear: { isCurrent: true } },
            select: { class: { select: { id: true, name: true } } },
          },
          parents: { select: { userId: true } },
          siblingLinks: { select: { siblingId: true } },
          siblingOf: { select: { studentId: true } },
          studentServices: {
            where: { isActive: true },
            select: { service: { select: { name: true, serviceType: true } } },
          },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.class.findMany({
        where: { schoolId, academicYear: { isCurrent: true } },
        select: {
          id: true,
          name: true,
          capacity: true,
          level: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.monthlyCharge.findMany({
        where: { schoolId, month, year },
        select: {
          status: true,
          totalDue: true,
          paidAmount: true,
          student: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.monthlyCharge.aggregate({
        where: {
          schoolId,
          OR: schoolYear.months.map((row) => ({ month: row.month, year: row.year })),
        },
        _sum: { totalDue: true, paidAmount: true, subsidyTotal: true, schoolFee: true, busFee: true, activityFees: true },
      }),
      this.prisma.schoolMember.count({ where: { schoolId, role: 'parent', isActive: true } }),
      this.prisma.schoolMember.count({ where: { schoolId, role: { in: ['teacher', 'school_admin', 'owner'] }, isActive: true } }),
      this.prisma.student.count({ where: { schoolId, isActive: false } }),
    ]);

    const byClass = new Map<string, number>();
    const unassigned: StudentRow[] = [];
    const allergies: StudentRow[] = [];
    const bus: StudentRow[] = [];
    for (const student of students) {
      const enrollment = student.enrollments[0];
      const card: StudentRow = {
        id: student.id,
        fullName: student.fullName,
        allergies: student.allergies,
        className: enrollment?.class.name ?? '',
        classId: enrollment?.class.id ?? null,
      };
      if (card.classId) byClass.set(card.classId, (byClass.get(card.classId) ?? 0) + 1);
      else unassigned.push(card);
      if (student.allergies?.trim()) allergies.push(card);
      if (student.studentServices.some((row) => row.service.serviceType === 'bus')) bus.push(card);
    }

    const owing = charges
      .filter((row) => row.status === 'unpaid' || row.status === 'partial')
      .map((row) => ({
        id: row.student.id,
        fullName: row.student.fullName,
        className: students.find((student) => student.id === row.student.id)?.enrollments[0]?.class.name ?? '',
        status: row.status,
        totalDue: Number(row.totalDue),
        paidAmount: Number(row.paidAmount),
        remaining: Number(row.totalDue) - Number(row.paidAmount),
      }))
      .sort((a, b) => b.remaining - a.remaining || a.fullName.localeCompare(b.fullName, 'el'));

    const monthDue = charges.reduce((sum, row) => sum + Number(row.totalDue), 0);
    const monthPaid = charges.reduce((sum, row) => sum + Number(row.paidAmount), 0);
    const siblings = siblingFamilies(students);

    return {
      month,
      year,
      schoolYear: schoolYear.label,
      counts: {
        students: students.length,
        inactive,
        parents,
        staff,
        classes: classes.length,
        unassigned: unassigned.length,
        siblingFamilies: siblings.length,
        withAllergies: allergies.length,
        onBus: bus.length,
      },
      classes: classes
        .map((row) => ({
          id: row.id,
          name: row.name,
          level: row.level?.name ?? '',
          capacity: row.capacity,
          students: byClass.get(row.id) ?? 0,
        }))
        .sort((a, b) => a.level.localeCompare(b.level, 'el') || a.name.localeCompare(b.name, 'el')),
      unassigned,
      siblings,
      allergies,
      bus,
      finances: {
        monthDue,
        monthPaid,
        monthRemaining: monthDue - monthPaid,
        paidCount: charges.filter((row) => row.status === 'paid').length,
        openCount: owing.length,
        yearDue: Number(yearCharges._sum.totalDue ?? 0),
        yearPaid: Number(yearCharges._sum.paidAmount ?? 0),
        yearSubsidies: Number(yearCharges._sum.subsidyTotal ?? 0),
        schoolFees: Number(yearCharges._sum.schoolFee ?? 0),
        busFees: Number(yearCharges._sum.busFee ?? 0),
        activityFees: Number(yearCharges._sum.activityFees ?? 0),
      },
      owing,
    };
  }
}

function siblingFamilies(students: {
  id: string;
  fullName: string;
  enrollments: { class: { name: string } | null }[];
  parents: { userId: string }[];
  siblingLinks: { siblingId: string }[];
  siblingOf: { studentId: string }[];
}[]) {
  const ids = new Set(students.map((student) => student.id));
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const unite = (left: string, right: string) => {
    if (!ids.has(left) || !ids.has(right)) return;
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(a, b);
  };
  for (const student of students) {
    parent.set(student.id, parent.get(student.id) ?? student.id);
    for (const link of student.siblingLinks) unite(student.id, link.siblingId);
    for (const link of student.siblingOf) unite(student.id, link.studentId);
  }
  const byParent = new Map<string, string[]>();
  for (const student of students) {
    for (const link of student.parents) {
      const list = byParent.get(link.userId) ?? [];
      list.push(student.id);
      byParent.set(link.userId, list);
    }
  }
  for (const list of byParent.values()) {
    for (let index = 1; index < list.length; index += 1) unite(list[0], list[index]);
  }
  const groups = new Map<string, typeof students>();
  for (const student of students) {
    const root = find(student.id);
    const list = groups.get(root) ?? [];
    list.push(student);
    groups.set(root, list);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      children: group
        .map((student) => ({
          id: student.id,
          fullName: student.fullName,
          className: student.enrollments[0]?.class?.name ?? '',
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'el')),
    }))
    .sort((a, b) => a.children[0].fullName.localeCompare(b.children[0].fullName, 'el'));
}

function athensToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
