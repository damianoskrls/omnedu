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
    const year = academicYear || current;
    const row = await this.prisma.schoolRegulation.findUnique({
      where: { schoolId_academicYear: { schoolId, academicYear: year } },
    });
    const pick = (fromYear?: string | null, fromSchool?: string | null) => {
      if (fromYear?.trim()) return fromYear;
      if (year === current && fromSchool?.trim()) return fromSchool;
      return fromYear ?? null;
    };
    return {
      academicYear: year,
      operatingRegulation: pick(row?.operatingText, school.operatingRegulation),
      financialRegulation: pick(row?.financialText, school.financialRegulation),
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
      include: { teacher: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { date: 'asc' },
    });
    if (user.isSuperAdmin || user.role === 'school_admin' || user.role === 'teacher') return rows;
    const teacherIds = await this.parentTeacherIds(schoolId, user.sub);
    return rows.filter((row) => teacherIds.has(row.teacherUserId));
  }

  async createTeacherAbsence(
    schoolId: string,
    data: { teacherUserId?: string; date?: string; note?: string; academicYear?: string },
  ) {
    await this.ensureAbsenceTable();
    const teacherUserId = String(data.teacherUserId ?? '').trim();
    const day = String(data.date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Διάλεξε ημερομηνία.');
    const member = await this.prisma.schoolMember.findFirst({
      where: { schoolId, userId: teacherUserId, role: 'teacher', isActive: true },
      include: { user: { select: { fullName: true } } },
    });
    if (!member) throw new BadRequestException('Διάλεξε εκπαιδευτικό του σχολείου.');
    const academicYear = String(data.academicYear ?? '').trim() || this.yearForDay(day);
    const note = String(data.note ?? '').trim();
    try {
      const created = await this.prisma.teacherAbsence.create({
        data: {
          schoolId,
          teacherUserId,
          date: new Date(`${day}T12:00:00.000Z`),
          note: note || null,
          academicYear,
        },
        include: { teacher: { select: { id: true, fullName: true, avatarUrl: true } } },
      });
      await this.notifyTeacherAbsence(schoolId, created.id, teacherUserId, member.user.fullName, day, note);
      return created;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') throw new ConflictException('Η απουσία αυτού του εκπαιδευτικού είναι ήδη καταχωρημένη για αυτή την ημέρα.');
      throw error;
    }
  }

  async deleteTeacherAbsence(schoolId: string, absenceId: string) {
    await this.ensureAbsenceTable();
    const row = await this.prisma.teacherAbsence.findFirst({ where: { id: absenceId, schoolId } });
    if (!row) throw new NotFoundException('Η απουσία δεν βρέθηκε.');
    return this.prisma.teacherAbsence.delete({ where: { id: absenceId } });
  }

  private async notifyTeacherAbsence(schoolId: string, absenceId: string, teacherUserId: string, teacherName: string, day: string, note: string) {
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
    const [year, month, date] = day.split('-');
    const label = `${date}/${month}/${year}`;
    const body = [`${teacherName} θα απουσιάσει στις ${label}.`, note].filter(Boolean).join(' ').slice(0, 180);
    await this.notifications.notifyUsers(schoolId, parents.map((parent) => parent.userId), {
      event: 'teacher_absence',
      type: 'teacher_absence',
      title: 'Απουσία εκπαιδευτικού',
      body,
      data: { screen: 'absences', absenceId, teacherUserId, date: day },
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
