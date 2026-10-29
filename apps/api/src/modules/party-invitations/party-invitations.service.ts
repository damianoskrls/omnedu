import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PartyInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(schoolId: string) {
    return this.prisma.partyInvitation.findMany({
      where: { schoolId },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(schoolId: string, id: string, requestingUserId: string) {
    const row = await this.prisma.partyInvitation.findFirst({
      where: { id, schoolId },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    if (!row) throw new NotFoundException('Η πρόσκληση δεν βρέθηκε');

    const recipientIds = Array.isArray(row.recipientStudentIds) ? row.recipientStudentIds as string[] : [];

    const [isOrganizer, isAdmin, isRecipientParent] = await Promise.all([
      this.prisma.studentParent.findFirst({
        where: { userId: requestingUserId, studentId: row.birthdayStudentId },
      }),
      this.prisma.schoolMember.findFirst({
        where: { userId: requestingUserId, schoolId, role: { in: ['school_admin', 'owner'] } as any },
      }),
      recipientIds.length > 0
        ? this.prisma.studentParent.findFirst({
            where: { userId: requestingUserId, studentId: { in: recipientIds } },
          })
        : Promise.resolve(null),
    ]);

    if (!isOrganizer && !isAdmin && !isRecipientParent) {
      throw new NotFoundException('Η πρόσκληση δεν βρέθηκε');
    }

    const canSeeGuestList = !!isOrganizer || !!isAdmin;
    const recipientStudents = canSeeGuestList && recipientIds.length > 0
      ? await this.prisma.student.findMany({
          where: { id: { in: recipientIds }, schoolId },
          select: { id: true, fullName: true, avatarUrl: true },
          orderBy: { fullName: 'asc' },
        })
      : [];
    const forMyChildren = !canSeeGuestList && recipientIds.length > 0
      ? await this.prisma.student.findMany({
          where: {
            schoolId,
            id: { in: recipientIds },
            isActive: true,
            parents: { some: { userId: requestingUserId } },
          },
          select: { id: true, fullName: true, avatarUrl: true },
          orderBy: { fullName: 'asc' },
        })
      : [];
    const { recipientStudentIds: _hiddenIds, ...safeRow } = row as typeof row & { recipientStudentIds?: unknown };
    return {
      ...safeRow,
      ...(canSeeGuestList ? { recipientStudentIds: row.recipientStudentIds } : {}),
      recipientStudents,
      forMyChildren,
      canSeeGuestList,
    };
  }

  async create(schoolId: string, data: {
    birthdayStudentId: string;
    title: string;
    body?: string;
    imageUrl?: string;
    pdfUrl?: string;
    eventDate?: string;
    recipientStudentIds: string[];
  }) {
    const student = await this.prisma.student.findFirst({ where: { id: data.birthdayStudentId, schoolId } });
    if (!student) throw new NotFoundException('Ο μαθητής δεν βρέθηκε');
    return this.prisma.partyInvitation.create({
      data: {
        id: crypto.randomUUID(),
        schoolId,
        birthdayStudentId: data.birthdayStudentId,
        title: data.title,
        body: data.body ?? null,
        imageUrl: data.imageUrl ?? null,
        pdfUrl: data.pdfUrl ?? null,
        eventDate: data.eventDate ?? null,
        recipientStudentIds: data.recipientStudentIds,
      },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async update(schoolId: string, id: string, data: {
    title?: string;
    body?: string;
    imageUrl?: string;
    pdfUrl?: string;
    eventDate?: string;
    recipientStudentIds?: string[];
  }) {
    const row = await this.prisma.partyInvitation.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException('Η πρόσκληση δεν βρέθηκε');
    return this.prisma.partyInvitation.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.pdfUrl !== undefined ? { pdfUrl: data.pdfUrl } : {}),
        ...(data.eventDate !== undefined ? { eventDate: data.eventDate } : {}),
        ...(data.recipientStudentIds !== undefined ? { recipientStudentIds: data.recipientStudentIds } : {}),
      },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async delete(schoolId: string, id: string) {
    const row = await this.prisma.partyInvitation.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException('Η πρόσκληση δεν βρέθηκε');
    await this.prisma.partyInvitation.delete({ where: { id } });
    return { ok: true };
  }

  async send(schoolId: string, id: string, isReminder = false) {
    const row = await this.prisma.partyInvitation.findFirst({
      where: { id, schoolId },
      include: { birthdayStudent: { select: { fullName: true } } },
    });
    if (!row) throw new NotFoundException('Η πρόσκληση δεν βρέθηκε');

    const recipientIds = Array.isArray(row.recipientStudentIds) ? row.recipientStudentIds as string[] : [];
    const links = await this.prisma.studentParent.findMany({
      where: { studentId: { in: recipientIds }, student: { schoolId, isActive: true } },
      select: { userId: true },
    });
    const userIds = [...new Set(links.map((l) => l.userId))];

    await this.notifications.notifyUsers(schoolId, userIds, {
      event: 'party_invitation',
      type: 'party_invitation',
      title: isReminder ? `Υπενθύμιση: ${row.title}` : row.title,
      body: isReminder
        ? `Υπενθύμιση πρόσκλησης από ${row.birthdayStudent.fullName}`
        : `${row.birthdayStudent.fullName} σε καλεί στο πάρτυ${row.eventDate ? ` στις ${row.eventDate}` : ''}!`,
      data: {
        invitationId: id,
        birthdayChildName: row.birthdayStudent.fullName,
        ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
      },
    });

    const now = new Date();
    return this.prisma.partyInvitation.update({
      where: { id },
      data: isReminder ? { reminderSentAt: now } : { sentAt: now },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async listSentByMyChild(schoolId: string, parentUserId: string) {
    const children = await this.prisma.studentParent.findMany({
      where: { userId: parentUserId, student: { schoolId, isActive: true } },
      select: { studentId: true },
    });
    const childIds = children.map((c) => c.studentId);
    if (!childIds.length) return [];
    return this.prisma.partyInvitation.findMany({
      where: { schoolId, birthdayStudentId: { in: childIds } },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listReceived(schoolId: string, parentUserId: string) {
    const myChildren = await this.prisma.student.findMany({
      where: { schoolId, isActive: true, parents: { some: { userId: parentUserId } } },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    const childIds = myChildren.map((c) => c.id);
    if (!childIds.length) return [];
    const byId = new Map(myChildren.map((c) => [c.id, c]));

    const rows = await this.prisma.partyInvitation.findMany({
      where: { schoolId, sentAt: { not: null } },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { sentAt: 'desc' },
    });

    return rows.flatMap((r) => {
      const recipients = Array.isArray(r.recipientStudentIds) ? r.recipientStudentIds as string[] : [];
      const forMyChildren = recipients
        .map((id) => byId.get(id))
        .filter((child): child is { id: string; fullName: string; avatarUrl: string | null } => Boolean(child));
      if (!forMyChildren.length) return [];
      const { recipientStudentIds: _hiddenIds, ...safeRow } = r as typeof r & { recipientStudentIds?: unknown };
      return [{ ...safeRow, forMyChildren }];
    });
  }
}
