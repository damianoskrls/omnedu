import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async getConversations(userId: string, schoolId: string) {
    return this.prisma.conversation.findMany({
      where: {
        schoolId,
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrCreateConversation(schoolId: string, participantIds: string[]) {
    const unique = [...new Set(participantIds)].sort();

    const existing = await this.prisma.conversation.findFirst({
      where: {
        schoolId,
        participants: { every: { userId: { in: unique } } },
        AND: [{ participants: { some: { userId: unique[0] } } }],
      },
      include: { participants: true },
    });

    if (existing && existing.participants.length === unique.length) return existing;

    return this.prisma.conversation.create({
      data: {
        schoolId,
        participants: {
          create: unique.map((userId) => ({ userId })),
        },
      },
      include: { participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } },
    });
  }

  async getMessages(conversationId: string, userId: string, cursor?: string, take = 30) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant');

    const messages = await this.prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { sentAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    return messages.reverse();
  }

  async sendMessage(conversationId: string, senderId: string, body: string, mediaUrl?: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant');

    return this.prisma.message.create({
      data: { conversationId, senderId, body, mediaUrl },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException();
    if (msg.senderId !== userId) throw new ForbiddenException();
    return this.prisma.message.update({ where: { id: messageId }, data: { isDeleted: true } });
  }
}
