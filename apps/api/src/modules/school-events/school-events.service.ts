import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchoolEventsService {
  constructor(private prisma: PrismaService) {}

  async list(schoolId: string, status?: string) {
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
        status: status ?? 'draft',
        teachers: teacherIds?.length
          ? { create: (teacherIds as string[]).map((uid: string) => ({ userId: uid })) }
          : undefined,
      },
      include: {
        teachers: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });

    if (event.status === 'published' && resolvedClassIds.length) {
      await this.enrollStudentsForClasses(schoolId, event.id, resolvedClassIds);
    }

    return event;
  }

  async update(schoolId: string, eventId: string, dto: any) {
    const existing = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!existing) throw new NotFoundException('Event not found');

    const { title, description, eventType, eventDate, costPerChild, classIds, mediaUrls, teacherIds, status, audienceType, audienceIds } = dto;

    const wasPublished = existing.status === 'published';
    const becomesPublished = status === 'published' && !wasPublished;

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
        ...(status !== undefined && { status }),
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
        student: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateEnrollmentPayment(schoolId: string, eventId: string, enrollmentId: string, paid: boolean) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.schoolEventEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: paid ? 'paid' : 'pending_payment',
        paidAt: paid ? new Date() : null,
      },
    });
  }

  async adminUpdateEnrollmentStatus(schoolId: string, eventId: string, enrollmentId: string, status: string) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');

    const data: any = { status };
    if (status === 'paid') data.paidAt = new Date();
    if (status === 'consent_given' || status === 'pending_payment') data.parentConsentAt = new Date();
    return this.prisma.schoolEventEnrollment.update({ where: { id: enrollmentId }, data });
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

    const enrollments = await this.prisma.schoolEventEnrollment.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        event: {
          include: {
            postMedia: { orderBy: { createdAt: 'asc' } },
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

    return this.prisma.schoolEventEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: newStatus,
        parentConsentAt: new Date(),
      },
    });
  }

  // Post-event media (teacher upload)
  async listForTeacher(teacherUserId: string, schoolId: string) {
    return this.prisma.schoolEvent.findMany({
      where: {
        schoolId,
        teachers: { some: { userId: teacherUserId } },
      },
      include: {
        enrollments: {
          include: { student: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        postMedia: { orderBy: { createdAt: 'asc' } },
        teachers: { include: { user: { select: { id: true, fullName: true } } } },
      },
      orderBy: { eventDate: 'asc' },
    });
  }

  async addMedia(schoolId: string, eventId: string, userId: string, url: string, mediaType = 'image') {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.schoolEventMedia.create({
      data: { eventId, uploadedById: userId, url, mediaType },
    });
  }

  async removeMedia(schoolId: string, eventId: string, mediaId: string) {
    const event = await this.prisma.schoolEvent.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.schoolEventMedia.delete({ where: { id: mediaId } });
    return { success: true };
  }
}
