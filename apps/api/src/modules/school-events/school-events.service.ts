import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { athensTodayYmd, resolveEventStatus } from './event-status';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchoolEventsService implements OnModuleInit {
  private readonly logger = new Logger(SchoolEventsService.name);

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "recap" TEXT');
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error);
      if (!/already exists|duplicate/i.test(message)) this.logger.warn(`Event recap column: ${message}`);
    }
  }

  async list(schoolId: string, status?: string) {
    await this.syncAutomaticStatus(schoolId);
    return this.prisma.schoolEvent.findMany({
      where: { schoolId, ...(status ? { status } : {}) },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        teachers: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        _count: { select: { enrollments: true, postMedia: true } },
      },
      orderBy: { eventDate: 'asc' },
    });
  }

  async get(schoolId: string, eventId: string) {
    await this.syncAutomaticStatus(schoolId);
    const event = await this.prisma.schoolEvent.findFirst({
      where: { id: eventId, schoolId },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        teachers: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        enrollments: {
          include: {
            student: { select: { id: true, fullName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        postMedia: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(schoolId: string, userId: string, dto: any) {
    const { title, description, eventType, eventDate, costPerChild, classIds, mediaUrls, teacherIds, status, audienceType, audienceIds } = dto;

    const resolvedClassIds = await this.resolveAudienceToClassIds(schoolId, audienceType, audienceIds, classIds);

    const event = await this.prisma.schoolEvent.create({
      data: {
        schoolId,
        createdById: userId,
        title,
        description,
        eventType: eventType ?? 'general',
        eventDate: eventDate ? new Date(eventDate) : null,
        costPerChild: costPerChild != null ? costPerChild : null,
        classIds: resolvedClassIds,
        audienceType: audienceType ?? 'all',
        audienceIds: JSON.stringify(audienceIds ?? []),
        mediaUrls: mediaUrls ?? [],
        status: resolveEventStatus(status, eventDate ? new Date(eventDate) : null),
        teachers: teacherIds?.length
          ? { create: (teacherIds as string[]).map((uid: string) => ({ userId: uid })) }
          : undefined,
      },
      include: {
        teachers: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });

    if ((event.status === 'published' || event.status === 'completed') && resolvedClassIds.length) {
      await this.enrollStudentsForClasses(schoolId, event.id, resolvedClassIds);
    }

    return event;
  }

  async update(schoolId: string, eventId: string, dto: any) {
    const existing = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!existing) throw new NotFoundException('Event not found');

    const { title, description, eventType, eventDate, costPerChild, classIds, mediaUrls, teacherIds, status, audienceType, audienceIds } = dto;

    const nextDate = eventDate !== undefined ? (eventDate ? new Date(eventDate) : null) : existing.eventDate;
    const nextStatus = resolveEventStatus(status, nextDate, existing.status);
    const wasPublished = existing.status === 'published' || existing.status === 'completed';
    const becomesPublished = (nextStatus === 'published' || nextStatus === 'completed') && !wasPublished;

    const resolvedClassIds = (audienceType !== undefined || audienceIds !== undefined)
      ? await this.resolveAudienceToClassIds(schoolId, audienceType, audienceIds, classIds)
      : classIds;

    const event = await this.prisma.schoolEvent.update({
      where: { id: eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(eventType !== undefined && { eventType }),
        ...(eventDate !== undefined && { eventDate: eventDate ? new Date(eventDate) : null }),
        ...(costPerChild !== undefined && { costPerChild }),
        ...(resolvedClassIds !== undefined && { classIds: resolvedClassIds }),
        ...(mediaUrls !== undefined && { mediaUrls }),
        status: nextStatus,
        ...(audienceType !== undefined && { audienceType }),
        ...(audienceIds !== undefined && { audienceIds: JSON.stringify(audienceIds) }),
        ...(teacherIds !== undefined && {
          teachers: {
            deleteMany: {},
            create: (teacherIds as string[]).map((uid: string) => ({ userId: uid })),
          },
        }),
      },
      include: {
        teachers: { include: { user: { select: { id: true, fullName: true } } } },
        _count: { select: { enrollments: true } },
      },
    });

    if (becomesPublished && resolvedClassIds?.length) {
      await this.enrollStudentsForClasses(schoolId, eventId, resolvedClassIds);
    }

    return event;
  }

  private async resolveAudienceToClassIds(
    schoolId: string,
    audienceType?: string,
    audienceIds?: string[],
    fallbackClassIds?: string[],
  ): Promise<string[]> {
    if (!audienceType || audienceType === 'all') {
      // Enroll all classes in the school
      const classes = await this.prisma.class.findMany({ where: { schoolId }, select: { id: true } });
      return classes.map(c => c.id);
    }
    if (audienceType === 'class') {
      return audienceIds ?? fallbackClassIds ?? [];
    }
    if (audienceType === 'level' && audienceIds?.length) {
      const classes = await this.prisma.class.findMany({
        where: { schoolId, levelId: { in: audienceIds } },
        select: { id: true },
      });
      return classes.map(c => c.id);
    }
    if (audienceType === 'teachers') {
      return []; // No student enrollment for teacher-only events
    }
    return fallbackClassIds ?? [];
  }

  async remove(schoolId: string, eventId: string) {
    const existing = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!existing) throw new NotFoundException('Event not found');
    await this.prisma.schoolEvent.delete({ where: { id: eventId } });
    return { success: true };
  }

  private async enrollStudentsForClasses(schoolId: string, eventId: string, classIds: string[]) {
    // Get active class enrollment for current academic year
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!academicYear) return;

    const enrollments = await this.prisma.classEnrollment.findMany({
      where: {
        classId: { in: classIds },
        academicYearId: academicYear.id,
      },
      select: { studentId: true },
    });

    const studentIds = [...new Set(enrollments.map(e => e.studentId))];

    // Upsert enrollments (avoid duplicates if called again)
    for (const studentId of studentIds) {
      await this.prisma.schoolEventEnrollment.upsert({
        where: { eventId_studentId: { eventId, studentId } },
        create: { eventId, studentId, status: 'pending_consent' },
        update: {},
      });
    }
  }

  // Enrollment management (admin)
  async getEnrollments(schoolId: string, eventId: string) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.schoolEventEnrollment.findMany({
      where: { eventId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            parents: {
              select: { userId: true, isPrimary: true, user: { select: { fullName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateEnrollmentPayment(
    schoolId: string,
    eventId: string,
    enrollmentId: string,
    paid: boolean,
    extra?: { paidAt?: string; notes?: string },
  ) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.schoolEventEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: paid ? 'paid' : 'pending_payment',
        paidAt: paid ? (extra?.paidAt ? new Date(extra.paidAt) : new Date()) : null,
        ...(extra?.notes ? { notes: extra.notes } : {}),
      },
    });
  }

  async adminUpdateEnrollmentStatus(schoolId: string, eventId: string, enrollmentId: string, status: string) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');

    const data: any = { status };
    if (status === 'paid') data.paidAt = new Date();
    if (status === 'consent_given' || status === 'pending_payment') data.parentConsentAt = new Date();
    const updated = await this.prisma.schoolEventEnrollment.update({
      where: { id: enrollmentId },
      data,
      include: { student: { select: { id: true, fullName: true } }, event: { select: { title: true } } },
    });
    if (status === 'pending_payment') {
      await this.notifications.notifyStudentParents(schoolId, updated.studentId, {
        event: 'payment_overdue',
        type: 'payment',
        title: 'Εκκρεμεί πληρωμή',
        body: `${updated.student.fullName}: ${updated.event.title}`,
        data: { screen: 'payments', studentId: updated.studentId },
      });
    }
    return updated;
  }

  // Parent: see events for their children
  async listForParent(parentUserId: string, schoolId: string) {
    const children = await this.prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        parents: { some: { userId: parentUserId } },
      },
      select: { id: true, fullName: true, avatarUrl: true },
    });

    const studentIds = children.map(c => c.id);

    await this.syncAutomaticStatus(schoolId);

    const enrollments = await this.prisma.schoolEventEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        event: { schoolId, status: { in: ['published', 'completed'] } },
      },
      include: {
        event: {
          include: {
            postMedia: { orderBy: { createdAt: 'asc' } },
            teachers: { include: { user: { select: { id: true, fullName: true } } } },
          },
        },
        student: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { event: { eventDate: 'asc' } },
    });

    return enrollments;
  }

  // Parent: give/decline consent
  async parentConsent(parentUserId: string, enrollmentId: string, consent: boolean) {
    const enrollment = await this.prisma.schoolEventEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: { include: { parents: true } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const isParent = enrollment.student.parents.some(p => p.userId === parentUserId);
    if (!isParent) throw new ForbiddenException();

    if (enrollment.status !== 'pending_consent') {
      throw new ForbiddenException('Consent already given');
    }

    const newStatus = consent
      ? (await this.prisma.schoolEvent.findUnique({ where: { id: enrollment.eventId }, select: { costPerChild: true } }))?.costPerChild
        ? 'pending_payment'
        : 'consent_given'
      : 'consent_declined';

    const updated = await this.prisma.schoolEventEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: newStatus,
        parentConsentAt: new Date(),
      },
    });
    if (newStatus === 'pending_payment') {
      const event = await this.prisma.schoolEvent.findUnique({
        where: { id: enrollment.eventId },
        select: { schoolId: true, title: true },
      });
      if (event) {
        await this.notifications.notifyStudentParents(event.schoolId, enrollment.studentId, {
          event: 'payment_overdue',
          type: 'payment',
          title: 'Εκκρεμεί πληρωμή',
          body: `${enrollment.student.fullName}: ${event.title}`,
          data: { screen: 'payments', studentId: enrollment.studentId },
        });
      }
    }
    return updated;
  }

  // Post-event media (teacher upload). Assigned teachers see the event; a school admin using the teacher app sees every published one.
  async listForTeacher(teacherUserId: string, schoolId: string) {
    await this.syncAutomaticStatus(schoolId);
    const admin = await this.prisma.schoolMember.findFirst({
      where: { schoolId, userId: teacherUserId, role: 'school_admin', isActive: true },
      select: { id: true },
    });
    return this.prisma.schoolEvent.findMany({
      where: {
        schoolId,
        status: { in: ['published', 'completed'] },
        ...(admin ? {} : { teachers: { some: { userId: teacherUserId } } }),
      },
      include: {
        enrollments: {
          include: { student: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        postMedia: { orderBy: { createdAt: 'asc' } },
        teachers: { include: { user: { select: { id: true, fullName: true } } } },
      },
      orderBy: { eventDate: 'desc' },
    });
  }

  async addMedia(schoolId: string, eventId: string, userId: string, url: string, mediaType = 'image') {
    const event = await this.prisma.schoolEvent.findFirst({
      where: { id: eventId, schoolId },
      include: { teachers: { select: { userId: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');

    const assigned = event.teachers.some(t => t.userId === userId) || event.createdById === userId;
    if (!assigned) {
      const admin = await this.prisma.schoolMember.findFirst({
        where: { schoolId, userId, role: 'school_admin', isActive: true },
        select: { id: true },
      });
      if (!admin) throw new ForbiddenException('Μόνο οι εκπαιδευτικοί της εκδήλωσης μπορούν να ανεβάσουν υλικό');
    }

    return this.prisma.schoolEventMedia.create({
      data: { eventId, uploadedById: userId, url, mediaType },
    });
  }

  async setRecap(schoolId: string, eventId: string, userId: string, recap: string, notify = false) {
    const event = await this.prisma.schoolEvent.findFirst({
      where: { id: eventId, schoolId },
      include: { teachers: { select: { userId: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    const assigned = event.teachers.some((teacher) => teacher.userId === userId) || event.createdById === userId;
    if (!assigned) {
      const admin = await this.prisma.schoolMember.findFirst({
        where: { schoolId, userId, role: 'school_admin', isActive: true },
        select: { id: true },
      });
      if (!admin) throw new ForbiddenException('Μόνο οι εκπαιδευτικοί της εκδήλωσης μπορούν να γράψουν την ανάρτηση');
    }
    const text = recap.trim();
    const updated = await this.prisma.schoolEvent.update({
      where: { id: eventId },
      data: { recap: text || null },
    });
    if (notify) {
      const enrollments = await this.prisma.schoolEventEnrollment.findMany({
        where: { eventId, status: { not: 'consent_declined' } },
        select: { student: { select: { parents: { select: { userId: true } } } } },
      });
      const parents = enrollments.flatMap((row) => row.student.parents.map((parent) => parent.userId));
      const preview = text.replace(/\s+/g, ' ').trim();
      await this.notifications.notifyUsers(schoolId, parents, {
        event: 'event_post',
        type: 'event_post',
        title: event.title,
        body: preview ? preview.slice(0, 180) : 'Νέες φωτογραφίες και βίντεο από την εκδήλωση.',
        data: { screen: 'events', eventId },
      });
    }
    return updated;
  }

  /** Published events become completed the day after they happen. Completed events with a future date go back to published. */
  private async syncAutomaticStatus(schoolId: string) {
    const cutoff = new Date(`${athensTodayYmd()}T00:00:00.000Z`);
    await this.prisma.schoolEvent.updateMany({
      where: { schoolId, status: 'published', eventDate: { lt: cutoff } },
      data: { status: 'completed' },
    });
    await this.prisma.schoolEvent.updateMany({
      where: {
        schoolId,
        status: 'completed',
        OR: [{ eventDate: null }, { eventDate: { gte: cutoff } }],
      },
      data: { status: 'published' },
    });
  }

  async removeMedia(schoolId: string, eventId: string, mediaId: string) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.schoolEventMedia.delete({ where: { id: mediaId } });
    return { success: true };
  }
}
