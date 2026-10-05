import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MenuTemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string) {
    return this.prisma.menuTemplate.findMany({
      where: { schoolId },
      include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const t = await this.prisma.menuTemplate.findFirst({
      where: { id, schoolId },
      include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async create(schoolId: string, data: { name: string; description?: string; entries?: any[] }) {
    return this.prisma.menuTemplate.create({
      data: {
        schoolId,
        name: data.name,
        description: data.description,
        entries: data.entries?.length
          ? { create: data.entries.map(e => ({ dayOfWeek: e.dayOfWeek, breakfast: e.breakfast, midMorning: e.midMorning, lunch: e.lunch, afternoon: e.afternoon, notes: e.notes })) }
          : undefined,
      },
      include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
    });
  }

  async update(id: string, schoolId: string, data: { name?: string; description?: string; entries?: any[] }) {
    await this.findOne(id, schoolId);
    return this.prisma.$transaction(async (tx) => {
      if (data.entries) {
        await tx.menuTemplateEntry.deleteMany({ where: { templateId: id } });
        await tx.menuTemplateEntry.createMany({
          data: data.entries.map(e => ({ templateId: id, dayOfWeek: e.dayOfWeek, breakfast: e.breakfast, midMorning: e.midMorning, lunch: e.lunch, afternoon: e.afternoon, notes: e.notes })),
        });
      }
      return tx.menuTemplate.update({
        where: { id },
        data: { name: data.name, description: data.description },
        include: { entries: { orderBy: { dayOfWeek: 'asc' } } },
      });
    });
  }

  async remove(id: string, schoolId: string) {
    await this.findOne(id, schoolId);
    return this.prisma.menuTemplate.delete({ where: { id } });
  }

  /** Apply a template to fill all weekdays of a given month (yyyy-MM) */
  async applyToMonth(id: string, schoolId: string, month: string) {
    const template = await this.findOne(id, schoolId);
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();

    const upserts: Promise<any>[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, mon - 1, d);
      const dow = date.getDay(); // 0=Sun, 1=Mon…
      if (dow === 0 || dow === 6) continue; // skip weekends
      const entry = template.entries.find(e => e.dayOfWeek === dow);
      if (!entry) continue;
      const dateStr = `${year}-${String(mon).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      upserts.push(
        this.prisma.dailyMenu.upsert({
          where: { schoolId_date: { schoolId, date: new Date(dateStr) } },
          create: { schoolId, date: new Date(dateStr), breakfast: entry.breakfast, midMorning: entry.midMorning, lunch: entry.lunch, afternoon: entry.afternoon, notes: entry.notes },
          update: { breakfast: entry.breakfast, midMorning: entry.midMorning, lunch: entry.lunch, afternoon: entry.afternoon, notes: entry.notes },
        }),
      );
    }
    await Promise.all(upserts);
    return { applied: upserts.length };
  }
}
