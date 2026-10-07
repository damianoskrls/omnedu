import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dateOnly, ensureMenuSchema, menuUnique, normalizeAudience, weekdaysOfMonth } from '../daily-menus/menu-audience';
import { SEPTEMBER_2026_TEMPLATE } from '../daily-menus/september-2026';

type EntryInput = {
  dayOfWeek: number;
  breakfast?: string;
  midMorning?: string;
  lunch?: string;
  afternoon?: string;
  notes?: string;
};

@Injectable()
export class MenuTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(MenuTemplatesService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await ensureMenuSchema((sql) => this.prisma.$executeRawUnsafe(sql));
    } catch (error) {
      this.logger.warn(`Menu schema check skipped: ${error}`);
    }
  }

  async findAll(schoolId: string) {
    return this.prisma.menuTemplate.findMany({
      where: { schoolId },
      include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const template = await this.prisma.menuTemplate.findFirst({
      where: { id, schoolId },
      include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async create(schoolId: string, data: {
    name: string;
    description?: string;
    kind?: string;
    sourceMonth?: string;
    audienceType?: string;
    audienceIds?: unknown;
    entries?: EntryInput[];
  }) {
    const audience = normalizeAudience(data.audienceType, data.audienceIds);
    const kind = data.kind === 'month' ? 'month' : 'week';
    return this.prisma.menuTemplate.create({
      data: {
        schoolId,
        name: data.name,
        description: data.description,
        kind,
        sourceMonth: data.sourceMonth,
        ...audience,
        entries: data.entries?.length ? { create: data.entries.map((entry) => this.entryData(entry)) } : undefined,
      },
      include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
    });
  }

  async update(id: string, schoolId: string, data: {
    name?: string;
    description?: string;
    audienceType?: string;
    audienceIds?: unknown;
    entries?: EntryInput[];
  }) {
    await this.findOne(id, schoolId);
    const audience = data.audienceType ? normalizeAudience(data.audienceType, data.audienceIds) : undefined;
    return this.prisma.$transaction(async (tx) => {
      if (data.entries) {
        await tx.menuTemplateEntry.deleteMany({ where: { templateId: id } });
        await tx.menuTemplateEntry.createMany({
          data: data.entries.map((entry) => ({ templateId: id, ...this.entryData(entry) })),
        });
      }
      return tx.menuTemplate.update({
        where: { id },
        data: { name: data.name, description: data.description, ...audience },
        include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
      });
    });
  }

  async remove(id: string, schoolId: string) {
    await this.findOne(id, schoolId);
    return this.prisma.menuTemplate.delete({ where: { id } });
  }

  async createFromMonth(schoolId: string, body: {
    month: string;
    name?: string;
    audienceType?: string;
    audienceIds?: unknown;
  }) {
    if (!/^\d{4}-\d{2}$/.test(body.month || '')) throw new BadRequestException('Δώσε μήνα σε μορφή yyyy-MM.');
    const audience = normalizeAudience(body.audienceType, body.audienceIds);
    const days = weekdaysOfMonth(body.month);
    const menus = await this.prisma.dailyMenu.findMany({
      where: {
        schoolId,
        ...audience,
        date: { gte: dateOnly(days[0]), lte: dateOnly(days[days.length - 1]) },
      },
      orderBy: { date: 'asc' },
    });
    if (!menus.length) throw new BadRequestException('Ο μήνας δεν έχει γεύματα για αυτό το κοινό.');
    const [year, month] = body.month.split('-');
    const label = `${month}/${year}`;
    return this.create(schoolId, {
      name: body.name?.trim() || `Πρότυπο ${label}`,
      description: `Αποθηκεύτηκε από το πρόγραμμα ${label}. Στον ίδιο μήνα μπαίνει στις ίδιες ημερομηνίες, σε άλλον μήνα αντιγράφεται η σειρά των σχολικών ημερών.`,
      kind: 'month',
      sourceMonth: body.month,
      ...audience,
      entries: menus.map((menu) => ({
        dayOfWeek: menu.date.getUTCDate(),
        breakfast: menu.breakfast ?? undefined,
        midMorning: menu.midMorning ?? undefined,
        lunch: menu.lunch ?? undefined,
        afternoon: menu.afternoon ?? undefined,
        notes: menu.notes ?? undefined,
      })),
    });
  }

  async ensureSeptember(schoolId: string, audienceType?: string, audienceIds?: unknown) {
    const audience = normalizeAudience(audienceType, audienceIds);
    const existing = await this.prisma.menuTemplate.findFirst({
      where: { schoolId, name: SEPTEMBER_2026_TEMPLATE.name, kind: 'month' },
      include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (existing) return existing;
    return this.create(schoolId, {
      name: SEPTEMBER_2026_TEMPLATE.name,
      description: SEPTEMBER_2026_TEMPLATE.description,
      kind: 'month',
      sourceMonth: SEPTEMBER_2026_TEMPLATE.sourceMonth,
      ...audience,
      entries: SEPTEMBER_2026_TEMPLATE.days.map((day) => ({
        dayOfWeek: Number(day.date.slice(-2)),
        midMorning: day.midMorning,
        lunch: day.lunch,
        afternoon: day.afternoon,
        notes: day.notes,
      })),
    });
  }

  /** Apply a template to a month (yyyy-MM). Week templates repeat Mon–Fri. Month templates keep the calendar day when the month matches, otherwise the school-day sequence. */
  async applyToMonth(id: string, schoolId: string, month: string, audienceType?: string, audienceIds?: unknown) {
    const template = await this.findOne(id, schoolId);
    const audience = audienceType || template.audienceType
      ? normalizeAudience(audienceType || template.audienceType, audienceIds ?? template.audienceIds)
      : normalizeAudience('all');
    if (template.kind === 'month') return this.applyMonthTemplate(template, schoolId, month, audience);
    return this.applyWeekTemplate(template, schoolId, month, audience);
  }

  private async applyWeekTemplate(template: any, schoolId: string, month: string, audience: { audienceType: string; audienceIds: string }) {
    let applied = 0;
    for (const dateStr of weekdaysOfMonth(month)) {
      const dow = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
      const entry = template.entries.find((item: EntryInput) => item.dayOfWeek === dow);
      if (!entry) continue;
      await this.writeDay(schoolId, dateStr, entry, audience);
      applied++;
    }
    return { applied };
  }

  private async applyMonthTemplate(template: any, schoolId: string, month: string, audience: { audienceType: string; audienceIds: string }) {
    const entries = [...template.entries].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    let applied = 0;
    if (template.sourceMonth === month) {
      const [year, mon] = month.split('-').map(Number);
      const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      for (const entry of entries) {
        if (entry.dayOfWeek < 1 || entry.dayOfWeek > last) continue;
        const dateStr = `${month}-${String(entry.dayOfWeek).padStart(2, '0')}`;
        const dow = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
        if (dow === 0 || dow === 6) continue;
        await this.writeDay(schoolId, dateStr, entry, audience);
        applied++;
      }
      return { applied, mode: 'dates' };
    }
    const targets = weekdaysOfMonth(month);
    const limit = Math.min(entries.length, targets.length);
    for (let i = 0; i < limit; i++) {
      await this.writeDay(schoolId, targets[i], entries[i], audience);
      applied++;
    }
    return { applied, mode: 'sequence' };
  }

  private async writeDay(schoolId: string, dateStr: string, entry: EntryInput, audience: { audienceType: string; audienceIds: string }) {
    const date = dateOnly(dateStr);
    const meals = {
      breakfast: entry.breakfast ?? null,
      midMorning: entry.midMorning ?? null,
      lunch: entry.lunch ?? null,
      afternoon: entry.afternoon ?? null,
      notes: entry.notes ?? null,
    };
    return this.prisma.dailyMenu.upsert({
      where: menuUnique(schoolId, date, audience.audienceType, audience.audienceIds),
      create: { schoolId, date, ...audience, ...meals },
      update: meals,
    });
  }

  private entryData(entry: EntryInput) {
    return {
      dayOfWeek: entry.dayOfWeek,
      breakfast: entry.breakfast,
      midMorning: entry.midMorning,
      lunch: entry.lunch,
      afternoon: entry.afternoon,
      notes: entry.notes,
    };
  }
}
