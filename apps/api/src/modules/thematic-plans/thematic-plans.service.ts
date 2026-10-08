import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';

const MONTH = /^\d{4}-\d{2}$/;
const MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

type PlanInput = {
  classId: string;
  month: string;
  throughMonth?: string | null;
  title?: string;
  greeting?: string;
  introduction?: string;
  goals?: string;
  extras?: string;
  closing?: string;
  signature?: string;
};

@Injectable()
export class ThematicPlansService implements OnModuleInit {
  private readonly logger = new Logger(ThematicPlansService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "thematic_plans" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "class_id" TEXT NOT NULL,
        "month" TEXT NOT NULL,
        "through_month" TEXT,
        "title" TEXT NOT NULL,
        "greeting" TEXT NOT NULL DEFAULT 'Αγαπημένοι μας γονείς,',
        "introduction" TEXT NOT NULL,
        "goals" TEXT NOT NULL,
        "extras" TEXT NOT NULL,
        "closing" TEXT NOT NULL,
        "signature" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "thematic_plans_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "thematic_plans_school_id_class_id_month_key" ON "thematic_plans"("school_id", "class_id", "month")`,
      `CREATE INDEX IF NOT EXISTS "thematic_plans_school_id_month_idx" ON "thematic_plans"("school_id", "month")`,
    ];
    for (const sql of statements) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/already exists|duplicate/i.test(message)) {
          this.logger.warn(`Thematic table check skipped: ${message}`);
        }
      }
    }
  }

  async findAll(schoolId: string, user: JwtPayload, month?: string, classId?: string) {
    await this.ensureTable();
    const allowed = await this.allowedClassIds(schoolId, user);
    if (classId && allowed && !allowed.includes(classId)) {
      throw new ForbiddenException('Δεν έχεις πρόσβαση σε αυτή την τάξη.');
    }
    try {
      return await this.prisma.thematicPlan.findMany({
        where: {
          schoolId,
          ...(classId ? { classId } : allowed ? { classId: { in: allowed } } : {}),
          ...(month
            ? {
                OR: [
                  { month },
                  { month: { lte: month }, throughMonth: { gte: month } },
                ],
              }
            : {}),
        },
        include: { class: { select: { id: true, name: true } } },
        orderBy: [{ month: 'desc' }, { class: { name: 'asc' } }],
      });
    } catch (err: any) {
      if (err?.code === 'P2021' || err?.code === 'P2022') return [];
      throw err;
    }
  }

  async upsert(schoolId: string, user: JwtPayload, data: PlanInput) {
    await this.ensureTable();
    this.assertMonth(data.month, 'month');
    if (data.throughMonth) this.assertMonth(data.throughMonth, 'throughMonth');
    if (data.throughMonth && data.throughMonth < data.month) {
      throw new BadRequestException('Ο μήνας λήξης είναι πριν από τον μήνα έναρξης.');
    }
    if (!data.classId) throw new BadRequestException('Διάλεξε τάξη.');
    await this.assertCanEdit(schoolId, user, data.classId);
    const classRow = await this.prisma.class.findFirst({ where: { id: data.classId, schoolId } });
    if (!classRow) throw new NotFoundException('Η τάξη δεν βρέθηκε.');

    const fields = {
      throughMonth: data.throughMonth || null,
      title: data.title?.trim() || 'Διαθεματικό',
      greeting: data.greeting?.trim() || 'Αγαπημένοι μας γονείς,',
      introduction: data.introduction ?? '',
      goals: data.goals ?? '',
      extras: data.extras ?? '',
      closing: data.closing ?? '',
      signature: data.signature ?? '',
    };

    const existing = await this.prisma.thematicPlan.findUnique({
      where: { schoolId_classId_month: { schoolId, classId: data.classId, month: data.month } },
    });

    const saved = await this.prisma.thematicPlan.upsert({
      where: { schoolId_classId_month: { schoolId, classId: data.classId, month: data.month } },
      create: { schoolId, classId: data.classId, month: data.month, ...fields },
      update: fields,
      include: { class: { select: { id: true, name: true } } },
    });

    const changed = !existing || (
      existing.title !== fields.title
      || existing.throughMonth !== fields.throughMonth
      || existing.greeting !== fields.greeting
      || existing.introduction !== fields.introduction
      || existing.goals !== fields.goals
      || existing.extras !== fields.extras
      || existing.closing !== fields.closing
      || existing.signature !== fields.signature
    );
    if (changed) await this.notifyParents(schoolId, classRow.id, classRow.name, saved.month, saved.throughMonth, saved.title);
    return saved;
  }

  async remove(id: string, schoolId: string, user: JwtPayload) {
    const plan = await this.prisma.thematicPlan.findFirst({ where: { id, schoolId } });
    if (!plan) throw new NotFoundException('Το διαθεματικό δεν βρέθηκε.');
    await this.assertCanEdit(schoolId, user, plan.classId);
    return this.prisma.thematicPlan.delete({ where: { id } });
  }

  private async notifyParents(schoolId: string, classId: string, className: string, month: string, throughMonth: string | null, title: string) {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId, student: { schoolId, isActive: true } },
      select: { studentId: true },
    });
    const studentIds = [...new Set(enrollments.map((row) => row.studentId))];
    if (!studentIds.length) return;
    const parents = await this.prisma.studentParent.findMany({
      where: { studentId: { in: studentIds } },
      select: { userId: true },
    });
    const period = throughMonth && throughMonth !== month
      ? `${this.monthName(month)} – ${this.monthName(throughMonth)}`
      : this.monthName(month);
    await this.notifications.notifyUsers(schoolId, parents.map((row) => row.userId), {
      event: 'thematic_plan',
      type: 'thematic',
      title: 'Νέο διαθεματικό',
      body: `${className}: ${title} (${period}).`,
      data: {
        screen: 'thematic',
        classId,
        className,
        month,
        throughMonth: throughMonth ?? '',
      },
    });
  }

  private async assertCanEdit(schoolId: string, user: JwtPayload, classId: string) {
    if (user.isSuperAdmin || user.role === 'school_admin' || user.role === 'owner') return;
    if (user.role !== 'teacher') throw new ForbiddenException('Μόνο ο εκπαιδευτικός ή ο διαχειριστής αποθηκεύει διαθεματικό.');
    const link = await this.prisma.classTeacher.findFirst({
      where: { classId, userId: user.sub, class: { schoolId } },
    });
    if (!link) throw new ForbiddenException('Μπορείς να αποθηκεύσεις διαθεματικό μόνο για τις τάξεις σου.');
  }

  private async allowedClassIds(schoolId: string, user: JwtPayload) {
    if (user.isSuperAdmin || user.role === 'school_admin' || user.role === 'owner') return null;
    if (user.role === 'teacher') {
      const rows = await this.prisma.classTeacher.findMany({
        where: { userId: user.sub, class: { schoolId } },
        select: { classId: true },
      });
      return rows.map((row) => row.classId);
    }
    const rows = await this.prisma.classEnrollment.findMany({
      where: { class: { schoolId }, student: { parents: { some: { userId: user.sub } }, isActive: true } },
      select: { classId: true },
    });
    return [...new Set(rows.map((row) => row.classId))];
  }

  private assertMonth(value: string, field: string) {
    if (!MONTH.test(value || '')) throw new BadRequestException(`Ο μήνας (${field}) πρέπει να είναι yyyy-MM.`);
  }

  private monthName(ym: string) {
    const month = Number(ym.slice(5, 7));
    const year = ym.slice(0, 4);
    return `${MONTHS[month - 1] ?? ym} ${year}`;
  }
}
