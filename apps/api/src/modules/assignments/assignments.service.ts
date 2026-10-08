import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const staffRoles = new Set(['teacher', 'school_admin', 'owner']);

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async findAll(schoolId: string, viewer: { sub: string; role?: string | null }, classId?: string, studentId?: string) {
    if (viewer.role === 'parent') {
      const classIds = studentId
        ? await this.classIdsForChild(schoolId, viewer.sub, studentId)
        : await this.classIdsForParent(schoolId, viewer.sub);
      if (!classIds.length) return [];
      return this.list(schoolId, classIds);
    }
    if (!staffRoles.has(viewer.role ?? '')) throw new ForbiddenException('Δεν έχεις πρόσβαση στις εργασίες.');
    return this.list(schoolId, classId ? [classId] : undefined);
  }

  async create(schoolId: string, authorId: string, role: string | null | undefined, data: {
    classId?: string;
    title?: string;
    instructions?: string;
    fileUrls?: string[];
  }) {
    if (!staffRoles.has(role ?? '')) throw new ForbiddenException('Οι γονείς δεν ανεβάζουν εργασίες.');
    const classId = data.classId?.trim() ?? '';
    const title = data.title?.trim() ?? '';
    const instructions = data.instructions?.trim() ?? '';
    const fileUrls = (data.fileUrls ?? []).map((url) => url.trim()).filter(Boolean);
    if (!classId) throw new BadRequestException('Διάλεξε τάξη.');
    if (!title) throw new BadRequestException('Γράψε τίτλο για την εργασία.');
    if (!instructions && fileUrls.length === 0) throw new BadRequestException('Γράψε οδηγίες ή πρόσθεσε αρχείο.');
    const klass = await this.prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
    if (!klass) throw new NotFoundException('Η τάξη δεν βρέθηκε.');

    const created = await this.prisma.classAssignment.create({
      data: { schoolId, classId, authorId, title, instructions: instructions || null, fileUrls },
      include: this.include(),
    });
    await this.notifyParents(schoolId, created);
    return created;
  }

  async remove(schoolId: string, id: string, role: string | null | undefined) {
    if (!staffRoles.has(role ?? '')) throw new ForbiddenException('Οι γονείς δεν διαγράφουν εργασίες.');
    const row = await this.prisma.classAssignment.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException('Η εργασία δεν βρέθηκε.');
    await this.prisma.classAssignment.delete({ where: { id } });
    return { ok: true };
  }

  private include() {
    return {
      class: { select: { id: true, name: true } },
      author: { select: { id: true, fullName: true, avatarUrl: true } },
    } as const;
  }

  private list(schoolId: string, classIds?: string[]) {
    return this.prisma.classAssignment.findMany({
      where: { schoolId, ...(classIds ? { classId: { in: classIds } } : {}) },
      include: this.include(),
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
  }

  private async classIdsForChild(schoolId: string, parentId: string, studentId: string) {
    const link = await this.prisma.studentParent.findFirst({
      where: { userId: parentId, studentId, student: { schoolId } },
      select: { studentId: true },
    });
    if (!link) throw new ForbiddenException('Αυτό το παιδί δεν είναι στο προφίλ σου.');
    const enrollment = await this.currentEnrollment(schoolId, studentId);
    return enrollment ? [enrollment] : [];
  }

  private async classIdsForParent(schoolId: string, parentId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { userId: parentId, student: { schoolId, isActive: true } },
      select: { studentId: true },
    });
    const ids = new Set<string>();
    for (const link of links) {
      const classId = await this.currentEnrollment(schoolId, link.studentId);
      if (classId) ids.add(classId);
    }
    return [...ids];
  }

  private async currentEnrollment(schoolId: string, studentId: string) {
    const rows = await this.prisma.classEnrollment.findMany({
      where: { studentId, class: { schoolId } },
      include: { class: { select: { id: true, academicYear: { select: { isCurrent: true } } } } },
      orderBy: { enrolledAt: 'desc' },
    });
    const current = rows.find((row) => row.class.academicYear?.isCurrent);
    return (current ?? rows[0])?.class.id ?? null;
  }

  private async notifyParents(schoolId: string, assignment: {
    id: string;
    classId: string;
    title: string;
    instructions: string | null;
    class: { name: string };
  }) {
    const parents = await this.prisma.studentParent.findMany({
      where: { student: { schoolId, isActive: true, enrollments: { some: { classId: assignment.classId } } } },
      select: { userId: true },
    });
    const userIds = [...new Set(parents.map((parent) => parent.userId))];
    const text = (assignment.instructions ?? '').replace(/\s+/g, ' ').trim();
    await this.notifications.notifyUsers(schoolId, userIds, {
      event: 'assignment',
      type: 'assignment',
      title: `Εργασία · ${assignment.class.name}`,
      body: [assignment.title, text].filter(Boolean).join('. ').slice(0, 180),
      data: {
        screen: 'assignments',
        assignmentId: assignment.id,
        classId: assignment.classId,
        className: assignment.class.name,
      },
    });
  }
}
