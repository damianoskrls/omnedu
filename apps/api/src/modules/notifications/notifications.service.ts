import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

interface BroadcastData {
  title: string;
  body: string;
  imageUrl?: string;
  targetType: 'all' | 'teachers' | 'parents' | 'class' | 'student';
  targetClassId?: string;
  targetStudentId?: string;
  channels?: string[]; // push | email | sms
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private fcmApp: admin.app.App | null = null;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    const projectId = this.config.get('firebase.projectId');
    const clientEmail = this.config.get('firebase.clientEmail');
    const privateKey = this.config.get('firebase.privateKey');
    if (projectId && clientEmail && privateKey) {
      try {
        this.fcmApp = admin.apps.find(a => a?.name === 'omnedu') ?? admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        }, 'omnedu');
      } catch {}
    }
  }

  async findAll(schoolId: string) {
    return this.prisma.notificationBroadcast.findMany({
      where: { schoolId },
      include: {
        sentBy: { select: { id: true, fullName: true } },
        targetClass: { select: { id: true, name: true } },
        targetStudent: { select: { id: true, fullName: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
  }

  async getSettings(schoolId: string) {
    return this.prisma.notificationSettings.upsert({
      where: { schoolId },
      create: {
        id: crypto.randomUUID(),
        schoolId,
        eventRules: {},
        defaultChannels: ['push'],
      },
      update: {},
    });
  }

  async updateSettings(schoolId: string, data: any) {
    return this.prisma.notificationSettings.upsert({
      where: { schoolId },
      create: {
        id: crypto.randomUUID(),
        schoolId,
        ...data,
      },
      update: data,
    });
  }

  async send(schoolId: string, sentByUserId: string, data: BroadcastData) {
    const channels = data.channels ?? ['push'];
    const userIds = await this.getTargetUserIds(schoolId, data);
    let recipientCount = 0;

    // ─── Push notifications ─────────────────────────────────
    if (channels.includes('push')) {
      const tokens = await this.getTargetTokens(userIds);
      if (tokens.length > 0 && this.fcmApp) {
        const chunks = this.chunkArray(tokens, 500);
        for (const chunk of chunks) {
          try {
            const res = await admin.messaging(this.fcmApp).sendEachForMulticast({
              tokens: chunk,
              notification: {
                title: data.title,
                body: data.body,
                ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
              },
              data: { type: 'broadcast', screen: 'inbox', schoolId },
              android: { priority: 'high', notification: { channelId: 'oneirochora' } },
            });
            recipientCount += res.successCount;
          } catch (e) {
            this.logger.error('FCM send error', e);
          }
        }
      } else {
        recipientCount = tokens.length;
      }
    }

    // ─── Email notifications ────────────────────────────────
    if (channels.includes('email')) {
      const emailCount = await this.sendEmails(schoolId, userIds, data);
      if (!channels.includes('push')) recipientCount = emailCount;
    }

    // ─── SMS notifications ──────────────────────────────────
    if (channels.includes('sms')) {
      const smsCount = await this.sendSms(schoolId, userIds, data);
      if (!channels.includes('push') && !channels.includes('email')) recipientCount = smsCount;
    }

    // Use userIds count as fallback for recipientCount
    if (recipientCount === 0) recipientCount = userIds.length;

    const broadcast = await this.prisma.notificationBroadcast.create({
      data: {
        id: crypto.randomUUID(),
        schoolId,
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl ?? null,
        targetType: data.targetType,
        targetClassId: data.targetClassId ?? null,
        targetStudentId: data.targetStudentId ?? null,
        sentByUserId,
        recipientCount,
        channels,
      },
      include: {
        sentBy: { select: { id: true, fullName: true } },
        targetClass: { select: { id: true, name: true } },
        targetStudent: { select: { id: true, fullName: true } },
      },
    });

    // In-app Notification rows
    if (userIds.length > 0) {
      await this.prisma.notification.createMany({
        data: userIds.map(userId => ({
          id: crypto.randomUUID(),
          schoolId,
          userId,
          type: 'broadcast',
          title: data.title,
          body: data.body,
          data: { screen: 'inbox' },
        })),
        skipDuplicates: true,
      });
    }

    return broadcast;
  }

  async registerDevice(userId: string, token: string, platform = 'android') {
    const value = token.trim();
    if (!value) return null;
    return this.prisma.fcmToken.upsert({
      where: { token: value },
      create: { id: crypto.randomUUID(), userId, token: value, platform },
      update: { userId, platform },
    });
  }

  async inbox(userId: string, schoolId: string) {
    return this.prisma.notification.findMany({
      where: { userId, schoolId },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, notificationId: string) {
    const row = await this.prisma.notification.findFirst({ where: { id: notificationId, userId } });
    if (!row) return null;
    return this.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  }

  async notifyStudentParents(
    schoolId: string,
    studentId: string,
    input: { event: string; type: string; title: string; body: string; data?: Record<string, string> },
  ) {
    const parents = await this.prisma.studentParent.findMany({
      where: { studentId, student: { schoolId } },
      select: { userId: true },
    });
    return this.notifyUsers(schoolId, parents.map((row) => row.userId), input);
  }

  async notifyUsers(
    schoolId: string,
    userIds: string[],
    input: { event: string; type: string; title: string; body: string; data?: Record<string, string> },
  ) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    try {
      const settings = await this.getSettings(schoolId);
      const rules = (settings.eventRules as Record<string, string[] | undefined>) ?? {};
      const channels = Array.isArray(rules[input.event]) ? rules[input.event] : ['push'];
      const data = { ...(input.data ?? {}), type: input.type, schoolId };
      await this.prisma.notification.createMany({
        data: ids.map((userId) => ({
          id: crypto.randomUUID(),
          schoolId,
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data,
        })),
      });
      if (channels.includes('push')) {
        await this.pushToUsers(ids, input.title, input.body, data);
      }
    } catch (error) {
      this.logger.error('Notification failed', error);
    }
  }

  private async pushToUsers(userIds: string[], title: string, body: string, data: Record<string, string>) {
    if (!this.fcmApp) return;
    const tokens = await this.getTargetTokens(userIds);
    if (!tokens.length) return;
    const payload = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')]));
    for (const chunk of this.chunkArray(tokens, 500)) {
      try {
        const res = await admin.messaging(this.fcmApp).sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data: payload,
          android: { priority: 'high', notification: { channelId: 'oneirochora' } },
        });
        const stale: string[] = [];
        res.responses.forEach((item, index) => {
          const code = item.error?.code ?? '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
            stale.push(chunk[index]);
          }
        });
        if (stale.length) await this.prisma.fcmToken.deleteMany({ where: { token: { in: stale } } });
      } catch (error) {
        this.logger.error('FCM send error', error);
      }
    }
  }

  // ─── Automatic / event-driven notifications ─────────────────────────────

  async sendSystemEvent(schoolId: string, event: string, userIds: string[], payload: { title: string; body: string }) {
    await this.notifyUsers(schoolId, userIds, {
      event,
      type: event,
      title: payload.title,
      body: payload.body,
      data: { screen: 'inbox' },
    });
  }

  // ─── Email stub (pluggable) ──────────────────────────────────────────────

  private async sendEmails(schoolId: string, userIds: string[], data: BroadcastData): Promise<number> {
    const settings = await this.prisma.notificationSettings.findUnique({ where: { schoolId } });
    const fromEmail = settings?.emailFrom ?? this.config.get('mail.from') ?? 'noreply@omnedu.gr';

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    });

    // Log for now — wire a real mail provider (SendGrid / SES / Brevo) here
    this.logger.log(`[EMAIL] Sending "${data.title}" from ${fromEmail} to ${users.length} recipients`);
    if (data.imageUrl) this.logger.log(`[EMAIL] Image: ${data.imageUrl}`);

    // TODO: integrate mail provider (SendGrid / AWS SES / Brevo)
    // await this.mailer.sendBulk(users.map(u => u.email), { from: fromEmail, subject: data.title, html: buildHtml(data) });

    return users.length;
  }

  // ─── SMS stub (pluggable) ────────────────────────────────────────────────

  private async sendSms(schoolId: string, userIds: string[], data: BroadcastData): Promise<number> {
    const settings = await this.prisma.notificationSettings.findUnique({ where: { schoolId } });

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, phone: { not: null } },
      select: { phone: true },
    });

    const phones = users.map(u => u.phone).filter(Boolean) as string[];
    this.logger.log(`[SMS] Sending "${data.title}" via ${settings?.smsSenderId ?? 'N/A'} to ${phones.length} numbers`);

    // TODO: integrate SMS provider (Twilio / Vonage / Yuboto for Greece)
    // const client = new SmsProvider(settings?.smsApiKey);
    // await Promise.all(phones.map(p => client.send({ to: p, from: settings.smsSenderId, body: data.body })));

    return phones.length;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async getTargetUserIds(schoolId: string, data: BroadcastData): Promise<string[]> {
    if (data.targetType === 'student' && data.targetStudentId) {
      const parents = await this.prisma.studentParent.findMany({
        where: { studentId: data.targetStudentId },
        select: { userId: true },
      });
      return parents.map(p => p.userId);
    }

    if (data.targetType === 'class' && data.targetClassId) {
      const enrollments = await this.prisma.classEnrollment.findMany({
        where: { classId: data.targetClassId },
        include: { student: { include: { parents: true } } },
      });
      const userIds = new Set<string>();
      for (const e of enrollments) {
        for (const sp of e.student.parents) userIds.add(sp.userId);
      }
      return [...userIds];
    }

    const roleFilter = data.targetType === 'teachers' ? { role: 'teacher' as const }
      : data.targetType === 'parents' ? { role: 'parent' as const }
      : {};

    const members = await this.prisma.schoolMember.findMany({
      where: { schoolId, isActive: true, ...roleFilter },
      select: { userId: true },
    });
    return members.map(m => m.userId);
  }

  private async getTargetTokens(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const tokens = await this.prisma.fcmToken.findMany({ where: { userId: { in: userIds } } });
    return tokens.map(t => t.token);
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }
}
