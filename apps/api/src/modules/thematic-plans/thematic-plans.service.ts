import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MONTH = /^\d{4}-\d{2}$/;

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
export class ThematicPlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, month?: string, classId?: string) {
    return this.prisma.thematicPlan.findMany({
      where: {
        schoolId,
        ...(month ? { month } : {}),
        ...(classId ? { classId } : {}),
      },
      include: { class: { select: { id: true, name: true } } },
      orderBy: [{ month: 'desc' }, { class: { name: 'asc' } }],
    });
  }

  async upsert(schoolId: string, data: PlanInput) {
    this.assertMonth(data.month, 'month');
    if (data.throughMonth) this.assertMonth(data.throughMonth, 'throughMonth');
    if (!data.classId) throw new BadRequestException('Διάλεξε τάξη.');
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

    return this.prisma.thematicPlan.upsert({
      where: { schoolId_classId_month: { schoolId, classId: data.classId, month: data.month } },
      create: { schoolId, classId: data.classId, month: data.month, ...fields },
      update: fields,
      include: { class: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string, schoolId: string) {
    const plan = await this.prisma.thematicPlan.findFirst({ where: { id, schoolId } });
    if (!plan) throw new NotFoundException('Το διαθεματικό δεν βρέθηκε.');
    return this.prisma.thematicPlan.delete({ where: { id } });
  }

  private assertMonth(value: string, field: string) {
    if (!MONTH.test(value || '')) throw new BadRequestException(`Ο μήνας (${field}) πρέπει να είναι yyyy-MM.`);
  }
}
