import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isSchoolLead } from '../../common/school-lead';

const userCard = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class MessagesService {
  private readonly typing = new Map<string, Map<string, { name: string; at: number }>>();

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async getConversations(userId: string, schoolId: string, role?: string | null) {
    const rows = await this.withConversationColumns(() => this.prisma.conversation.findMany({
      where: {
        schoolId,
        ...(role === 'owner' ? {} : { participants: { some: { userId } } }),
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
    }));

    const visible = role === 'owner'
      ? rows
      : role === 'school_admin'
        ? rows.filter((row) => this.visibleToAdmin(row.participants))
        : role === 'teacher'
          ? rows.filter((row) => this.visibleToTeacher(row.participants, userId))
          : rows;
    const shown = visible.filter((row) => this.revealed(this.hiddenAt(row.participants, userId), row.messages[0]?.sentAt));

    const sorted = shown.sort((a, b) => {
      const aTime = a.messages[0]?.sentAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.messages[0]?.sentAt?.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });
    const parentIds = [...new Set(sorted.flatMap((row) => row.participants.map((person) => person.userId)))];
    const labels = await this.labelsForParents(schoolId, parentIds);
    return sorted.map((row) => {
      const latest = row.messages[0];
      const mine = row.participants.find((person) => person.userId === userId);
      const unread = !!mine
        && !!latest
        && latest.senderId !== userId
        && (!mine.lastReadAt || latest.sentAt > mine.lastReadAt);
      return {
        ...row,
        unread,
        startedByMe: row.createdById === userId,
        about: row.participants.flatMap((person) => labels.get(person.userId) ?? []),
      };
    });
  }

  async unreadCount(userId: string, schoolId: string, role?: string | null) {
    const rows = await this.withConversationColumns(() => this.prisma.conversation.findMany({
      where: { schoolId, ...(role === 'owner' ? {} : { participants: { some: { userId } } }) },
      select: {
        participants: {
          select: {
            userId: true,
            lastReadAt: true,
            hiddenAt: true,
            user: {
              select: {
                schoolMemberships: {
                  where: { schoolId, isActive: true },
                  select: { role: true },
                },
              },
            },
          },
        },
        messages: {
          where: { isDeleted: false, senderId: { not: userId } },
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { sentAt: true },
        },
      },
    }));
    const visible = role === 'owner'
      ? rows
      : role === 'school_admin'
        ? rows.filter((row) => this.visibleToAdmin(row.participants))
        : role === 'teacher'
          ? rows.filter((row) => this.visibleToTeacher(row.participants, userId))
          : rows;
    return visible.filter((row) => {
      const latest = row.messages[0]?.sentAt;
      if (!latest || !this.revealed(this.hiddenAt(row.participants, userId), latest)) return false;
      const mine = row.participants.find((person) => person.userId === userId);
      if (!mine) return false;
      return !mine.lastReadAt || latest > mine.lastReadAt;
    }).length;
  }

  async broadcast(schoolId: string, senderId: string, role: string | null, userIds: string[], body?: string) {
    if (!isSchoolLead(role)) throw new ForbiddenException();
    const text = (body ?? '').trim();
    if (!text) throw new BadRequestException('Το μήνυμα είναι κενό');
    const ids = [...new Set(userIds.filter(Boolean))].slice(0, 400);
    if (!ids.length) throw new BadRequestException('Διάλεξε τουλάχιστον έναν γονέα');
    let sent = 0;
    for (const id of ids) {
      if (!(await this.isParent(schoolId, id))) continue;
      const conversation = await this.openScoped(schoolId, senderId, role, 'admin', id);
      await this.sendMessage(conversation.id, senderId, text);
      sent += 1;
    }
    return { sent };
  }

  async contacts(userId: string, schoolId: string, role?: string | null) {
    if (role === 'parent') return this.parentContacts(userId, schoolId);
    if (role === 'teacher') {
      return {
        admins: await this.schoolAdmins(schoolId, userId),
        teachers: [],
        parents: await this.parentsOfTeacher(userId, schoolId),
      };
    }
    if (isSchoolLead(role)) {
      return { admins: [], teachers: await this.schoolTeachers(schoolId), parents: await this.schoolParents(schoolId) };
    }
    return { admins: [], teachers: [], parents: [] };
  }

  async openScoped(schoolId: string, userId: string, role: string | null, kind: string, withUserId?: string) {
    if (kind === 'admin') {
      const admins = await this.adminUserIds(schoolId);
      if (!admins.length) throw new NotFoundException('Δεν υπάρχει διαχειριστής');
      if (isSchoolLead(role)) {
        if (!withUserId) throw new ForbiddenException();
        const [parent, teacher] = await Promise.all([
          this.isParent(schoolId, withUserId),
          this.isTeacher(schoolId, withUserId),
        ]);
        if (!parent && !teacher) throw new ForbiddenException('Μπορείς να στείλεις σε γονέα ή εκπαιδευτικό');
        const ids = role === 'owner' ? [userId, withUserId] : [withUserId, ...admins];
        return this.findOrCreate(schoolId, ids, userId);
      }
      if (role !== 'parent' && role !== 'teacher') throw new ForbiddenException();
      return this.findOrCreate(schoolId, [userId, ...admins], userId);
    }

    if (kind === 'teacher') {
      if (!withUserId) throw new ForbiddenException();
      const parentId = role === 'teacher' ? withUserId : userId;
      const teacherId = role === 'teacher' ? userId : withUserId;
      if (role !== 'teacher' && role !== 'parent') throw new ForbiddenException();
      const allowed = await this.teacherTeachesParentChild(schoolId, teacherId, parentId);
      if (!allowed) throw new ForbiddenException('Η συνομιλία είναι μόνο με τη δασκάλα του παιδιού');
      return this.findOrCreate(schoolId, [parentId, teacherId], userId);
    }

    throw new ForbiddenException();
  }

  async getOrCreateConversation(schoolId: string, participantIds: string[], createdById: string) {
    const unique = [...new Set(participantIds)].filter(Boolean);
    if (unique.length < 2) throw new ForbiddenException();
    return this.findOrCreate(schoolId, unique, createdById);
  }

  async getMessages(conversationId: string, userId: string, cursor?: string, take = 30) {
    const participant = await this.assertCanRead(conversationId, userId);
    const size = Number(take);
    const limit = Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 30;
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        ...(participant.hiddenAt ? { sentAt: { gt: participant.hiddenAt } } : {}),
      },
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
      await this.prisma.notification.updateMany({
        where: {
          userId,
          type: 'message',
          isRead: false,
          data: { path: ['conversationId'], equals: conversationId },
        },
        data: { isRead: true },
      });
    } catch {
      // A failed read-receipt must not hide the messages.
    }

    return messages.reverse();
  }

  async sendMessage(conversationId: string, senderId: string, body?: string, mediaUrl?: string) {
    await this.assertCanRead(conversationId, senderId);
    await this.ensureParticipant(conversationId, senderId);
    const text = (body ?? '').trim();
    const image = mediaUrl?.trim() || '';
    if (!text && !image) throw new BadRequestException('Το μήνυμα είναι κενό');
    const created = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        body: text || null,
        ...(image ? { mediaUrl: image } : {}),
      },
      include: { sender: { select: userCard } },
    });
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { schoolId: true, participants: { select: { userId: true } } },
    });
    if (conversation) {
      const senderName = created.sender?.fullName || 'Νέο μήνυμα';
      const viewingSince = new Date(Date.now() - 12_000);
      const presence = await this.prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true, lastReadAt: true },
      });
      const away = presence
        .map((person) => person.userId)
        .filter((id) => id !== senderId)
        .filter((id) => {
          const seen = presence.find((person) => person.userId === id)?.lastReadAt;
          return !seen || seen < viewingSince;
        });
      await this.notifications.notifyUsers(
        conversation.schoolId,
        away,
        {
          event: 'new_message',
          type: 'message',
          title: senderName,
          body: text || 'Σου έστειλε μια εικόνα',
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

  async removeConversation(schoolId: string, conversationId: string, userId: string, scope: 'everyone' | 'me') {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, schoolId },
      include: {
        participants: { select: { userId: true } },
        messages: { orderBy: { sentAt: 'asc' }, take: 1, select: { senderId: true } },
      },
    });
    if (!conversation) throw new NotFoundException();
    if (!conversation.participants.some((person) => person.userId === userId)) {
      throw new ForbiddenException('Δεν συμμετέχεις σε αυτή τη συνομιλία');
    }
    const starterId = conversation.createdById ?? conversation.messages[0]?.senderId ?? null;
    if (scope === 'everyone') {
      if (starterId !== userId) {
        throw new ForbiddenException('Μόνο όποιος ξεκίνησε τη συνομιλία μπορεί να τη σβήσει για όλους');
      }
      await this.prisma.notification.deleteMany({
        where: { type: 'message', data: { path: ['conversationId'], equals: conversationId } },
      });
      await this.prisma.conversation.delete({ where: { id: conversationId } });
      return { deleted: 'everyone' };
    }
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { hiddenAt: new Date() },
    });
    await this.prisma.notification.deleteMany({
      where: { userId, type: 'message', data: { path: ['conversationId'], equals: conversationId } },
    });
    return { deleted: 'me' };
  }

  private hiddenAt(participants: { userId: string; hiddenAt?: Date | null }[], userId: string) {
    return participants.find((person) => person.userId === userId)?.hiddenAt ?? null;
  }

  private revealed(hiddenAt: Date | null, latest?: Date | null) {
    if (!hiddenAt) return true;
    return !!latest && latest > hiddenAt;
  }

  private visibleToTeacher(
    participants: { userId: string; user?: { schoolMemberships?: { role: string }[] } | null }[],
    userId: string,
  ) {
    const others = participants.filter((person) => person.userId !== userId);
    if (!others.length) return false;
    return others.every((person) => {
      const roles = person.user?.schoolMemberships?.map((row) => row.role) ?? [];
      if (roles.includes('parent') || roles.includes('school_admin')) return true;
      if (!roles.length) return true;
      return !roles.includes('teacher');
    });
  }

  private visibleToAdmin(participants: { user: { schoolMemberships: { role: string }[] } }[]) {
    const rolesOf = (member: { schoolMemberships: { role: string }[] }) => member.schoolMemberships.map((row) => row.role);
    const hasAdmin = participants.some((person) => rolesOf(person.user).includes('school_admin'));
    const outsider = participants.some((person) => {
      const roles = rolesOf(person.user);
      return (roles.includes('parent') || roles.includes('teacher')) && !roles.includes('school_admin');
    });
    return hasAdmin && outsider;
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
    const admins = await this.schoolAdmins(schoolId);
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
      admins,
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

  private async schoolAdmins(schoolId: string, exceptUserId?: string) {
    const admins = await this.prisma.schoolMember.findMany({
      where: { schoolId, role: 'school_admin', isActive: true },
      include: { user: { select: userCard } },
    });
    return this.uniquePeople(
      admins
        .filter((row) => row.user.id !== exceptUserId)
        .map((row) => ({ id: row.user.id, name: row.user.fullName })),
    );
  }

  private async adminUserIds(schoolId: string) {
    const admins = await this.prisma.schoolMember.findMany({
      where: { schoolId, role: 'school_admin', isActive: true },
      select: { userId: true },
    });
    return [...new Set(admins.map((row) => row.userId))];
  }

  private async schoolTeachers(schoolId: string) {
    const members = await this.prisma.schoolMember.findMany({
      where: { schoolId, role: 'teacher', isActive: true },
      include: { user: { select: userCard } },
    });
    return this.uniquePeople(members.map((row) => ({ id: row.user.id, name: row.user.fullName })))
      .sort((a, b) => a.name.localeCompare(b.name, 'el'));
  }

  private async isTeacher(schoolId: string, userId: string) {
    const member = await this.prisma.schoolMember.findFirst({
      where: { schoolId, userId, role: 'teacher', isActive: true },
      select: { userId: true },
    });
    return !!member;
  }

  private async isParent(schoolId: string, userId: string) {
    const link = await this.prisma.studentParent.findFirst({
      where: { userId, student: { schoolId } },
      select: { userId: true },
    });
    if (link) return true;
    const member = await this.prisma.schoolMember.findFirst({
      where: { schoolId, userId, role: 'parent', isActive: true },
      select: { userId: true },
    });
    return !!member;
  }

  private async teacherTeachesParentChild(schoolId: string, teacherId: string, parentId: string) {
    const childOf = { schoolId, isActive: true, parents: { some: { userId: parentId } } };
    const taughtBy = { class: { teachers: { some: { userId: teacherId } } } };
    const current = await this.prisma.classEnrollment.findFirst({
      where: { academicYear: { isCurrent: true }, student: childOf, ...taughtBy },
      select: { id: true },
    });
    if (current) return true;
    const anyCurrent = await this.prisma.classEnrollment.findFirst({
      where: { academicYear: { isCurrent: true }, student: childOf },
      select: { id: true },
    });
    if (anyCurrent) return false;
    const earlier = await this.prisma.classEnrollment.findFirst({
      where: { student: childOf, ...taughtBy },
      select: { id: true },
    });
    return !!earlier;
  }

  private async findOrCreate(schoolId: string, userIds: string[], createdById: string) {
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
        createdById,
        participants: { create: unique.map((id) => ({ userId: id })) },
      },
      include: {
        participants: { include: { user: { select: userCard } } },
      },
    });
  }

  private async assertParticipant(conversationId: string, userId: string) {
    return this.assertCanRead(conversationId, userId);
  }

  private async assertCanRead(conversationId: string, userId: string) {
    const participant = await this.withConversationColumns(() => this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    }));
    if (participant) return participant;
    const owner = await this.ownerMembership(conversationId, userId);
    if (!owner) throw new ForbiddenException('Not a participant');
    return { conversationId, userId, lastReadAt: null, hiddenAt: null };
  }

  // A missing `owner` enum value makes this filter throw. That is not a failed read.
  private async ownerMembership(conversationId: string, userId: string) {
    try {
      return await this.prisma.schoolMember.findFirst({
        where: { userId, role: 'owner', isActive: true, school: { conversations: { some: { id: conversationId } } } },
        select: { id: true },
      });
    } catch (error) {
      const message = `${(error as { message?: string })?.message ?? error}`;
      if (/invalid input value for enum|22P02|"Role"/i.test(message)) return null;
      throw error;
    }
  }

  private async withConversationColumns<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!this.missingConversationColumn(error)) throw error;
      await this.prisma.ensureRuntimeSchema();
      return run();
    }
  }

  private missingConversationColumn(error: unknown) {
    const code = (error as { code?: string })?.code;
    const message = `${(error as { message?: string })?.message ?? error}`;
    return code === 'P2022' || /created_by_id|hidden_at/i.test(message);
  }

  private async ensureParticipant(conversationId: string, userId: string) {
    await this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId },
      update: {},
    });
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

  async pulseTyping(schoolId: string, conversationId: string, userId: string, active = true) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, schoolId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException();
    await this.assertParticipant(conversationId, userId);
    this.pruneTyping();
    const room = this.typing.get(conversationId) ?? new Map<string, { name: string; at: number }>();
    this.typing.set(conversationId, room);
    if (!active) {
      room.delete(userId);
      return { ok: true };
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    room.set(userId, { name: user?.fullName?.trim() || 'Κάποιος', at: Date.now() });
    return { ok: true };
  }

  async whoIsTyping(schoolId: string, userId: string) {
    this.pruneTyping();
    const mine = await this.prisma.conversationParticipant.findMany({
      where: { userId, conversation: { schoolId } },
      select: { conversationId: true },
    });
    const items: { conversationId: string; userId: string; name: string }[] = [];
    for (const row of mine) {
      const room = this.typing.get(row.conversationId);
      if (!room) continue;
      for (const [id, person] of room) {
        if (id === userId) continue;
        items.push({ conversationId: row.conversationId, userId: id, name: person.name });
      }
    }
    return items;
  }

  private pruneTyping() {
    const freshAfter = Date.now() - 4500;
    for (const [conversationId, room] of this.typing) {
      for (const [userId, person] of room) {
        if (person.at < freshAfter) room.delete(userId);
      }
      if (!room.size) this.typing.delete(conversationId);
    }
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
