import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';

@Injectable()
export class SchoolsService implements OnModuleInit {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureRegulationSchema();
  }

  private async ensureRegulationSchema() {
    const statements = [
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
}
