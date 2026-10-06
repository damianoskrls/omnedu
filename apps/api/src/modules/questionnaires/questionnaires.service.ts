import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QuestionnairesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, academicYear?: number) {
    return this.prisma.questionnaire.findMany({
      where: { schoolId, isActive: true, ...(academicYear ? { academicYear } : {}) },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const q = await this.prisma.questionnaire.findFirst({
      where: { id, schoolId },
      include: { responses: { include: { student: { select: { id: true, fullName: true, avatarUrl: true } } } } },
    });
    if (!q) throw new NotFoundException('Questionnaire not found');
    return q;
  }

  async create(schoolId: string, data: {
    title: string;
    description?: string;
    academicYear: number;
    questions?: any[];
    scopeType?: string;
    scopeIds?: string[];
    deadline?: string;
    status?: string;
  }) {
    return this.prisma.questionnaire.create({
      data: {
        id: uuidv4(),
        schoolId,
        title: data.title,
        description: data.description,
        academicYear: data.academicYear,
        questions: JSON.stringify(data.questions ?? []),
        scopeType: data.scopeType ?? 'all',
        scopeIds: JSON.stringify(data.scopeIds ?? []),
        deadline: data.deadline ? new Date(data.deadline) : null,
        status: data.status ?? 'draft',
      },
    });
  }

  async update(id: string, schoolId: string, data: {
    title?: string;
    description?: string;
    academicYear?: number;
    questions?: any[];
    scopeType?: string;
    scopeIds?: string[];
    deadline?: string | null;
    status?: string;
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
        ...(data.questions !== undefined ? { questions: JSON.stringify(data.questions) } : {}),
        ...(data.scopeType !== undefined ? { scopeType: data.scopeType } : {}),
        ...(data.scopeIds !== undefined ? { scopeIds: JSON.stringify(data.scopeIds) } : {}),
        ...(data.deadline !== undefined ? { deadline: data.deadline ? new Date(data.deadline) : null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async remove(id: string, schoolId: string) {
    const q = await this.prisma.questionnaire.findFirst({ where: { id, schoolId } });
    if (!q) throw new NotFoundException('Questionnaire not found');
    return this.prisma.questionnaire.delete({ where: { id } });
  }

  // ── Responses ──────────────────────────────────────────────────────────────

  async getResponses(questionnaireId: string, schoolId: string) {
    const q = await this.prisma.questionnaire.findFirst({ where: { id: questionnaireId, schoolId } });
    if (!q) throw new NotFoundException('Questionnaire not found');
    return this.prisma.questionnaireResponse.findMany({
      where: { questionnaireId },
      include: { student: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async upsertResponse(questionnaireId: string, schoolId: string, studentId: string, answers: Record<string, any>) {
    const q = await this.prisma.questionnaire.findFirst({ where: { id: questionnaireId, schoolId } });
    if (!q) throw new NotFoundException('Questionnaire not found');

    return this.prisma.questionnaireResponse.upsert({
      where: { questionnaireId_studentId: { questionnaireId, studentId } },
      create: {
        id: uuidv4(),
        questionnaireId,
        studentId,
        answers: JSON.stringify(answers),
      },
      update: {
        answers: JSON.stringify(answers),
        updatedAt: new Date(),
      },
    });
  }
}
