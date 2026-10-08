import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { feeRuleForMonth, isOpenMonth, quoteStudentMonth, schoolYearBounds, subsidyRevision } from './billing-quote';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentsService } from '../students/students.service';

const monthNames = ['', 'Ιανουάριο', 'Φεβρουάριο', 'Μάρτιο', 'Απρίλιο', 'Μάιο', 'Ιούνιο', 'Ιούλιο', 'Αύγουστο', 'Σεπτέμβριο', 'Οκτώβριο', 'Νοέμβριο', 'Δεκέμβριο'];

@Injectable()
export class BillingService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private students: StudentsService,
  ) {}

  async onModuleInit() {
    await this.ensureFeeHistory();
  }

  private async ensureFeeHistory() {
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "student_fee_overrides" DROP CONSTRAINT IF EXISTS "student_fee_overrides_student_id_key"`);
    await this.prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "student_fee_overrides_student_id_key"`);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "student_fee_overrides" ADD COLUMN IF NOT EXISTS "effective_from" DATE`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "student_fee_overrides_student_id_effective_from_idx" ON "student_fee_overrides" ("student_id", "effective_from")`);
  }

  private athensMonthStart(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Athens',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  private monthStart(value: Date | string) {
    const date = new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private async tellParents(schoolId: string, studentId: string, body: string) {
    await this.notifications.notifyStudentParents(schoolId, studentId, {
      event: 'payment_overdue',
      type: 'payment',
      title: 'Εκκρεμεί πληρωμή',
      body,
      data: { screen: 'payments', studentId },
    });
  }

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
    const rows = await this.prisma.studentFeeOverride.findMany({
      where: { schoolId, studentId },
      orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
    });
    if (!rows.length) return null;
    const mapped = rows.map((row) => ({
      id: row.id,
      discountPct: row.discountPct != null ? Number(row.discountPct) : null,
      fixedAmount: row.fixedAmount != null ? Number(row.fixedAmount) : null,
      reason: row.reason,
      effectiveFrom: row.effectiveFrom,
      createdAt: row.createdAt,
    }));
    const now = this.athensMonthStart();
    const current = feeRuleForMonth(mapped, now.getUTCMonth() + 1, now.getUTCFullYear());
    return {
      discountPct: current?.discountPct != null ? Number(current.discountPct) : null,
      fixedAmount: current?.fixedAmount != null ? Number(current.fixedAmount) : null,
      reason: current?.reason ?? null,
      effectiveFrom: current?.effectiveFrom ?? null,
      rows: mapped,
    };
  }

  async upsertStudentFeeOverride(schoolId: string, studentId: string, data: {
    discountPct?: number | null;
    fixedAmount?: number | null;
    reason?: string | null;
    effectiveFrom?: string;
  }) {
    await this.ensureFeeHistory();
    const effectiveFrom = this.monthStart(data.effectiveFrom ? new Date(data.effectiveFrom) : this.athensMonthStart());
    const discountPct = data.discountPct == null || Number.isNaN(Number(data.discountPct)) ? null : Number(data.discountPct);
    const fixedAmount = data.fixedAmount == null || Number.isNaN(Number(data.fixedAmount)) ? null : Number(data.fixedAmount);
    const reason = data.reason?.trim() ? data.reason.trim() : null;
    const rows = await this.prisma.studentFeeOverride.findMany({ where: { schoolId, studentId } });
    const same = rows.find((row) => row.effectiveFrom && this.monthStart(row.effectiveFrom).getTime() === effectiveFrom.getTime());
    const saved = same
      ? await this.prisma.studentFeeOverride.update({
          where: { id: same.id },
          data: { discountPct, fixedAmount, reason, effectiveFrom },
        })
      : await this.prisma.studentFeeOverride.create({
          data: { schoolId, studentId, discountPct, fixedAmount, reason, effectiveFrom },
        });
    await this.ensureStudentLedger(schoolId, studentId);
    return saved;
  }

  async deleteStudentFeeOverride(schoolId: string, studentId: string) {
    const override = await this.prisma.studentFeeOverride.findFirst({ where: { schoolId, studentId } });
    if (!override) throw new NotFoundException('Fee override not found');
    return this.upsertStudentFeeOverride(schoolId, studentId, {
      discountPct: null,
      fixedAmount: null,
      reason: null,
    });
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
    startsFrom?: string; endsAt?: string; notes?: string; isActive?: boolean;
  }) {
    const created = await this.prisma.studentSubsidy.create({
      data: {
        schoolId, studentId,
        name: data.name,
        subsidyType: data.subsidyType || 'voucher',
        monthlyAmount: Number(data.monthlyAmount),
        isActive: data.isActive !== false,
        startsFrom: this.monthStart(data.startsFrom ? new Date(data.startsFrom) : this.athensMonthStart()),
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        notes: data.notes?.trim() || null,
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
    const requested = this.monthStart(data.startsFrom ? new Date(data.startsFrom) : this.athensMonthStart());
    const fields = {
      name: data.name?.trim() || sub.name,
      subsidyType: data.subsidyType || sub.subsidyType,
      monthlyAmount: data.monthlyAmount != null && !Number.isNaN(Number(data.monthlyAmount))
        ? Number(data.monthlyAmount)
        : Number(sub.monthlyAmount),
      isActive: data.isActive ?? sub.isActive,
      notes: data.notes !== undefined ? (data.notes?.trim() || null) : sub.notes,
    };
    const updated = subsidyRevision(sub.startsFrom, requested) === 'update'
      ? await this.prisma.studentSubsidy.update({
          where: { id: subsidyId },
          data: {
            ...fields,
            startsFrom: requested,
            endsAt: data.endsAt ? new Date(data.endsAt) : sub.endsAt,
          },
        })
      : await this.splitSubsidy(sub, requested, fields, data.endsAt);
    await this.ensureStudentLedger(schoolId, sub.studentId);
    return updated;
  }

  private async splitSubsidy(
    sub: { id: string; schoolId: string; studentId: string; endsAt: Date | null },
    requested: Date,
    fields: { name: string; subsidyType: string; monthlyAmount: number; isActive: boolean; notes: string | null },
    endsAt?: string,
  ) {
    const end = new Date(requested.getTime() - 24 * 60 * 60 * 1000);
    if (!sub.endsAt || sub.endsAt >= requested) {
      await this.prisma.studentSubsidy.update({ where: { id: sub.id }, data: { endsAt: end } });
    }
    return this.prisma.studentSubsidy.create({
      data: {
        schoolId: sub.schoolId,
        studentId: sub.studentId,
        ...fields,
        startsFrom: requested,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });
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
            parents: {
              select: { userId: true, isPrimary: true, user: { select: { fullName: true } } },
            },
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
    await this.students.ensureParentChildren(parentUserId, schoolId);
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
        feeOverrides: true,
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
      const isNew = !existing;

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
      if (isNew && Number(totalDue) > 0) {
        await this.tellParents(
          schoolId,
          student.id,
          `${student.fullName}: ${monthNames[month] ?? month} ${year} · ${Number(totalDue).toFixed(2)} €`,
        );
      }
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
    const created = await this.prisma.oneTimeCharge.create({
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
    if (Number(data.amount) > 0) {
      await this.tellParents(schoolId, data.studentId, `${created.student.fullName}: ${data.description} · ${Number(data.amount).toFixed(2)} €`);
    }
    return created;
  }

  async updateOneTimeCharge(schoolId: string, chargeId: string, data: {
    paidAmount?: number; status?: string; notes?: string; description?: string; amount?: number; paidAt?: string;
  }) {
    const charge = await this.prisma.oneTimeCharge.findFirst({ where: { id: chargeId, schoolId } });
    if (!charge) throw new NotFoundException('Charge not found');

    let status = data.status;
    if (data.paidAmount !== undefined && status === undefined) {
      if (data.paidAmount <= 0) status = 'unpaid';
      else if (data.paidAmount >= Number(charge.amount)) status = 'paid';
      else status = 'partial';
    }

    const paidAt = status === 'unpaid' || (data.paidAmount !== undefined && data.paidAmount <= 0)
      ? null
      : data.paidAt
        ? new Date(data.paidAt)
        : (status === 'paid' || status === 'partial' ? new Date() : undefined);

    return this.prisma.oneTimeCharge.update({
      where: { id: chargeId },
      data: {
        ...data,
        status,
        paidAt,
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
            notes: item.notes,
            paidAt: item.paidAt,
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
            notes: enrollment.notes,
            paidAt: enrollment.paidAt,
          })),
      ];
      if (stationery && this.chargeInMonth(stationery.chargeDate, month, chargeYear)) {
        extras.unshift({
          id: stationery.id,
          kind: 'once' as const,
          title: stationery.description,
          amount: Number(stationery.amount),
          status: stationery.status,
          notes: stationery.notes,
          paidAt: stationery.paidAt,
        });
      }
      return {
        month,
        year: chargeYear,
        chargeId: charge?.id ?? null,
        status: charge ? charge.status : open ? 'unpaid' : 'upcoming',
        totalDue: useStored ? Number(charge.totalDue) : quote.totalDue,
        paidAmount: charge ? Number(charge.paidAmount) : 0,
        notes: charge?.notes ?? null,
        paidAt: charge?.paidAt ?? null,
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
            notes: stationery.notes,
            paidAt: stationery.paidAt,
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

    const created = await this.prisma.oneTimeCharge.create({
      data: {
        schoolId,
        studentId,
        description: 'Γραφική ύλη',
        amount: annual,
        chargeDate: from,
        notes: `Έναρξη σχολικής χρονιάς ${startYear}-${startYear + 1}`,
      },
    });
    await this.tellParents(schoolId, studentId, `Γραφική ύλη · ${annual.toFixed(2)} €`);
    return created;
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
    feeOverrides: { fixedAmount?: unknown; discountPct?: unknown; effectiveFrom?: Date | null }[];
    subsidies: { name: string; monthlyAmount: unknown; isActive: boolean; startsFrom?: Date | null; endsAt?: Date | null }[];
  }, month: number, year: number) {
    const level = student.enrollments[0]?.class?.level;
    const fee = level?.levelFees?.[0];
    return quoteStudentMonth({
      month,
      year,
      levelName: level?.name,
      levelMonthly: fee ? Number(fee.monthlyFee) : 0,
      feeRules: (student.feeOverrides ?? []).map((row) => ({
        fixedAmount: row.fixedAmount != null ? Number(row.fixedAmount) : null,
        discountPct: row.discountPct != null ? Number(row.discountPct) : null,
        effectiveFrom: row.effectiveFrom,
      })),
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
        feeOverrides: true,
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
      await this.tellParents(schoolId, student.id, `${student.fullName}: Ετήσια εγγραφή · ${Number(fee.annualFee).toFixed(2)} €`);
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

    const syMonths = schoolYearBounds(now).months;
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
      schoolYear: schoolYearBounds(now).label,
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
