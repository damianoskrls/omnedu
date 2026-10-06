import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isOpenMonth, quoteStudentMonth, schoolYearBounds } from './billing-quote';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // ── Level fees ──────────────────────────────────────────

  async getLevelFees(schoolId: string) {
    return this.prisma.levelFee.findMany({
      where: { schoolId },
      include: { level: { select: { id: true, name: true, order: true } } },
      orderBy: { level: { order: 'asc' } },
    });
  }

  async upsertLevelFee(schoolId: string, levelId: string, data: { monthlyFee?: number; annualFee?: number | null; academicYear?: string }) {
    const academicYear = data.academicYear ?? null;
    const existing = await this.prisma.levelFee.findFirst({ where: { levelId, academicYear } });
    if (existing) {
      return this.prisma.levelFee.update({
        where: { id: existing.id },
        data: {
          ...(data.monthlyFee !== undefined ? { monthlyFee: data.monthlyFee } : {}),
          ...(data.annualFee !== undefined ? { annualFee: data.annualFee } : {}),
        },
      });
    }
    return this.prisma.levelFee.create({
      data: { schoolId, levelId, monthlyFee: data.monthlyFee ?? 0, annualFee: data.annualFee ?? null, academicYear },
    });
  }

  async deleteLevelFee(schoolId: string, levelFeeId: string) {
    const fee = await this.prisma.levelFee.findFirst({ where: { id: levelFeeId, schoolId } });
    if (!fee) throw new NotFoundException('Level fee not found');
    return this.prisma.levelFee.delete({ where: { id: levelFeeId } });
  }

  // ── Student fee overrides ────────────────────────────────

  async getStudentFeeOverride(schoolId: string, studentId: string) {
    return this.prisma.studentFeeOverride.findFirst({ where: { schoolId, studentId } });
  }

  async upsertStudentFeeOverride(schoolId: string, studentId: string, data: {
    discountPct?: number | null;
    fixedAmount?: number | null;
    reason?: string;
  }) {
    const saved = await this.prisma.studentFeeOverride.upsert({
      where: { studentId },
      create: { schoolId, studentId, ...data },
      update: data,
    });
    await this.refreshUnpaidCharges(schoolId, studentId);
    return saved;
  }

  async deleteStudentFeeOverride(schoolId: string, studentId: string) {
    const override = await this.prisma.studentFeeOverride.findFirst({ where: { schoolId, studentId } });
    if (!override) throw new NotFoundException('Fee override not found');
    const deleted = await this.prisma.studentFeeOverride.delete({ where: { studentId } });
    await this.refreshUnpaidCharges(schoolId, studentId);
    return deleted;
  }

  private async refreshUnpaidCharges(schoolId: string, studentId: string) {
    const unpaid = await this.prisma.monthlyCharge.findMany({
      where: { schoolId, studentId, status: 'unpaid' },
    });
    for (const charge of unpaid) {
      await this.generateStudentCharge(schoolId, studentId, charge.month, charge.year);
    }
  }

  private busNet(ss: {
    serviceMode?: string | null;
    discountAmount?: unknown;
    service: { serviceType: string; monthlyCost?: unknown; pickupCost?: unknown; dropoffCost?: unknown };
  }) {
    if (ss.service.serviceType !== 'bus') return 0;
    const mode = ss.serviceMode ?? 'both';
    const base = mode === 'pickup'
      ? Number(ss.service.pickupCost ?? ss.service.monthlyCost ?? 0)
      : mode === 'dropoff'
      ? Number(ss.service.dropoffCost ?? ss.service.monthlyCost ?? 0)
      : Number(ss.service.monthlyCost ?? 0);
    return Math.max(0, Math.round((base - Number(ss.discountAmount ?? 0)) * 100) / 100);
  }

  // ── Subsidies ────────────────────────────────────────────

  async getStudentSubsidies(schoolId: string, studentId: string) {
    return this.prisma.studentSubsidy.findMany({
      where: { schoolId, studentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSubsidy(schoolId: string, studentId: string, data: {
    name: string; subsidyType: string; monthlyAmount: number;
    startsFrom?: string; endsAt?: string; notes?: string;
  }) {
    const created = await this.prisma.studentSubsidy.create({
      data: {
        schoolId, studentId,
        name: data.name,
        subsidyType: data.subsidyType,
        monthlyAmount: data.monthlyAmount,
        startsFrom: data.startsFrom ? new Date(data.startsFrom) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        notes: data.notes,
      },
    });
    await this.ensureStudentLedger(schoolId, studentId);
    return created;
  }

  async updateSubsidy(schoolId: string, subsidyId: string, data: {
    name?: string; subsidyType?: string; monthlyAmount?: number;
    isActive?: boolean; startsFrom?: string; endsAt?: string; notes?: string;
  }) {
    const sub = await this.prisma.studentSubsidy.findFirst({ where: { id: subsidyId, schoolId } });
    if (!sub) throw new NotFoundException('Subsidy not found');
    const updated = await this.prisma.studentSubsidy.update({
      where: { id: subsidyId },
      data: {
        ...data,
        startsFrom: data.startsFrom ? new Date(data.startsFrom) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      },
    });
    await this.ensureStudentLedger(schoolId, sub.studentId);
    return updated;
  }

  async deleteSubsidy(schoolId: string, subsidyId: string) {
    const sub = await this.prisma.studentSubsidy.findFirst({ where: { id: subsidyId, schoolId } });
    if (!sub) throw new NotFoundException('Subsidy not found');
    const deleted = await this.prisma.studentSubsidy.delete({ where: { id: subsidyId } });
    await this.ensureStudentLedger(schoolId, sub.studentId);
    return deleted;
  }

  // ── Monthly charges ──────────────────────────────────────

  async getMonthlyCharges(schoolId: string, month: number, year: number) {
    return this.prisma.monthlyCharge.findMany({
      where: { schoolId, month, year },
      include: {
        student: {
          select: {
            id: true, fullName: true,
            enrollments: {
              where: { academicYear: { isCurrent: true } },
              include: { class: { include: { level: { select: { id: true, name: true } } } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { student: { fullName: 'asc' } },
    });
  }

  async getStudentCharges(schoolId: string, studentId: string) {
    await this.ensureStudentLedger(schoolId, studentId);
    return this.prisma.monthlyCharge.findMany({
      where: { schoolId, studentId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getMyCharges(parentUserId: string, schoolId: string) {
    const children = await this.prisma.student.findMany({
      where: { schoolId, isActive: true, parents: { some: { userId: parentUserId } } },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    const results = await Promise.all(
      children.map(async (child) => {
        await this.ensureStudentLedger(schoolId, child.id);
        const [monthly, oneTime, events] = await Promise.all([
          this.prisma.monthlyCharge.findMany({
            where: { schoolId, studentId: child.id },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
          }),
          this.prisma.oneTimeCharge.findMany({
            where: { schoolId, studentId: child.id },
            orderBy: { chargeDate: 'desc' },
          }),
          this.prisma.schoolEventEnrollment.findMany({
            where: { studentId: child.id },
            include: {
              event: {
                select: { id: true, title: true, eventType: true, eventDate: true, costPerChild: true, status: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);
        return { student: child, monthly, oneTime, events };
      }),
    );
    return results;
  }

  async generateMonthlyCharges(schoolId: string, month: number, year: number) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, isActive: true },
      include: {
        enrollments: {
          where: { academicYear: { isCurrent: true } },
          include: {
            class: {
              include: {
                level: {
                  include: {
                    levelFees: { orderBy: { academicYear: 'desc' } },
                  },
                },
              },
            },
          },
          take: 1,
        },
        studentServices: {
          where: { isActive: true },
          include: {
            service: { select: { serviceType: true, monthlyCost: true, pickupCost: true, dropoffCost: true } },
          },
        },
        activityRegistrations: {
          where: { status: { in: ['approved', 'pending'] } },
          include: {
            activity: { select: { title: true, monthlyCost: true, oneTimeCost: true, startsOn: true, endsOn: true } },
          },
        },
        feeOverride: true,
        subsidies: true,
      },
    });

    const results = [];
    for (const student of students) {
      const existing = await this.prisma.monthlyCharge.findFirst({
        where: { studentId: student.id, month, year },
      });
      // Don't overwrite charges that have already been partially/fully paid
      if (existing && existing.status !== 'unpaid') {
        results.push(existing);
        continue;
      }

      const quote = this.quoteLoadedStudent(student, month, year);
      const { schoolFee, busFee, activityFees, subsidyTotal, totalDue } = quote;

      const charge = await this.prisma.monthlyCharge.upsert({
        where: { studentId_month_year: { studentId: student.id, month, year } },
        create: {
          schoolId, studentId: student.id, month, year,
          schoolFee, busFee, activityFees, subsidyTotal, totalDue,
          paidAmount: 0, status: 'unpaid',
        },
        update: { schoolFee, busFee, activityFees, subsidyTotal, totalDue },
      });
      results.push(charge);
    }

    return { generated: results.length, month, year };
  }

  async updateCharge(schoolId: string, chargeId: string, data: {
    paidAmount?: number; status?: string; notes?: string; paidAt?: string;
    schoolFee?: number; busFee?: number; activityFees?: number; subsidyTotal?: number; totalDue?: number;
  }) {
    const charge = await this.prisma.monthlyCharge.findFirst({ where: { id: chargeId, schoolId } });
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.status === 'paid' && data.paidAmount === undefined && data.status !== 'unpaid') {
      return charge;
    }

    const nextTotal = data.totalDue !== undefined ? Number(data.totalDue) : Number(charge.totalDue);
    const nextPaid = data.paidAmount !== undefined ? Number(data.paidAmount) : Number(charge.paidAmount);
    let status = data.status;
    if (status === undefined && (data.paidAmount !== undefined || data.totalDue !== undefined)) {
      if (nextPaid <= 0) status = nextTotal <= 0 ? 'paid' : 'unpaid';
      else if (nextPaid + 0.009 >= nextTotal) status = 'paid';
      else status = 'partial';
    }

    return this.prisma.monthlyCharge.update({
      where: { id: chargeId },
      data: {
        ...data,
        status,
        paidAt: data.paidAt ? new Date(data.paidAt) : (status === 'paid' ? new Date() : undefined),
      },
    });
  }

  async deleteCharge(schoolId: string, chargeId: string) {
    const charge = await this.prisma.monthlyCharge.findFirst({ where: { id: chargeId, schoolId } });
    if (!charge) throw new NotFoundException('Charge not found');
    return this.prisma.monthlyCharge.delete({ where: { id: chargeId } });
  }

  // ── One-time charges ─────────────────────────────────────

  async getOneTimeCharges(schoolId: string, params?: { studentId?: string; status?: string }) {
    return this.prisma.oneTimeCharge.findMany({
      where: {
        schoolId,
        ...(params?.studentId ? { studentId: params.studentId } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { chargeDate: 'desc' },
    });
  }

  async createOneTimeCharge(schoolId: string, data: {
    studentId: string; description: string; amount: number;
    chargeDate: string; notes?: string;
  }) {
    return this.prisma.oneTimeCharge.create({
      data: {
        schoolId,
        studentId: data.studentId,
        description: data.description,
        amount: data.amount,
        chargeDate: new Date(data.chargeDate),
        notes: data.notes,
      },
      include: { student: { select: { id: true, fullName: true } } },
    });
  }

  async updateOneTimeCharge(schoolId: string, chargeId: string, data: {
    paidAmount?: number; status?: string; notes?: string; description?: string; amount?: number;
  }) {
    const charge = await this.prisma.oneTimeCharge.findFirst({ where: { id: chargeId, schoolId } });
    if (!charge) throw new NotFoundException('Charge not found');

    let status = data.status;
    if (data.paidAmount !== undefined && status === undefined) {
      if (data.paidAmount <= 0) status = 'unpaid';
      else if (data.paidAmount >= Number(charge.amount)) status = 'paid';
      else status = 'partial';
    }

    return this.prisma.oneTimeCharge.update({
      where: { id: chargeId },
      data: {
        ...data,
        status,
        paidAt: status === 'paid' ? new Date() : (data.status === 'unpaid' ? null : undefined),
      },
    });
  }

  async deleteOneTimeCharge(schoolId: string, chargeId: string) {
    const charge = await this.prisma.oneTimeCharge.findFirst({ where: { id: chargeId, schoolId } });
    if (!charge) throw new NotFoundException('Charge not found');
    return this.prisma.oneTimeCharge.delete({ where: { id: chargeId } });
  }

  async generateStudentCharge(schoolId: string, studentId: string, month: number, year: number) {
    const student = await this.loadBillingStudent(schoolId, studentId);
    if (!student) throw new NotFoundException('Student not found');

    const existing = await this.prisma.monthlyCharge.findFirst({ where: { studentId, month, year } });
    if (existing && existing.status === 'paid') return existing;

    const quote = this.quoteLoadedStudent(student, month, year);
    if (!existing && quote.totalDue <= 0 && quote.lines.length === 0) return null;
    const paidAmount = Number(existing?.paidAmount ?? 0);
    const status = quote.totalDue <= paidAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    return this.prisma.monthlyCharge.upsert({
      where: { studentId_month_year: { studentId, month, year } },
      create: {
        schoolId, studentId, month, year,
        schoolFee: quote.schoolFee,
        busFee: quote.busFee,
        activityFees: quote.activityFees,
        subsidyTotal: quote.subsidyTotal,
        totalDue: quote.totalDue,
        paidAmount: 0,
        status: quote.totalDue <= 0 ? 'paid' : 'unpaid',
      },
      update: {
        schoolFee: quote.schoolFee,
        busFee: quote.busFee,
        activityFees: quote.activityFees,
        subsidyTotal: quote.subsidyTotal,
        totalDue: quote.totalDue,
        status,
        paidAt: status === 'paid' ? existing?.paidAt ?? new Date() : null,
      },
    });
  }

  async ensureStudentLedger(schoolId: string, studentId: string, now = new Date()) {
    const year = schoolYearBounds(now);
    for (const slot of year.months) {
      if (!isOpenMonth(slot.month, slot.year, now)) continue;
      await this.generateStudentCharge(schoolId, studentId, slot.month, slot.year);
    }
    await this.ensureStationeryCharge(schoolId, studentId, year.startYear);
  }

  async getStudentStatement(schoolId: string, studentId: string, now = new Date()) {
    await this.ensureStudentLedger(schoolId, studentId, now);
    const student = await this.loadBillingStudent(schoolId, studentId);
    if (!student) throw new NotFoundException('Student not found');

    const year = schoolYearBounds(now);
    const [charges, oneTime] = await Promise.all([
      this.prisma.monthlyCharge.findMany({ where: { schoolId, studentId } }),
      this.prisma.oneTimeCharge.findMany({ where: { schoolId, studentId }, orderBy: { chargeDate: 'asc' } }),
    ]);

    const stationery = oneTime.find((charge) => this.isStationery(charge.description, charge.chargeDate, year.startYear)) ?? null;

    const months = year.months.map(({ month, year: chargeYear }) => {
      const charge = charges.find((row) => row.month === month && row.year === chargeYear);
      const open = isOpenMonth(month, chargeYear, now);
      const quote = this.quoteLoadedStudent(student, month, chargeYear);
      const useStored = charge && charge.status === 'paid';
      const lines = useStored
        ? [
            ...(Number(charge.schoolFee) > 0 ? [{ label: 'Φοίτηση', amount: Number(charge.schoolFee) }] : []),
            ...(Number(charge.busFee) > 0 ? [{ label: 'Σχολικό', amount: Number(charge.busFee) }] : []),
            ...(Number(charge.activityFees) > 0 ? [{ label: 'Δραστηριότητες', amount: Number(charge.activityFees) }] : []),
            ...(Number(charge.subsidyTotal) > 0 ? [{ label: 'Voucher / επιδότηση', amount: -Number(charge.subsidyTotal) }] : []),
          ]
        : quote.lines;
      const extras = [
        ...oneTime
          .filter((item) => this.chargeInMonth(item.chargeDate, month, chargeYear) && item.id !== stationery?.id)
          .map((item) => ({
            id: item.id,
            kind: 'once' as const,
            title: item.description,
            amount: Number(item.amount),
            status: item.status,
          })),
        ...student.eventEnrollments
          .filter((enrollment) => enrollment.event?.eventDate && this.chargeInMonth(enrollment.event.eventDate, month, chargeYear) && Number(enrollment.event.costPerChild ?? 0) > 0)
          .map((enrollment) => ({
            id: enrollment.id,
            kind: 'event' as const,
            title: enrollment.event.title,
            amount: Number(enrollment.event.costPerChild),
            status: enrollment.status === 'paid' ? 'paid' : enrollment.status === 'pending_payment' ? 'unpaid' : enrollment.status,
            eventId: enrollment.eventId,
          })),
      ];
      if (stationery && this.chargeInMonth(stationery.chargeDate, month, chargeYear)) {
        extras.unshift({
          id: stationery.id,
          kind: 'once' as const,
          title: stationery.description,
          amount: Number(stationery.amount),
          status: stationery.status,
        });
      }
      return {
        month,
        year: chargeYear,
        chargeId: charge?.id ?? null,
        status: charge ? charge.status : open ? 'unpaid' : 'upcoming',
        totalDue: useStored ? Number(charge.totalDue) : quote.totalDue,
        paidAmount: charge ? Number(charge.paidAmount) : 0,
        lines,
        extras,
      };
    });

    const pendingMonths = months
      .filter((month) => month.status === 'unpaid' || month.status === 'partial')
      .reduce((sum, month) => sum + Math.max(0, month.totalDue - month.paidAmount), 0);
    const pendingExtras = months
      .flatMap((month) => month.extras)
      .filter((extra) => extra.status === 'unpaid' || extra.status === 'partial' || extra.status === 'pending_payment')
      .reduce((sum, extra) => sum + Number(extra.amount), 0);

    const current = months.find((month) => month.month === now.getUTCMonth() + 1 && month.year === now.getUTCFullYear()) ?? null;

    return {
      schoolYear: year.label,
      pendingNow: Math.round((pendingMonths + pendingExtras) * 100) / 100,
      current,
      stationery: stationery
        ? {
            id: stationery.id,
            description: stationery.description,
            amount: Number(stationery.amount),
            status: stationery.status,
            paidAmount: Number(stationery.paidAmount),
          }
        : null,
      months,
    };
  }

  private async ensureStationeryCharge(schoolId: string, studentId: string, startYear: number) {
    const student = await this.loadBillingStudent(schoolId, studentId);
    const fee = student?.enrollments[0]?.class?.level?.levelFees?.[0];
    const annual = fee?.annualFee != null ? Number(fee.annualFee) : 0;
    if (!annual || annual <= 0) return null;

    const from = new Date(Date.UTC(startYear, 8, 1));
    const to = new Date(Date.UTC(startYear + 1, 7, 31));
    const existing = await this.prisma.oneTimeCharge.findFirst({
      where: { schoolId, studentId, chargeDate: { gte: from, lte: to } },
    });
    const match = existing && this.isStationery(existing.description, existing.chargeDate, startYear)
      ? existing
      : await this.prisma.oneTimeCharge.findFirst({
          where: {
            schoolId,
            studentId,
            chargeDate: { gte: from, lte: to },
            OR: [
              { description: { contains: 'γραφικ', mode: 'insensitive' } },
              { description: 'Ετήσια Εγγραφή' },
            ],
          },
        });
    if (match) return match;

    return this.prisma.oneTimeCharge.create({
      data: {
        schoolId,
        studentId,
        description: 'Γραφική ύλη',
        amount: annual,
        chargeDate: from,
        notes: `Έναρξη σχολικής χρονιάς ${startYear}-${startYear + 1}`,
      },
    });
  }

  private isStationery(description: string, chargeDate: Date, startYear: number) {
    const text = description.toLowerCase();
    const inYear = this.chargeInMonth(chargeDate, 9, startYear) || (chargeDate >= new Date(Date.UTC(startYear, 8, 1)) && chargeDate <= new Date(Date.UTC(startYear + 1, 7, 31)));
    return inYear && (text.includes('γραφικ') || description === 'Ετήσια Εγγραφή');
  }

  private chargeInMonth(value: Date, month: number, year: number) {
    const date = new Date(value);
    return date.getUTCMonth() + 1 === month && date.getUTCFullYear() === year;
  }

  private quoteLoadedStudent(student: {
    enrollments: { class: { level: { name: string; levelFees: { monthlyFee: unknown; annualFee?: unknown }[] } | null } }[];
    studentServices: { isActive: boolean; enrolledAt: Date; serviceMode?: string | null; discountAmount?: unknown; service: { name?: string; serviceType: string; monthlyCost?: unknown; pickupCost?: unknown; dropoffCost?: unknown } }[];
    activityRegistrations: { activity: { title?: string; monthlyCost?: unknown; startsOn?: Date | null; endsOn?: Date | null } }[];
    feeOverride: { fixedAmount?: unknown; discountPct?: unknown } | null;
    subsidies: { name: string; monthlyAmount: unknown; isActive: boolean; startsFrom?: Date | null; endsAt?: Date | null }[];
  }, month: number, year: number) {
    const level = student.enrollments[0]?.class?.level;
    const fee = level?.levelFees?.[0];
    return quoteStudentMonth({
      month,
      year,
      levelName: level?.name,
      levelMonthly: fee ? Number(fee.monthlyFee) : 0,
      fixedAmount: student.feeOverride?.fixedAmount != null ? Number(student.feeOverride.fixedAmount) : null,
      discountPct: student.feeOverride?.fixedAmount == null && student.feeOverride?.discountPct != null
        ? Number(student.feeOverride.discountPct)
        : null,
      buses: student.studentServices
        .filter((service) => service.service.serviceType === 'bus')
        .map((service) => ({
          name: service.service.name || 'Σχολικό',
          net: this.busNet(service),
          enrolledAt: service.enrolledAt,
          isActive: service.isActive,
        })),
      activities: student.activityRegistrations.map((registration) => ({
        title: registration.activity.title || 'Δραστηριότητα',
        monthlyCost: Number(registration.activity.monthlyCost ?? 0),
        startsOn: registration.activity.startsOn,
        endsOn: registration.activity.endsOn,
      })),
      subsidies: student.subsidies.map((subsidy) => ({
        name: subsidy.name,
        monthlyAmount: Number(subsidy.monthlyAmount),
        isActive: subsidy.isActive,
        startsFrom: subsidy.startsFrom,
        endsAt: subsidy.endsAt,
      })),
    });
  }

  private loadBillingStudent(schoolId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, schoolId, isActive: true },
      include: {
        enrollments: {
          where: { academicYear: { isCurrent: true } },
          include: { class: { include: { level: { include: { levelFees: { orderBy: { academicYear: 'desc' } } } } } } },
          take: 1,
        },
        studentServices: {
          include: { service: { select: { name: true, serviceType: true, monthlyCost: true, pickupCost: true, dropoffCost: true } } },
        },
        activityRegistrations: {
          where: { status: { in: ['approved', 'pending'] } },
          include: { activity: { select: { title: true, monthlyCost: true, startsOn: true, endsOn: true } } },
        },
        feeOverride: true,
        subsidies: true,
        eventEnrollments: {
          include: { event: { select: { id: true, title: true, eventType: true, eventDate: true, costPerChild: true, status: true } } },
        },
      },
    });
  }

  async generateAnnualCharges(schoolId: string, year: number) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, isActive: true },
      include: {
        enrollments: {
          where: { academicYear: { isCurrent: true } },
          include: { class: { include: { level: { include: { levelFees: { orderBy: { academicYear: 'desc' } } } } } } },
          take: 1,
        },
      },
    });

    const results = [];
    for (const student of students) {
      const enrollment = student.enrollments[0];
      if (!enrollment) continue;
      const fee = enrollment.class.level.levelFees[0];
      if (!fee || !fee.annualFee) continue;

      const existing = await this.prisma.oneTimeCharge.findFirst({
        where: { studentId: student.id, description: 'Ετήσια Εγγραφή', chargeDate: { gte: new Date(`${year}-09-01`), lte: new Date(`${year}-09-30`) } },
      });
      if (existing) { results.push(existing); continue; }

      const charge = await this.prisma.oneTimeCharge.create({
        data: {
          schoolId, studentId: student.id,
          description: 'Ετήσια Εγγραφή',
          amount: fee.annualFee,
          chargeDate: new Date(`${year}-09-01`),
        },
      });
      results.push(charge);
    }
    return { generated: results.length, year };
  }

  // ── Legacy invoice methods (kept for compatibility) ──────

  async getInvoices(schoolId: string, filters?: { parentId?: string; status?: string }) {
    return this.prisma.invoice.findMany({
      where: { schoolId, ...filters },
      include: {
        student: { select: { id: true, fullName: true } },
        parent: { select: { id: true, fullName: true, email: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyInvoices(parentId: string, schoolId: string) {
    return this.prisma.invoice.findMany({
      where: { schoolId, parentId },
      include: {
        student: { select: { id: true, fullName: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvoice(schoolId: string, data: {
    studentId: string;
    parentId: string;
    amount: number;
    description?: string;
    dueDate?: string;
    currency?: string;
  }) {
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return this.prisma.invoice.create({
      data: {
        schoolId,
        invoiceNumber,
        studentId: data.studentId,
        parentId: data.parentId,
        amount: data.amount,
        currency: data.currency ?? 'EUR',
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async getStats(schoolId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // School year months: Sep(9)–Dec of startYear + Jan(1)–Jun(6) of startYear+1
    const syStartYear = month >= 9 ? year : year - 1;
    const syMonths: { month: number; year: number }[] = [
      { month: 9, year: syStartYear }, { month: 10, year: syStartYear },
      { month: 11, year: syStartYear }, { month: 12, year: syStartYear },
      { month: 1, year: syStartYear + 1 }, { month: 2, year: syStartYear + 1 },
      { month: 3, year: syStartYear + 1 }, { month: 4, year: syStartYear + 1 },
      { month: 5, year: syStartYear + 1 }, { month: 6, year: syStartYear + 1 },
    ];
    const syWhere = {
      schoolId,
      OR: syMonths.map(({ month: m, year: y }) => ({ month: m, year: y })),
    };

    const [total, paid, unpaid, partial, totals, syTotals, syByType, studentsOwingThisMonth] = await Promise.all([
      this.prisma.monthlyCharge.count({ where: { schoolId, month, year } }),
      this.prisma.monthlyCharge.count({ where: { schoolId, month, year, status: 'paid' } }),
      this.prisma.monthlyCharge.count({ where: { schoolId, month, year, status: 'unpaid' } }),
      this.prisma.monthlyCharge.count({ where: { schoolId, month, year, status: 'partial' } }),
      this.prisma.monthlyCharge.aggregate({
        where: { schoolId, month, year },
        _sum: { totalDue: true, paidAmount: true, subsidyTotal: true },
      }),
      this.prisma.monthlyCharge.aggregate({
        where: syWhere,
        _sum: { totalDue: true, paidAmount: true, schoolFee: true, busFee: true, activityFees: true, subsidyTotal: true },
      }),
      this.prisma.monthlyCharge.groupBy({
        by: ['month', 'year'],
        where: syWhere,
        _sum: { totalDue: true, paidAmount: true },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      this.prisma.monthlyCharge.count({
        where: { schoolId, month, year, status: { in: ['unpaid', 'partial'] } },
      }),
    ]);

    return {
      total, paid, unpaid, partial, month, year,
      totalDue: Number(totals._sum.totalDue ?? 0),
      totalPaid: Number(totals._sum.paidAmount ?? 0),
      totalSubsidies: Number(totals._sum.subsidyTotal ?? 0),
      studentsOwingThisMonth,
      schoolYear: `${syStartYear}-${syStartYear + 1}`,
      sy: {
        totalDue: Number(syTotals._sum.totalDue ?? 0),
        totalPaid: Number(syTotals._sum.paidAmount ?? 0),
        schoolFees: Number(syTotals._sum.schoolFee ?? 0),
        busFees: Number(syTotals._sum.busFee ?? 0),
        activityFees: Number(syTotals._sum.activityFees ?? 0),
        subsidies: Number(syTotals._sum.subsidyTotal ?? 0),
        byMonth: syByType.map(r => ({
          month: r.month, year: r.year,
          totalDue: Number(r._sum.totalDue ?? 0),
          totalPaid: Number(r._sum.paidAmount ?? 0),
        })),
      },
    };
  }
}
