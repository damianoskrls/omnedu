import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "school_celebrations_school_id_academic_year_idx"
        ON "school_celebrations"("school_id", "academic_year")
      `);
    } catch (error) {
      this.logger.warn(`Celebration table check skipped: ${error}`);
    }
  }

  async findAll(schoolId: string, academicYear?: string) {
    await this.ensureTable();
    return this.prisma.schoolCelebration.findMany({
      where: { schoolId, ...(academicYear ? { academicYear } : {}) },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
    });
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
    };
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
