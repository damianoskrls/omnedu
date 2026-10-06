import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QuestionnairesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, academicYear?: number) {
    return this.prisma.questionnaire.findMany({
      where: { schoolId, isActive: true, ...(academicYear ? { academicYear } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const q = await this.prisma.questionnaire.findFirst({ where: { id, schoolId } });
    if (!q) throw new NotFoundException('Questionnaire not found');
    return q;
  }

  async create(schoolId: string, data: {
    title: string;
    description?: string;
    academicYear: number;
    scopeType?: string;
    scopeIds?: string[];
  }) {
    return this.prisma.questionnaire.create({
      data: {
        id: uuidv4(),
        schoolId,
        title: data.title,
        description: data.description,
        academicYear: data.academicYear,
        scopeType: data.scopeType ?? 'all',
        scopeIds: JSON.stringify(data.scopeIds ?? []),
      },
    });
  }

  async update(id: string, schoolId: string, data: {
    title?: string;
    description?: string;
    academicYear?: number;
    scopeType?: string;
    scopeIds?: string[];
    isActive?: boolean;
  }) {
    const q = await this.prisma.questionnaire.findFirst({ where: { id, schoolId } });
    if (!q) throw new NotFoundException('Questionnaire not found');
    return this.prisma.questionnaire.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.academicYear !== undefined ? { academicYear: data.academicYear } : {}),
        ...(data.scopeType !== undefined ? { scopeType: data.scopeType } : {}),
        ...(data.scopeIds !== undefined ? { scopeIds: JSON.stringify(data.scopeIds) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async remove(id: string, schoolId: string) {
    const q = await this.prisma.questionnaire.findFirst({ where: { id, schoolId } });
    if (!q) throw new NotFoundException('Questionnaire not found');
    return this.prisma.questionnaire.delete({ where: { id } });
  }
}
