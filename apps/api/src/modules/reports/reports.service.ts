import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { schoolYearBounds } from '../billing/billing-quote';

type StudentRow = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  allergies: string | null;
  className: string;
  classId: string | null;
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async overview(schoolId: string, query: {
    academicYearId?: string;
    month?: number;
    year?: number;
    fromMonth?: number;
    fromYear?: number;
    toMonth?: number;
    toYear?: number;
  } = {}) {
    const today = athensToday();
    const now = new Date(`${today}T12:00:00.000Z`);
    const years = await this.prisma.academicYear.findMany({
      where: { schoolId },
      select: { id: true, label: true, startsOn: true, endsOn: true, isCurrent: true },
      orderBy: { startsOn: 'desc' },
    });
    const selectedYear = years.find((row) => row.id === query.academicYearId) ?? years.find((row) => row.isCurrent) ?? years[0];
    const months = financeMonths(today);
    const currentMonth = Number(today.slice(5, 7));
    const currentYear = Number(today.slice(0, 4));
    const current = months.find((row) => row.month === currentMonth && row.year === currentYear) ?? months[months.length - 1];
    const from = resolveMonth(months, query.fromMonth ?? query.month, query.fromYear ?? query.year, current);
    let to = resolveMonth(months, query.toMonth ?? query.month, query.toYear ?? query.year, current);
    const fromIndex = monthIndex(from);
    if (monthIndex(to) < fromIndex) to = from;
    const range = months.filter((row) => monthIndex(row) >= fromIndex && monthIndex(row) <= monthIndex(to));
    const month = to.month;
    const year = to.year;
    const schoolMonths = schoolYearBounds(now).months;
    const schoolYear = {
      label: selectedYear?.label ?? schoolYearBounds(now).label,
      months: schoolMonths,
    };

    const [students, classes, charges, yearCharges, parents, staff, inactive, monthGroups] = await Promise.all([
      this.prisma.student.findMany({
        where: { schoolId, isActive: true },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          allergies: true,
          enrollments: {
            where: selectedYear ? { academicYearId: selectedYear.id } : { academicYear: { isCurrent: true } },
            select: {
              class: { select: { id: true, name: true, level: { select: { name: true, order: true } } } },
            },
          },
          parents: { select: { userId: true, user: { select: { id: true, fullName: true, phone: true } } } },
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
        where: selectedYear ? { schoolId, academicYearId: selectedYear.id } : { schoolId, academicYear: { isCurrent: true } },
        select: {
          id: true,
          name: true,
          capacity: true,
          level: { select: { name: true, order: true } },
          teachers: {
            select: {
              isPrimary: true,
              user: { select: { id: true, fullName: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.monthlyCharge.findMany({
        where: { schoolId, OR: range.map((row) => ({ month: row.month, year: row.year })) },
        select: {
          status: true,
          totalDue: true,
          paidAmount: true,
          schoolFee: true,
          busFee: true,
          activityFees: true,
          student: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.monthlyCharge.aggregate({
        where: {
          schoolId,
          OR: schoolMonths.map((row) => ({ month: row.month, year: row.year })),
        },
        _sum: { totalDue: true, paidAmount: true, subsidyTotal: true, schoolFee: true, busFee: true, activityFees: true },
      }),
      this.prisma.schoolMember.findMany({
        where: { schoolId, role: 'parent', isActive: true },
        select: { user: { select: { id: true, fullName: true, phone: true } } },
        orderBy: { user: { fullName: 'asc' } },
      }),
      this.prisma.schoolMember.findMany({
        where: { schoolId, role: { in: ['teacher', 'school_admin', 'owner'] }, isActive: true },
        select: { id: true, role: true, user: { select: { id: true, fullName: true, phone: true, avatarUrl: true } } },
        orderBy: { user: { fullName: 'asc' } },
      }),
      this.prisma.student.count({ where: { schoolId, isActive: false } }),
      range.length
        ? this.prisma.monthlyCharge.groupBy({
            by: ['month', 'year'],
            where: { schoolId, OR: range.map((row) => ({ month: row.month, year: row.year })) },
            _sum: { totalDue: true, paidAmount: true },
          })
        : Promise.resolve([]),
    ]);

    const enrolled = students.filter((student) => student.enrollments.length > 0);
    const byClass = new Map<string, number>();
    const rosterByClass = new Map<string, { id: string; fullName: string; avatarUrl: string | null; allergies: string | null }[]>();
    const unassigned: StudentRow[] = [];
    const allergies: StudentRow[] = [];
    const bus: StudentRow[] = [];
    const childrenByParent = new Map<string, { id: string; fullName: string }[]>();
    for (const student of enrolled) {
      const enrollment = student.enrollments[0];
      const card: StudentRow = {
        id: student.id,
        fullName: student.fullName,
        avatarUrl: student.avatarUrl,
        allergies: student.allergies,
        className: enrollment?.class.name ?? '',
        classId: enrollment?.class.id ?? null,
      };
      if (card.classId) {
        byClass.set(card.classId, (byClass.get(card.classId) ?? 0) + 1);
        const roster = rosterByClass.get(card.classId) ?? [];
        roster.push({ id: student.id, fullName: student.fullName, avatarUrl: student.avatarUrl, allergies: student.allergies });
        rosterByClass.set(card.classId, roster);
      } else unassigned.push(card);
      if (student.allergies?.trim()) allergies.push(card);
      if (student.studentServices.some((row) => row.service.serviceType === 'bus')) bus.push(card);
      for (const link of student.parents) {
        const list = childrenByParent.get(link.userId) ?? [];
        list.push({ id: student.id, fullName: student.fullName });
        childrenByParent.set(link.userId, list);
      }
    }

    const memberByUser = new Map<string, string>();
    for (const row of staff) {
      if (!memberByUser.has(row.user.id) || row.role === 'teacher') memberByUser.set(row.user.id, row.id);
    }
    const sortPeople = (a: { fullName: string }, b: { fullName: string }) => a.fullName.localeCompare(b.fullName, 'el');

    const owingByStudent = new Map<string, { id: string; fullName: string; className: string; status: string; totalDue: number; paidAmount: number; remaining: number }>();
    for (const row of charges) {
      if (row.status !== 'unpaid' && row.status !== 'partial') continue;
      const remaining = Number(row.totalDue) - Number(row.paidAmount);
      const current = owingByStudent.get(row.student.id) ?? {
        id: row.student.id,
        fullName: row.student.fullName,
        className: enrolled.find((student) => student.id === row.student.id)?.enrollments[0]?.class.name ?? '',
        status: row.status,
        totalDue: 0,
        paidAmount: 0,
        remaining: 0,
      };
      current.totalDue += Number(row.totalDue);
      current.paidAmount += Number(row.paidAmount);
      current.remaining += remaining;
      if (row.status === 'unpaid') current.status = 'unpaid';
      owingByStudent.set(row.student.id, current);
    }
    const owing = [...owingByStudent.values()]
      .filter((row) => row.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining || a.fullName.localeCompare(b.fullName, 'el'));

    const monthDue = charges.reduce((sum, row) => sum + Number(row.totalDue), 0);
    const monthPaid = charges.reduce((sum, row) => sum + Number(row.paidAmount), 0);
    const rangeSchoolFees = charges.reduce((sum, row) => sum + Number(row.schoolFee), 0);
    const rangeBusFees = charges.reduce((sum, row) => sum + Number(row.busFee), 0);
    const rangeActivityFees = charges.reduce((sum, row) => sum + Number(row.activityFees), 0);
    const siblings = siblingFamilies(enrolled);
    const parentRows = new Map<string, { id: string; fullName: string; phone: string | null; children: { id: string; fullName: string }[] }>();
    for (const member of parents) {
      parentRows.set(member.user.id, {
        id: member.user.id,
        fullName: member.user.fullName,
        phone: member.user.phone,
        children: [...(childrenByParent.get(member.user.id) ?? [])].sort(sortPeople),
      });
    }
    for (const student of enrolled) {
      for (const link of student.parents) {
        if (parentRows.has(link.userId)) continue;
        parentRows.set(link.userId, {
          id: link.user.id,
          fullName: link.user.fullName,
          phone: link.user.phone,
          children: [...(childrenByParent.get(link.userId) ?? [])].sort(sortPeople),
        });
      }
    }

    const classRows = classes
      .map((row) => {
        const roster = [...(rosterByClass.get(row.id) ?? [])].sort(sortPeople);
        return {
          id: row.id,
          name: row.name,
          level: row.level?.name ?? 'Χωρίς βαθμίδα',
          levelOrder: row.level?.order ?? 999,
          capacity: row.capacity,
          students: byClass.get(row.id) ?? 0,
          studentNames: roster.map((child) => child.fullName),
          roster,
          teachers: [...row.teachers]
            .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.user.fullName.localeCompare(b.user.fullName, 'el'))
            .map((teacher) => ({
              userId: teacher.user.id,
              memberId: memberByUser.get(teacher.user.id) ?? null,
              fullName: teacher.user.fullName,
              avatarUrl: teacher.user.avatarUrl,
              isPrimary: teacher.isPrimary,
            })),
        };
      })
      .sort((a, b) => a.levelOrder - b.levelOrder || a.level.localeCompare(b.level, 'el') || a.name.localeCompare(b.name, 'el'));

    return {
      month,
      year,
      fromMonth: from.month,
      fromYear: from.year,
      toMonth: to.month,
      toYear: to.year,
      rangeLabel: from.month === to.month && from.year === to.year ? from.label : `${from.label} – ${to.label}`,
      academicYearId: selectedYear?.id ?? null,
      schoolYear: schoolYear.label,
      years: years.map((row) => ({ id: row.id, label: row.label, isCurrent: row.isCurrent })),
      months,
      counts: {
        students: enrolled.length,
        inactive,
        parents: parentRows.size,
        staff: staff.length,
        classes: classes.length,
        unassigned: unassigned.length,
        siblingFamilies: siblings.length,
        withAllergies: allergies.length,
        onBus: bus.length,
      },
      classes: classRows,
      parents: [...parentRows.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'el')),
      staff: staff.map((row) => ({
        id: row.id,
        userId: row.user.id,
        fullName: row.user.fullName,
        phone: row.user.phone,
        avatarUrl: row.user.avatarUrl,
        role: row.role,
      })),
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
        rangeDue: monthDue,
        rangePaid: monthPaid,
        rangeRemaining: monthDue - monthPaid,
        rangeSchoolFees,
        rangeBusFees,
        rangeActivityFees,
      },
      monthSeries: range.map((row) => {
        const hit = monthGroups.find((group) => group.month === row.month && group.year === row.year);
        const short = ['', 'Ιαν', 'Φεβ', 'Μάρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
        return {
          month: row.month,
          year: row.year,
          label: short[row.month] ?? row.label,
          due: Number(hit?._sum.totalDue ?? 0),
          paid: Number(hit?._sum.paidAmount ?? 0),
        };
      }),
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

const MONTHS = ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

function monthIndex(row: { month: number; year: number }) {
  return row.year * 12 + row.month;
}

function financeMonths(today: string) {
  const currentMonth = Number(today.slice(5, 7));
  const currentYear = Number(today.slice(0, 4));
  const schoolStart = currentMonth >= 9 ? currentYear : currentYear - 1;
  let year = schoolStart - 3;
  let month = 9;
  const months: { month: number; year: number; label: string }[] = [];
  while (year < currentYear || (year === currentYear && month <= currentMonth)) {
    months.push({ month, year, label: `${MONTHS[month]} ${year}` });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (months.length > 80) break;
  }
  return months;
}

function resolveMonth(
  months: { month: number; year: number; label: string }[],
  month: number | undefined,
  year: number | undefined,
  fallback: { month: number; year: number; label: string },
) {
  if (!month || !year) return fallback;
  return months.find((row) => row.month === month && row.year === year) ?? fallback;
}

function athensToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
