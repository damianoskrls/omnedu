import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DailyMenusService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, from?: string, to?: string) {
    return this.prisma.dailyMenu.findMany({
      where: {
        schoolId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async findByDate(schoolId: string, date: string) {
    const menu = await this.prisma.dailyMenu.findUnique({
      where: { schoolId_date: { schoolId, date: new Date(date) } },
    });
    if (!menu) throw new NotFoundException('No menu for this date');
    return menu;
  }

  async upsert(
    schoolId: string,
    data: {
      date: string;
      breakfast?: string;
      midMorning?: string;
      lunch?: string;
      afternoon?: string;
      notes?: string;
    },
  ) {
    return this.prisma.dailyMenu.upsert({
      where: { schoolId_date: { schoolId, date: new Date(data.date) } },
      create: {
        schoolId,
        date: new Date(data.date),
        breakfast: data.breakfast,
        midMorning: data.midMorning,
        lunch: data.lunch,
        afternoon: data.afternoon,
        notes: data.notes,
      },
      update: {
        breakfast: data.breakfast,
        midMorning: data.midMorning,
        lunch: data.lunch,
        afternoon: data.afternoon,
        notes: data.notes,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.dailyMenu.delete({ where: { id } });
  }
}
