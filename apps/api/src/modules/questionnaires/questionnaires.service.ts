import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuestionnairesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(schoolId: string, academicYear?: number) {
    return this.prisma.questionnaire.findMany({
      where: { schoolId, isActive: true, ...(academicYear ? { academicYear } : {}) },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForStudent(schoolId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: {
        id: true,
        enrollments: { select: { classId: true, class: { select: { levelId: true } } } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const classIds = new Set(student.enrollments.map(e => e.classId));
    const levelIds = new Set(
      student.enrollments.map(e => e.class?.levelId).filter((id): id is string => Boolean(id)),
    );

    const questionnaires = await this.prisma.questionnaire.findMany({
      where: { schoolId, isActive: true, status: 'sent' },
      include: { responses: { where: { studentId } } },
      orderBy: { createdAt: 'desc' },
    });

    return questionnaires
      .filter(q => this.targetsStudent(q.scopeType, q.scopeIds, classIds, levelIds))
      .map(({ responses, ...q }) => ({ ...q, response: responses[0] ?? null }));
  }

  private targetsStudent(
    scopeType: string,
    scopeIdsRaw: string,
    classIds: Set<string>,
    levelIds: Set<string>,
  ) {
    if (scopeType === 'teachers') return false;
    if (scopeType === 'all' || !scopeType) return true;
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(scopeIdsRaw || '[]');
      ids = Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
    } catch {
      ids = [];
    }
    if (scopeType === 'class') return ids.some(id => classIds.has(id));
    if (scopeType === 'level') return ids.some(id => levelIds.has(id));
    return false;
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
    const updated = await this.prisma.questionnaire.update({
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
    if (data.status === 'sent' && q.status !== 'sent') await this.tellParents(updated);
    return updated;
  }

  private async tellParents(questionnaire: { id: string; schoolId: string; title: string; scopeType: string; scopeIds: string }) {
    try {
      const students = await this.prisma.student.findMany({
        where: { schoolId: questionnaire.schoolId, isActive: true },
        select: {
          id: true,
          fullName: true,
          enrollments: { select: { classId: true, class: { select: { levelId: true } } } },
        },
      });
      for (const student of students) {
        const classIds = new Set(student.enrollments.map((row) => row.classId));
        const levelIds = new Set(student.enrollments.map((row) => row.class?.levelId).filter((value): value is string => Boolean(value)));
        if (!this.targetsStudent(questionnaire.scopeType, questionnaire.scopeIds, classIds, levelIds)) continue;
        await this.notifications.notifyStudentParents(questionnaire.schoolId, student.id, {
          event: 'questionnaire',
          type: 'questionnaire',
          title: 'Νέο ερωτηματολόγιο',
          body: questionnaire.title,
          data: {
            screen: 'questionnaires',
            studentId: student.id,
            studentName: student.fullName,
            questionnaireId: questionnaire.id,
          },
        });
      }
    } catch {
      // The questionnaire stays sent even if a notice cannot be delivered.
    }
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
