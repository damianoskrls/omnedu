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

  async get(schoolId: string, id: string) {
    const row = await this.prisma.partyInvitation.findFirst({
      where: { id, schoolId },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    if (!row) throw new NotFoundException('Η πρόσκληση δεν βρέθηκε');
    const recipientIds = Array.isArray(row.recipientStudentIds) ? row.recipientStudentIds as string[] : [];
    const recipientStudents = recipientIds.length > 0
      ? await this.prisma.student.findMany({
          where: { id: { in: recipientIds }, schoolId },
          select: { id: true, fullName: true },
          orderBy: { fullName: 'asc' },
        })
      : [];
    return { ...row, recipientStudents };
  }

  async create(schoolId: string, data: {
    birthdayStudentId: string;
    title: string;
    body?: string;
    imageUrl?: string;
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
    const children = await this.prisma.studentParent.findMany({
      where: { userId: parentUserId, student: { schoolId, isActive: true } },
      select: { studentId: true },
    });
    const childIds = children.map((c) => c.studentId);
    if (!childIds.length) return [];

    const rows = await this.prisma.partyInvitation.findMany({
      where: { schoolId, sentAt: { not: null } },
      include: { birthdayStudent: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { sentAt: 'desc' },
    });

    return rows.filter((r) => {
      const recipients = Array.isArray(r.recipientStudentIds) ? r.recipientStudentIds as string[] : [];
      return childIds.some((cid) => recipients.includes(cid));
    });
  }
}
