import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSchoolDto } from './dto/create-school.dto';

@Injectable()
export class SchoolsService implements OnModuleInit {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async onModuleInit() {
    await this.ensureRegulationSchema();
    await this.ensureAbsenceTable();
  }

  private async ensureRegulationSchema() {
    const statements = [
      `ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3)`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "operating_regulation" TEXT`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "financial_regulation" TEXT`,
      `CREATE TABLE IF NOT EXISTS "school_regulations" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "academic_year" TEXT NOT NULL,
        "operating_text" TEXT,
        "financial_text" TEXT,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "school_regulations_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "school_regulations_school_id_academic_year_key" ON "school_regulations"("school_id", "academic_year")`,
      `CREATE INDEX IF NOT EXISTS "school_regulations_school_id_idx" ON "school_regulations"("school_id")`,
    ];
    for (const sql of statements) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (error) {
        const message = String((error as { message?: string })?.message ?? error);
        if (!/already exists|duplicate/i.test(message)) this.logger.warn(`Regulation schema: ${message}`);
      }
    }
  }

  async findAll() {
    return this.prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, students: true } } },
    });
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { _count: { select: { members: true, students: true, classes: true } } },
    });
    if (!school) throw new NotFoundException('School not found');
    try {
      const year = await this.currentYearLabel(id);
      const row = await this.prisma.schoolRegulation.findUnique({
        where: { schoolId_academicYear: { schoolId: id, academicYear: year } },
      });
      if (!row) return school;
      return {
        ...school,
        operatingRegulation: row.operatingText ?? school.operatingRegulation,
        financialRegulation: row.financialText ?? school.financialRegulation,
      };
    } catch {
      return school;
    }
  }

  async findBySlug(slug: string) {
    const school = await this.prisma.school.findUnique({ where: { slug } });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async create(dto: CreateSchoolDto) {
    const slugExists = await this.prisma.school.findUnique({ where: { slug: dto.slug } });
    if (slugExists) throw new ConflictException('Slug already in use');

    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (emailExists) throw new ConflictException('Admin email already registered');

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    return this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          timezone: dto.timezone ?? 'Europe/Athens',
          locale: dto.locale ?? 'el',
        },
      });

      const admin = await tx.user.create({
        data: {
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          fullName: dto.adminFullName,
        },
      });

      await tx.schoolMember.create({
        data: { schoolId: school.id, userId: admin.id, role: 'school_admin' },
      });

      return { school, adminId: admin.id };
    });
  }

  async update(id: string, data: {
    name?: string;
    logoUrl?: string;
    primaryColor?: string;
    subscriptionPlan?: string;
    isActive?: boolean;
    operatingRegulation?: string | null;
    financialRegulation?: string | null;
  }) {
    const allowed = [
      'name', 'logoUrl', 'primaryColor', 'subscriptionPlan', 'isActive',
      'operatingRegulation', 'financialRegulation',
    ] as const;
    const payload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) payload[key] = data[key];
    }
    return this.prisma.school.update({ where: { id }, data: payload });
  }

  async addMember(schoolId: string, userId: string, role: 'school_admin' | 'teacher' | 'parent') {
    return this.prisma.schoolMember.upsert({
      where: { schoolId_userId_role: { schoolId, userId, role } },
      create: { schoolId, userId, role },
      update: { isActive: true },
    });
  }

  async removeMember(schoolId: string, userId: string, role: string) {
    return this.prisma.schoolMember.updateMany({
      where: { schoolId, userId, role: role as any },
      data: { isActive: false },
    });
  }

  async getMembers(schoolId: string, role?: string) {
    return this.prisma.schoolMember.findMany({
      where: { schoolId, ...(role ? { role: role as any } : {}), isActive: true },
      include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true } } },
    });
  }

  // ── Holidays ─────────────────────────────────────────────

  currentYearLabelFrom(now = new Date()) {
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}-${start + 1}`;
  }

  async currentYearLabel(schoolId: string) {
    try {
      const current = await this.prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        orderBy: { startsOn: 'desc' },
      });
      return current?.label || this.currentYearLabelFrom();
    } catch {
      return this.currentYearLabelFrom();
    }
  }

  private async copyLegacyRegulations(schoolId: string) {
    const existing = await this.prisma.schoolRegulation.count({ where: { schoolId } });
    if (existing > 0) return;
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { operatingRegulation: true, financialRegulation: true },
    });
    if (!school?.operatingRegulation && !school?.financialRegulation) return;
    await this.prisma.schoolRegulation.create({
      data: {
        schoolId,
        academicYear: await this.currentYearLabel(schoolId),
        operatingText: school.operatingRegulation,
        financialText: school.financialRegulation,
      },
    });
  }

  async getRegulations(schoolId: string, academicYear?: string) {
    await this.ensureRegulationSchema();
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, operatingRegulation: true, financialRegulation: true },
    });
    if (!school) throw new NotFoundException('School not found');
    await this.copyLegacyRegulations(schoolId);
    const current = await this.currentYearLabel(schoolId);
    const rows = await this.prisma.schoolRegulation.findMany({
      where: { schoolId },
      orderBy: { updatedAt: 'desc' },
    });
    const text = (value?: string | null) => (value?.trim() ? value : null);
    const fromRows = (field: 'operatingText' | 'financialText', year?: string) => {
      if (year) return text(rows.find((row) => row.academicYear === year)?.[field]);
      return text(rows.find((row) => row.academicYear === current)?.[field])
        ?? rows.map((row) => text(row[field])).find((value) => value)
        ?? null;
    };
    const year = (academicYear || '').trim();
    const useSchool = !year || year === current;
    const operating = fromRows('operatingText', year || undefined)
      ?? (useSchool ? text(school.operatingRegulation) : null);
    const financial = fromRows('financialText', year || undefined)
      ?? (useSchool ? text(school.financialRegulation) : null);
    const matchedYear = year
      || rows.find((row) => text(row.operatingText) || text(row.financialText))?.academicYear
      || current;
    return {
      academicYear: matchedYear,
      operatingRegulation: operating,
      financialRegulation: financial,
    };
  }

  async saveRegulations(schoolId: string, data: {
    academicYear: string;
    operatingRegulation?: string | null;
    financialRegulation?: string | null;
  }) {
    await this.ensureRegulationSchema();
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('School not found');
    const academicYear = (data.academicYear || '').trim() || await this.currentYearLabel(schoolId);
    data = { ...data, academicYear };
    await this.copyLegacyRegulations(schoolId);
    const existing = await this.prisma.schoolRegulation.findUnique({
      where: { schoolId_academicYear: { schoolId, academicYear: data.academicYear } },
    });
    const operatingText = data.operatingRegulation !== undefined ? data.operatingRegulation : existing?.operatingText ?? null;
    const financialText = data.financialRegulation !== undefined ? data.financialRegulation : existing?.financialText ?? null;
    const row = await this.prisma.schoolRegulation.upsert({
      where: { schoolId_academicYear: { schoolId, academicYear: data.academicYear } },
      create: { schoolId, academicYear: data.academicYear, operatingText, financialText },
      update: { operatingText, financialText },
    });
    if (data.academicYear === await this.currentYearLabel(schoolId)) {
      try {
        await this.prisma.school.update({
          where: { id: schoolId },
          data: { operatingRegulation: operatingText, financialRegulation: financialText },
        });
      } catch (error) {
        this.logger.warn(`School regulation mirror: ${String((error as { message?: string })?.message ?? error)}`);
      }
    }
    return {
      academicYear: row.academicYear,
      operatingRegulation: row.operatingText,
      financialRegulation: row.financialText,
    };
  }

  async getHolidays(schoolId: string, academicYear?: string) {
    return this.prisma.schoolHoliday.findMany({
      where: { schoolId, ...(academicYear ? { academicYear } : {}) },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(schoolId: string, data: { date: string; name: string; academicYear?: string }) {
    return this.prisma.schoolHoliday.create({
      data: { schoolId, date: new Date(data.date), name: data.name, academicYear: data.academicYear },
    });
  }

  async deleteHoliday(schoolId: string, holidayId: string) {
    const h = await this.prisma.schoolHoliday.findFirst({ where: { id: holidayId, schoolId } });
    if (!h) throw new NotFoundException('Holiday not found');
    return this.prisma.schoolHoliday.delete({ where: { id: holidayId } });
  }

  async listTeacherAbsences(schoolId: string, user: JwtPayload, academicYear?: string) {
    await this.ensureAbsenceTable();
    const rows = await this.prisma.teacherAbsence.findMany({
      where: { schoolId, ...(academicYear ? { academicYear } : {}) },
      include: {
        teacher: { select: { id: true, fullName: true, avatarUrl: true } },
        substitute: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { date: 'asc' },
    });
    if (user.isSuperAdmin || user.role === 'school_admin' || user.role === 'owner' || user.role === 'teacher') return rows;
    const teacherIds = await this.parentTeacherIds(schoolId, user.sub);
    return rows.filter((row) => teacherIds.has(row.teacherUserId));
  }

  async createTeacherAbsence(
    schoolId: string,
    data: {
      teacherUserId?: string;
      date?: string;
      endDate?: string;
      note?: string;
      reason?: string;
      substituteUserId?: string;
      academicYear?: string;
    },
  ) {
    await this.ensureAbsenceTable();
    const teacherUserId = String(data.teacherUserId ?? '').trim();
    const day = String(data.date ?? '').slice(0, 10);
    const end = String(data.endDate ?? '').slice(0, 10) || day;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < day) {
      throw new BadRequestException('Διάλεξε έγκυρες ημερομηνίες.');
    }
    const days = eachAbsenceDay(day, end);
    if (days.length > 62) throw new BadRequestException('Η απουσία δεν μπορεί να ξεπερνά τους δύο μήνες.');
    const member = await this.prisma.schoolMember.findFirst({
      where: { schoolId, userId: teacherUserId, role: 'teacher', isActive: true },
      include: { user: { select: { fullName: true } } },
    });
    if (!member) throw new BadRequestException('Διάλεξε εκπαιδευτικό του σχολείου.');
    const substituteUserId = String(data.substituteUserId ?? '').trim();
    let substituteName = '';
    if (substituteUserId) {
      if (substituteUserId === teacherUserId) throw new BadRequestException('Ο αντικαταστάτης πρέπει να είναι άλλος εκπαιδευτικός.');
      const substitute = await this.prisma.schoolMember.findFirst({
        where: { schoolId, userId: substituteUserId, role: 'teacher', isActive: true },
        include: { user: { select: { fullName: true } } },
      });
      if (!substitute) throw new BadRequestException('Διάλεξε εκπαιδευτικό για αντικατάσταση.');
      substituteName = substitute.user.fullName;
    }
    const academicYear = String(data.academicYear ?? '').trim() || this.yearForDay(day);
    const note = String(data.note ?? '').trim();
    const reason = String(data.reason ?? '').trim();
    const saved = [];
    for (const current of days) {
      saved.push(await this.prisma.teacherAbsence.upsert({
        where: {
          schoolId_teacherUserId_date: {
            schoolId,
            teacherUserId,
            date: new Date(`${current}T12:00:00.000Z`),
          },
        },
        create: {
          schoolId,
          teacherUserId,
          date: new Date(`${current}T12:00:00.000Z`),
          note: note || null,
          reason: reason || null,
          substituteUserId: substituteUserId || null,
          academicYear,
        },
        update: {
          note: note || null,
          reason: reason || null,
          substituteUserId: substituteUserId || null,
          academicYear,
        },
        include: {
          teacher: { select: { id: true, fullName: true, avatarUrl: true } },
          substitute: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }));
    }
    await this.notifyTeacherAbsence(
      schoolId,
      saved[0].id,
      teacherUserId,
      member.user.fullName,
      days,
      reason || note,
      substituteName,
    );
    return saved.length === 1 ? saved[0] : saved;
  }

  async deleteTeacherAbsence(schoolId: string, absenceId: string) {
    await this.ensureAbsenceTable();
    const row = await this.prisma.teacherAbsence.findFirst({ where: { id: absenceId, schoolId } });
    if (!row) throw new NotFoundException('Η απουσία δεν βρέθηκε.');
    return this.prisma.teacherAbsence.delete({ where: { id: absenceId } });
  }

  private async notifyTeacherAbsence(
    schoolId: string,
    absenceId: string,
    teacherUserId: string,
    teacherName: string,
    days: string[],
    reason: string,
    substituteName: string,
  ) {
    const classes = await this.prisma.classTeacher.findMany({
      where: { userId: teacherUserId, class: { schoolId } },
      select: { classId: true },
    });
    const classIds = classes.map((row) => row.classId);
    const parents = await this.prisma.studentParent.findMany({
      where: {
        student: {
          schoolId,
          isActive: true,
          ...(classIds.length ? { enrollments: { some: { classId: { in: classIds } } } } : {}),
        },
      },
      select: { userId: true },
    });
    const when = absenceWhen(days);
    const because = reason ? ` λόγω ${reason}` : '';
    const body = (substituteName
      ? `${when} θα αντικατασταθεί ο/η ${teacherName} από τον/την ${substituteName}${because}.`
      : `${when} θα απουσιάσει ο/η ${teacherName}${because}.`
    ).slice(0, 220);
    await this.notifications.notifyUsers(schoolId, parents.map((parent) => parent.userId), {
      event: 'teacher_absence',
      type: 'teacher_absence',
      title: 'Απουσία εκπαιδευτικού',
      body,
      data: { screen: 'absences', absenceId, teacherUserId, date: days[0] },
    });
  }

  private async parentTeacherIds(schoolId: string, userId: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, isActive: true, parents: { some: { userId } } },
      select: { enrollments: { select: { class: { select: { teachers: { select: { userId: true } } } } } } },
    });
    const ids = new Set<string>();
    for (const student of students) {
      for (const enrollment of student.enrollments) {
        for (const teacher of enrollment.class.teachers) ids.add(teacher.userId);
      }
    }
    return ids;
  }

  private yearForDay(day: string) {
    const [year, month] = day.split('-').map(Number);
    const start = month >= 9 ? year : year - 1;
    return `${start}-${start + 1}`;
  }

  private async ensureAbsenceTable() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "teacher_absences" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "teacher_user_id" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "note" TEXT,
        "academic_year" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "teacher_absences_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "teacher_absences_school_id_teacher_user_id_date_key" ON "teacher_absences"("school_id", "teacher_user_id", "date")`,
      `CREATE INDEX IF NOT EXISTS "teacher_absences_school_id_academic_year_idx" ON "teacher_absences"("school_id", "academic_year")`,
      `ALTER TABLE "teacher_absences" ADD COLUMN IF NOT EXISTS "reason" TEXT`,
      `ALTER TABLE "teacher_absences" ADD COLUMN IF NOT EXISTS "substitute_user_id" TEXT`,
      `CREATE INDEX IF NOT EXISTS "teacher_absences_school_id_substitute_user_id_date_idx" ON "teacher_absences"("school_id", "substitute_user_id", "date")`,
    ];
    for (const sql of statements) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (error) {
        const message = String((error as { message?: string })?.message ?? error);
        if (!/already exists|duplicate/i.test(message)) this.logger.warn(`Teacher absence schema: ${message}`);
      }
    }
  }
}

function eachAbsenceDay(start: string, end: string) {
  const days: string[] = [];
  const cursor = new Date(`${start}T12:00:00.000Z`);
  const last = new Date(`${end}T12:00:00.000Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function athensToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function greekDay(day: string) {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

function absenceWhen(days: string[]) {
  const today = athensToday();
  const tomorrowDate = new Date(`${today}T12:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  if (days.length === 1) {
    if (days[0] === today) return 'Σήμερα';
    if (days[0] === tomorrow) return 'Αύριο';
    return `Στις ${greekDay(days[0])}`;
  }
  return `Από ${greekDay(days[0])} έως ${greekDay(days[days.length - 1])}`;
}
