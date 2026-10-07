import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const userCard = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async getConversations(userId: string, schoolId: string, role?: string | null) {
    const rows = await this.prisma.conversation.findMany({
      where: {
        schoolId,
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                ...userCard,
                schoolMemberships: {
                  where: { schoolId, isActive: true },
                  select: { role: true },
                },
              },
            },
          },
        },
        messages: {
          where: { isDeleted: false },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
    });

    const visible = role === 'school_admin'
      ? rows.filter((row) => this.visibleToAdmin(row.participants))
      : role === 'teacher'
        ? rows.filter((row) => this.visibleToTeacher(row.participants, userId))
        : rows;

    const sorted = visible.sort((a, b) => {
      const aTime = a.messages[0]?.sentAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.messages[0]?.sentAt?.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });
    const parentIds = [...new Set(sorted.flatMap((row) => row.participants.map((person) => person.userId)))];
    const labels = await this.labelsForParents(schoolId, parentIds);
    return sorted.map((row) => ({
      ...row,
      about: row.participants.flatMap((person) => labels.get(person.userId) ?? []),
    }));
  }

  async contacts(userId: string, schoolId: string, role?: string | null) {
    if (role === 'parent') return this.parentContacts(userId, schoolId);
    if (role === 'teacher') return { admins: [], teachers: [], parents: await this.parentsOfTeacher(userId, schoolId) };
    if (role === 'school_admin') return { admins: [], teachers: [], parents: await this.schoolParents(schoolId) };
    return { admins: [], teachers: [], parents: [] };
  }

  async openScoped(schoolId: string, userId: string, role: string | null, kind: string, withUserId?: string) {
    if (kind === 'admin') {
      const admins = await this.adminUserIds(schoolId);
      if (!admins.length) throw new NotFoundException('Δεν υπάρχει διαχειριστής');
      const parentId = role === 'school_admin' ? withUserId : userId;
      if (!parentId || !(await this.isParent(schoolId, parentId))) throw new ForbiddenException();
      if (role !== 'school_admin' && role !== 'parent') throw new ForbiddenException();
      return this.findOrCreate(schoolId, [parentId, ...admins]);
    }

    if (kind === 'teacher') {
      if (!withUserId) throw new ForbiddenException();
      const parentId = role === 'teacher' ? withUserId : userId;
      const teacherId = role === 'teacher' ? userId : withUserId;
      if (role !== 'teacher' && role !== 'parent') throw new ForbiddenException();
      const allowed = await this.teacherTeachesParentChild(schoolId, teacherId, parentId);
      if (!allowed) throw new ForbiddenException('Η συνομιλία είναι μόνο με τη δασκάλα του παιδιού');
      return this.findOrCreate(schoolId, [parentId, teacherId]);
    }

    throw new ForbiddenException();
  }

  async getOrCreateConversation(schoolId: string, participantIds: string[]) {
    const unique = [...new Set(participantIds)].filter(Boolean);
    if (unique.length < 2) throw new ForbiddenException();
    return this.findOrCreate(schoolId, unique);
  }

  async getMessages(conversationId: string, userId: string, cursor?: string, take = 30) {
    await this.assertParticipant(conversationId, userId);
    const size = Number(take);
    const limit = Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 30;
    const messages = await this.prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      include: { sender: { select: userCard } },
      orderBy: { sentAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    try {
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: new Date() },
      });
    } catch {
      // A failed read-receipt must not hide the messages.
    }

    return messages.reverse();
  }

  async sendMessage(conversationId: string, senderId: string, body: string, mediaUrl?: string) {
    await this.assertParticipant(conversationId, senderId);
    const text = (body ?? '').trim();
    if (!text) throw new BadRequestException('Το μήνυμα είναι κενό');
    const created = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        body: text,
        ...(mediaUrl ? { mediaUrl } : {}),
      },
      include: { sender: { select: userCard } },
    });
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { schoolId: true, participants: { select: { userId: true } } },
    });
    if (conversation) {
      const senderName = created.sender?.fullName || 'Νέο μήνυμα';
      await this.notifications.notifyUsers(
        conversation.schoolId,
        conversation.participants.map((person) => person.userId).filter((id) => id !== senderId),
        {
          event: 'new_message',
          type: 'message',
          title: senderName,
          body: text,
          data: { screen: 'message', conversationId, title: senderName },
        },
      );
    }
    return created;
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException();
    if (msg.senderId !== userId) throw new ForbiddenException();
    return this.prisma.message.update({ where: { id: messageId }, data: { isDeleted: true } });
  }

  private visibleToTeacher(
    participants: { userId: string; user: { schoolMemberships: { role: string }[] } }[],
    userId: string,
  ) {
    const others = participants.filter((person) => person.userId !== userId);
    if (!others.length) return false;
    return others.every((person) => {
      const roles = person.user.schoolMemberships.map((row) => row.role);
      if (roles.includes('parent')) return true;
      if (!roles.length) return true;
      return !roles.includes('school_admin') && !roles.includes('teacher');
    });
  }

  private visibleToAdmin(participants: { user: { schoolMemberships: { role: string }[] } }[]) {
    const rolesOf = (member: { schoolMemberships: { role: string }[] }) => member.schoolMemberships.map((row) => row.role);
    const hasParent = participants.some((person) => rolesOf(person.user).includes('parent'));
    const hasTeacherThread = participants.some((person) => {
      const roles = rolesOf(person.user);
      return roles.includes('teacher') && !roles.includes('school_admin');
    });
    return hasParent && !hasTeacherThread;
  }

  private async parentContacts(userId: string, schoolId: string) {
    const children = await this.prisma.student.findMany({
      where: { schoolId, isActive: true, parents: { some: { userId } } },
      select: {
        id: true,
        fullName: true,
        enrollments: {
          include: {
            academicYear: { select: { isCurrent: true } },
            class: {
              select: {
                name: true,
                teachers: { include: { user: { select: userCard } } },
              },
            },
          },
        },
      },
    });
    const admins = await this.prisma.schoolMember.findMany({
      where: { schoolId, role: 'school_admin', isActive: true },
      include: { user: { select: userCard } },
    });
    const teachers: { id: string; name: string; studentId: string; studentName: string; className: string }[] = [];
    const seen = new Set<string>();
    for (const child of children) {
      const current = child.enrollments.filter((row) => row.academicYear?.isCurrent);
      const enrollments = current.length ? current : child.enrollments;
      for (const enrollment of enrollments) {
        for (const teacher of enrollment.class?.teachers ?? []) {
          const key = `${teacher.user.id}:${child.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          teachers.push({
            id: teacher.user.id,
            name: teacher.user.fullName,
            studentId: child.id,
            studentName: child.fullName,
            className: enrollment.class?.name ?? '',
          });
        }
      }
    }
    return {
      admins: this.uniquePeople(admins.map((row) => ({ id: row.user.id, name: row.user.fullName }))),
      teachers,
      parents: [],
    };
  }

  private async schoolParents(schoolId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { student: { schoolId, isActive: true } },
      include: {
        user: { select: userCard },
        student: { select: { fullName: true } },
      },
    });
    const grouped = new Map<string, { id: string; name: string; students: string[] }>();
    for (const link of links) {
      const current = grouped.get(link.userId) ?? { id: link.userId, name: link.user.fullName, students: [] };
      if (!current.students.includes(link.student.fullName)) current.students.push(link.student.fullName);
      grouped.set(link.userId, current);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));
  }

  private async parentsOfTeacher(teacherId: string, schoolId: string) {
    const classes = await this.prisma.class.findMany({
      where: {
        schoolId,
        teachers: { some: { userId: teacherId } },
        academicYear: { isCurrent: true },
      },
      select: {
        name: true,
        enrollments: {
          select: {
            student: {
              select: {
                fullName: true,
                parents: { include: { user: { select: userCard } } },
              },
            },
          },
        },
      },
    });
    const grouped = new Map<string, { id: string; name: string; students: string[] }>();
    for (const klass of classes) {
      for (const enrollment of klass.enrollments) {
        for (const parent of enrollment.student.parents) {
          const current = grouped.get(parent.userId) ?? { id: parent.userId, name: parent.user.fullName, students: [] };
          const label = `${enrollment.student.fullName}${klass.name ? ` · ${klass.name}` : ''}`;
          if (!current.students.includes(label)) current.students.push(label);
          grouped.set(parent.userId, current);
        }
      }
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));
  }

  private async adminUserIds(schoolId: string) {
    const admins = await this.prisma.schoolMember.findMany({
      where: { schoolId, role: 'school_admin', isActive: true },
      select: { userId: true },
    });
    return [...new Set(admins.map((row) => row.userId))];
  }

  private async isParent(schoolId: string, userId: string) {
    const link = await this.prisma.studentParent.findFirst({
      where: { userId, student: { schoolId } },
      select: { userId: true },
    });
    return !!link;
  }

  private async teacherTeachesParentChild(schoolId: string, teacherId: string, parentId: string) {
    const match = await this.prisma.classEnrollment.findFirst({
      where: {
        student: { schoolId, isActive: true, parents: { some: { userId: parentId } } },
        class: { teachers: { some: { userId: teacherId } } },
      },
      select: { id: true },
    });
    return !!match;
  }

  private async findOrCreate(schoolId: string, userIds: string[]) {
    const unique = [...new Set(userIds)].filter(Boolean).sort();
    const candidates = await this.prisma.conversation.findMany({
      where: {
        schoolId,
        AND: unique.map((id) => ({ participants: { some: { userId: id } } })),
      },
      include: {
        participants: {
          include: { user: { select: userCard } },
        },
      },
    });
    const exact = candidates.find((row) => {
      const ids = row.participants.map((person) => person.userId).sort();
      return ids.length === unique.length && ids.every((id, index) => id === unique[index]);
    });
    if (exact) return exact;

    return this.prisma.conversation.create({
      data: {
        schoolId,
        participants: { create: unique.map((id) => ({ userId: id })) },
      },
      include: {
        participants: { include: { user: { select: userCard } } },
      },
    });
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant');
  }

  private async labelsForParents(schoolId: string, userIds: string[]) {
    const labels = new Map<string, { studentName: string; className: string }[]>();
    if (!userIds.length) return labels;
    const links = await this.prisma.studentParent.findMany({
      where: { userId: { in: userIds }, student: { schoolId, isActive: true } },
      select: {
        userId: true,
        student: {
          select: {
            fullName: true,
            enrollments: {
              orderBy: { academicYear: { startsOn: 'desc' } },
              take: 1,
              select: { class: { select: { name: true } } },
            },
          },
        },
      },
    });
    for (const link of links) {
      const list = labels.get(link.userId) ?? [];
      const item = {
        studentName: link.student.fullName,
        className: link.student.enrollments[0]?.class?.name ?? '',
      };
      if (!list.some((row) => row.studentName === item.studentName && row.className === item.className)) {
        list.push(item);
      }
      labels.set(link.userId, list);
    }
    return labels;
  }

  private uniquePeople(people: { id: string; name: string }[]) {
    const seen = new Set<string>();
    return people.filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    });
  }
}
