import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class CelebrationsService implements OnModuleInit {
  private readonly logger = new Logger(CelebrationsService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "school_celebrations" (
          "id" TEXT NOT NULL,
          "school_id" TEXT NOT NULL,
          "academic_year" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "event_date" DATE,
          "arrival_time" TEXT,
          "place" TEXT,
          "details" TEXT,
          "items" TEXT NOT NULL DEFAULT '[]',
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "school_celebrations_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "image_url" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "audience_type" TEXT NOT NULL DEFAULT 'all'`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "audience_ids" TEXT NOT NULL DEFAULT '[]'`);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "school_celebrations_school_id_academic_year_idx"
        ON "school_celebrations"("school_id", "academic_year")
      `);
    } catch (error) {
      this.logger.warn(`Celebration table check skipped: ${error}`);
    }
  }

  async findAll(schoolId: string, user: JwtPayload, academicYear?: string) {
    await this.ensureTable();
    const rows = await this.prisma.schoolCelebration.findMany({
      where: { schoolId, ...(academicYear ? { academicYear } : {}) },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
    });
    if (user.isSuperAdmin || user.role === 'school_admin' || user.role === 'teacher') return rows;
    const scope = await this.parentScope(schoolId, user.sub);
    return rows.filter((row) => this.visibleToParent(row.audienceType, row.audienceIds, scope));
  }

  async setImage(id: string, schoolId: string, imageUrl: string) {
    const existing = await this.prisma.schoolCelebration.findFirst({ where: { id, schoolId } });
    if (!existing) throw new NotFoundException('Η γιορτή δεν βρέθηκε.');
    return this.prisma.schoolCelebration.update({ where: { id }, data: { imageUrl } });
  }

  async create(schoolId: string, data: any) {
    await this.ensureTable();
    const title = String(data.title ?? '').trim();
    if (!title) throw new BadRequestException('Γράψε τον τίτλο της γιορτής.');
    return this.prisma.schoolCelebration.create({
      data: {
        id: randomUUID(),
        schoolId,
        ...this.writeData(data, title),
      },
    });
  }

  async update(id: string, schoolId: string, data: any) {
    const existing = await this.prisma.schoolCelebration.findFirst({ where: { id, schoolId } });
    if (!existing) throw new NotFoundException('Η γιορτή δεν βρέθηκε.');
    const title = data.title === undefined ? existing.title : String(data.title).trim();
    if (!title) throw new BadRequestException('Γράψε τον τίτλο της γιορτής.');
    return this.prisma.schoolCelebration.update({
      where: { id },
      data: this.writeData({ ...data, academicYear: data.academicYear ?? existing.academicYear }, title),
    });
  }

  async remove(id: string, schoolId: string) {
    const existing = await this.prisma.schoolCelebration.findFirst({ where: { id, schoolId } });
    if (!existing) throw new NotFoundException('Η γιορτή δεν βρέθηκε.');
    return this.prisma.schoolCelebration.delete({ where: { id } });
  }

  private writeData(data: any, title: string) {
    const year = String(data.academicYear ?? '').trim();
    return {
      title,
      academicYear: year || this.currentSchoolYear(),
      eventDate: this.dateOrNull(data.eventDate),
      arrivalTime: this.textOrNull(data.arrivalTime),
      place: this.textOrNull(data.place),
      details: this.textOrNull(data.details),
      items: JSON.stringify(this.cleanItems(data.items)),
      ...this.audienceData(data),
    };
  }

  private audienceData(data: any) {
    const audienceType = ['all', 'class', 'level', 'teachers'].includes(data.audienceType) ? data.audienceType : 'all';
    let ids: string[] = [];
    if (audienceType === 'class' || audienceType === 'level') {
      const raw = typeof data.audienceIds === 'string' ? this.parseIds(data.audienceIds) : data.audienceIds;
      ids = Array.isArray(raw) ? raw.map((id: unknown) => String(id)).filter(Boolean) : [];
      if (!ids.length) throw new BadRequestException(audienceType === 'class' ? 'Διάλεξε τουλάχιστον μία τάξη.' : 'Διάλεξε τουλάχιστον μία βαθμίδα.');
    }
    return { audienceType, audienceIds: JSON.stringify(ids) };
  }

  private async parentScope(schoolId: string, userId: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, isActive: true, parents: { some: { userId } } },
      select: { enrollments: { select: { class: { select: { id: true, levelId: true } } } } },
    });
    const classIds = new Set<string>();
    const levelIds = new Set<string>();
    for (const student of students) {
      for (const enrollment of student.enrollments) {
        classIds.add(enrollment.class.id);
        if (enrollment.class.levelId) levelIds.add(enrollment.class.levelId);
      }
    }
    return { classIds, levelIds };
  }

  private visibleToParent(audienceType: string, audienceIds: string, scope: { classIds: Set<string>; levelIds: Set<string> }) {
    if (!audienceType || audienceType === 'all') return true;
    if (audienceType === 'teachers') return false;
    const ids = this.parseIds(audienceIds);
    if (audienceType === 'class') return ids.some((id) => scope.classIds.has(id));
    if (audienceType === 'level') return ids.some((id) => scope.levelIds.has(id));
    return false;
  }

  private parseIds(value: string) {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
    } catch {
      return [];
    }
  }

  private currentSchoolYear() {
    const now = new Date();
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}-${start + 1}`;
  }

  private textOrNull(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private dateOrNull(value: unknown) {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private cleanItems(value: unknown) {
    const rows = Array.isArray(value) ? value : [];
    return rows
      .map((row: any) => ({
        name: String(row?.name ?? '').trim(),
        cost: row?.cost === '' || row?.cost == null || !Number.isFinite(Number(row.cost)) ? null : Number(row.cost),
        phase: row?.phase === 'after' ? 'after' : 'before',
      }))
      .filter(row => row.name);
  }
}
