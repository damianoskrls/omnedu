import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const parentPushEvents = new Set([
  'new_message',
  'daily_report',
  'payment_overdue',
  'event_post',
  'school_event',
  'celebration',
  'school_post',
  'assignment',
  'thematic_plan',
  'parent_meeting',
  'parent_meeting_request',
  'parent_meeting_accepted',
  'teacher_absence',
  'questionnaire',
  'medication_consent',
  'medication_approved',
]);

interface BroadcastData {
  title: string;
  body: string;
  imageUrl?: string;
  targetType: 'all' | 'teachers' | 'parents' | 'class' | 'student';
  targetClassId?: string;
  targetStudentId?: string;
  channels?: string[]; // push | email | sms
  appType?: string;
  appScreen?: string;
  academicYear?: string;
  kind?: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private fcmApp: admin.app.App | null = null;

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe('ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS device_id TEXT');
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error);
      if (!/already exists|duplicate/i.test(message)) this.logger.warn(`FCM device column: ${message}`);
    }
  }

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
    const settings = await this.prisma.notificationSettings.upsert({
      where: { schoolId },
      create: {
        id: crypto.randomUUID(),
        schoolId,
        eventRules: {},
        defaultChannels: ['push'],
      },
      update: {},
    });
    const pushDevices = await this.prisma.fcmToken.count({
      where: { user: { schoolMemberships: { some: { schoolId, isActive: true } } } },
    });
    return { ...settings, pushConfigured: Boolean(this.fcmApp), pushDevices };
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
    let pushDevices = 0;
    let pushDelivered = 0;
    const appType = (data.appType || 'broadcast').trim().slice(0, 40) || 'broadcast';
    const screen = (data.appScreen || (appType === 'regulation' ? 'regulations' : 'inbox')).trim().slice(0, 40);
    const noticeBody = appType === 'regulation'
      ? this.regulationNotice(data.body, data.academicYear)
      : data.body;
    const preview = this.pushPreview(noticeBody);

    // ─── Push notifications ─────────────────────────────────
    if (channels.includes('push')) {
      const tokens = await this.getTargetTokens(userIds);
      pushDevices = tokens.length;
      if (tokens.length > 0 && this.fcmApp) {
        const chunks = this.chunkArray(tokens, 500);
        for (const chunk of chunks) {
          try {
            const res = await admin.messaging(this.fcmApp).sendEachForMulticast({
              tokens: chunk,
              notification: {
                title: data.title.slice(0, 120),
                body: preview,
                ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
              },
              data: {
                type: appType,
                screen,
                schoolId,
                title: data.title.slice(0, 120),
                body: preview,
                ...(data.academicYear ? { academicYear: data.academicYear.slice(0, 20) } : {}),
                ...(data.kind ? { kind: data.kind.slice(0, 20) } : {}),
                ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
              },
              android: {
                priority: 'high',
                collapseKey: 'oneirochora-broadcast',
                notification: { channelId: 'oneirochora', sound: 'default', tag: 'oneirochora-broadcast' },
              },
              apns: this.applePush(data.title.slice(0, 120), preview),
            });
            pushDelivered += res.successCount;
            recipientCount += res.successCount;
            this.logPushFailures(res);
          } catch (e) {
            this.logger.error('FCM send error', e);
          }
        }
      }
    }

    // ─── Email notifications ────────────────────────────────
    if (channels.includes('email')) {
      const emailCount = await this.sendEmails(schoolId, userIds, { ...data, body: noticeBody });
      if (!channels.includes('push')) recipientCount = emailCount;
    }

    // ─── SMS notifications ──────────────────────────────────
    if (channels.includes('sms')) {
      const smsCount = await this.sendSms(schoolId, userIds, { ...data, body: noticeBody });
      if (!channels.includes('push') && !channels.includes('email')) recipientCount = smsCount;
    }

    // Use userIds count as fallback for recipientCount
    if (recipientCount === 0) recipientCount = userIds.length;

    const broadcast = await this.prisma.notificationBroadcast.create({
      data: {
        id: crypto.randomUUID(),
        schoolId,
        title: data.title,
        body: noticeBody,
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
          type: appType,
          title: data.title,
          body: noticeBody,
          data: {
            screen,
            ...(data.academicYear ? { academicYear: data.academicYear } : {}),
            ...(data.kind ? { kind: data.kind } : {}),
            ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
          },
        })),
        skipDuplicates: true,
      });
    }

    return {
      ...broadcast,
      pushConfigured: Boolean(this.fcmApp),
      pushDevices,
      pushDelivered,
    };
  }

  async registerDevice(userId: string, token: string, platform = 'android', deviceId?: string) {
    const value = token.trim();
    if (!value) return null;
    const id = deviceId?.trim() || null;
    const row = await this.prisma.fcmToken.upsert({
      where: { token: value },
      create: { id: crypto.randomUUID(), userId, token: value, platform, deviceId: id },
      update: { userId, platform, deviceId: id },
    });
    if (id) {
      await this.prisma.fcmToken.deleteMany({
        where: {
          userId,
          platform,
          NOT: { token: value },
          OR: [{ deviceId: id }, { deviceId: null }],
        },
      });
    }
    return row;
  }

  async inbox(userId: string, schoolId: string, role?: string | null) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        schoolId,
        ...(role === 'driver' ? { type: 'message' } : {}),
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string, schoolId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, schoolId, isRead: false },
    });
    return { count };
  }

  async markAllRead(userId: string, schoolId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, schoolId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
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
    const userIds = [...new Set(parents.map((row) => row.userId))];
    return this.notifyUsers(schoolId, await this.onlyParents(schoolId, userIds), input);
  }

  private async onlyParents(schoolId: string, userIds: string[]) {
    if (!userIds.length) return [];
    const members = await this.prisma.schoolMember.findMany({
      where: { schoolId, userId: { in: userIds }, isActive: true },
      select: { userId: true, role: true },
    });
    const roles = new Map<string, Set<string>>();
    for (const row of members) {
      const set = roles.get(row.userId) ?? new Set<string>();
      set.add(row.role);
      roles.set(row.userId, set);
    }
    return userIds.filter((id) => {
      const set = roles.get(id);
      if (!set || set.size === 0) return true;
      return set.has('parent');
    });
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
      const channels = Array.isArray(rules[input.event]) ? [...rules[input.event]] : ['push'];
      if (parentPushEvents.has(input.event) && !channels.includes('push')) channels.push('push');
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

  private applePush(title: string, body: string): admin.messaging.ApnsConfig {
    return {
      headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      payload: {
        aps: {
          alert: { title: title.slice(0, 120), body: body.slice(0, 180) },
          sound: 'default',
        },
      },
    };
  }

  private logPushFailures(res: admin.messaging.BatchResponse) {
    const counts = new Map<string, number>();
    for (const item of res.responses) {
      const code = item.error?.code;
      if (!code || code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    if (counts.size) {
      this.logger.warn(`FCM failures: ${[...counts.entries()].map(([code, count]) => `${code} x${count}`).join(', ')}`);
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
          android: {
            priority: 'high',
            collapseKey: 'oneirochora-event',
            notification: { channelId: 'oneirochora', sound: 'default', tag: `oneirochora-${payload.type || 'event'}` },
          },
          apns: this.applePush(title, body),
        });
        this.logPushFailures(res);
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

  private regulationNotice(body: string, academicYear?: string) {
    const text = body.replace(/\s+/g, ' ').trim();
    const year = (academicYear || '').trim();
    const fallback = year
      ? `Ανέβηκε κανονισμός για το ${year}. Πάτα για να τον διαβάσεις.`
      : 'Ανέβηκε κανονισμός. Πάτα για να τον διαβάσεις.';
    if (!text || text.length > 220) return fallback;
    return text;
  }

  private pushPreview(body: string) {
    const text = body.replace(/\s+/g, ' ').trim();
    if (text.length <= 180) return text;
    return `${text.slice(0, 177)}...`;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }
}
