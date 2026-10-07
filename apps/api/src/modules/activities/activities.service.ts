import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivitiesService implements OnModuleInit {
  private readonly logger = new Logger(ActivitiesService.name);

  async onModuleInit() {
    await this.ensureActivityColumns();
  }

  private async ensureActivityColumns() {
    const statements = [
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "image_url" TEXT`,
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "audience_type" TEXT NOT NULL DEFAULT 'all'`,
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "audience_ids" TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "requirements" TEXT NOT NULL DEFAULT '[]'`,
    ];
    for (const sql of statements) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (error) {
        this.logger.warn(`Activity column check skipped: ${error}`);
      }
    }
  }

  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, type?: string) {
    const where = { schoolId, isActive: true, ...(type ? { activityType: type } : {}) };
    try {
      return await this.prisma.activity.findMany({
        where,
        include: {
          _count: { select: { registrations: true } },
          instructorLinks: {
            include: {
              instructor: {
                select: { id: true, name: true, title: true, bio: true, photoUrl: true },
              },
            },
          },
          scheduleSlots: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.warn(`Activity list fell back to the base columns: ${error}`);
      try {
        return await this.prisma.activity.findMany({ where, orderBy: { createdAt: 'desc' } });
      } catch (fallbackError) {
        this.logger.error(fallbackError);
        return this.listActivitiesRaw(schoolId, type);
      }
    }
  }

  /** Used when the database is behind the Prisma schema, so the page still opens. */
  private async listActivitiesRaw(schoolId: string, type?: string) {
    const rows = type
      ? await this.prisma.$queryRaw<any[]>`
          SELECT id, title, description, activity_type AS "activityType",
                 monthly_cost AS "monthlyCost", one_time_cost AS "oneTimeCost",
                 max_capacity AS "maxCapacity", starts_on AS "startsOn", ends_on AS "endsOn",
                 deadline, is_active AS "isActive", created_at AS "createdAt"
          FROM activities
          WHERE school_id = ${schoolId} AND is_active = true AND activity_type = ${type}
          ORDER BY created_at DESC`
      : await this.prisma.$queryRaw<any[]>`
          SELECT id, title, description, activity_type AS "activityType",
                 monthly_cost AS "monthlyCost", one_time_cost AS "oneTimeCost",
                 max_capacity AS "maxCapacity", starts_on AS "startsOn", ends_on AS "endsOn",
                 deadline, is_active AS "isActive", created_at AS "createdAt"
          FROM activities
          WHERE school_id = ${schoolId} AND is_active = true
          ORDER BY created_at DESC`;
    return rows.map((row) => ({
      ...row,
      monthlyCost: row.monthlyCost == null ? null : Number(row.monthlyCost),
      oneTimeCost: row.oneTimeCost == null ? null : Number(row.oneTimeCost),
      audienceType: 'all',
      audienceIds: '[]',
      requirements: '[]',
      imageUrl: null,
      scheduleSlots: [],
      instructorLinks: [],
      _count: { registrations: 0 },
    }));
  }

  async findOne(id: string, schoolId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { registrations: true } },
        instructorLinks: {
          include: {
            instructor: {
              select: { id: true, name: true, title: true, bio: true, photoUrl: true },
            },
          },
        },
        scheduleSlots: true,
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async create(schoolId: string, data: any) {
    await this.ensureActivityColumns();
    let activity;
    try {
      activity = await this.prisma.activity.create({ data: { schoolId, ...this.activityWriteData(data) } });
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException('Η δραστηριότητα δεν αποθηκεύτηκε. Έλεγξε τίτλο, κόστος και ημερομηνίες και δοκίμασε ξανά.');
    }
    try {
      await this.syncDetails(activity.id, schoolId, data);
      return await this.findOne(activity.id, schoolId);
    } catch (error) {
      this.logger.error(error);
      return activity;
    }
  }

  async register(activityId: string, studentId: string, parentId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity || !activity.isActive) throw new NotFoundException('Activity not available');

    if (activity.deadline && new Date() > activity.deadline) {
      throw new BadRequestException('Registration deadline has passed');
    }

    if (activity.maxCapacity) {
      const count = await this.prisma.activityRegistration.count({ where: { activityId } });
      if (count >= activity.maxCapacity) throw new BadRequestException('Activity is full');
    }

    return this.prisma.activityRegistration.upsert({
      where: { activityId_studentId: { activityId, studentId } },
      create: { activityId, studentId, parentId, status: 'pending' },
      update: { status: 'pending' },
    });
  }

  async cancelRegistration(activityId: string, studentId: string) {
    return this.prisma.activityRegistration.updateMany({
      where: { activityId, studentId },
      data: { status: 'cancelled' },
    });
  }

  async getRegistrationsForParent(parentId: string, schoolId: string) {
    return this.prisma.activityRegistration.findMany({
      where: { parentId, activity: { schoolId } },
      include: {
        activity: true,
        student: { select: { id: true, fullName: true } },
      },
    });
  }

  async getRegistrations(activityId: string, schoolId: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id: activityId, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');

    return this.prisma.activityRegistration.findMany({
      where: { activityId },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        parent: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { registeredAt: 'desc' },
    });
  }

  async updateRegistrationStatus(registrationId: string, schoolId: string, status: string) {
    const reg = await this.prisma.activityRegistration.findFirst({
      where: { id: registrationId, activity: { schoolId } },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    return this.prisma.activityRegistration.update({
      where: { id: registrationId },
      data: { status },
    });
  }

  async adminEnroll(activityId: string, schoolId: string, studentId: string, notes?: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id: activityId, schoolId } });
    if (!activity || !activity.isActive) throw new NotFoundException('Activity not available');

    if (activity.maxCapacity) {
      const count = await this.prisma.activityRegistration.count({
        where: { activityId, status: 'approved' },
      });
      if (count >= activity.maxCapacity) throw new BadRequestException('Activity is full');
    }

    return this.prisma.activityRegistration.upsert({
      where: { activityId_studentId: { activityId, studentId } },
      create: { activityId, studentId, status: 'approved', enrolledByAdmin: true, notes: notes ?? null },
      update: { status: 'approved', enrolledByAdmin: true, notes: notes ?? undefined },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
  }

  async removeRegistration(registrationId: string, schoolId: string) {
    const reg = await this.prisma.activityRegistration.findFirst({
      where: { id: registrationId, activity: { schoolId } },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    return this.prisma.activityRegistration.delete({ where: { id: registrationId } });
  }

  async update(id: string, schoolId: string, data: any) {
    await this.ensureActivityColumns();
    const activity = await this.prisma.activity.findFirst({ where: { id, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');
    try {
      await this.prisma.activity.update({ where: { id }, data: this.activityWriteData(data) });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(error);
      throw new BadRequestException('Η δραστηριότητα δεν αποθηκεύτηκε. Έλεγξε τίτλο, κόστος και ημερομηνίες και δοκίμασε ξανά.');
    }
    if (data.scheduleSlots !== undefined || data.instructor !== undefined) {
      await this.syncDetails(id, schoolId, data);
    }
    return this.findOne(id, schoolId);
  }

  private activityWriteData(data: any) {
    const audienceIds = data.audienceIds === undefined
      ? undefined
      : typeof data.audienceIds === 'string'
        ? data.audienceIds
        : JSON.stringify(data.audienceIds ?? []);
    const dateOrNull = (value: unknown) => {
      if (!value) return null;
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const money = (value: unknown) => {
      if (value === '' || value == null) return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    return {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
      ...(data.activityType !== undefined && { activityType: data.activityType }),
      ...(data.monthlyCost !== undefined && { monthlyCost: money(data.monthlyCost) }),
      ...(data.oneTimeCost !== undefined && { oneTimeCost: money(data.oneTimeCost) }),
      ...(data.startsOn !== undefined && { startsOn: dateOrNull(data.startsOn) }),
      ...(data.endsOn !== undefined && { endsOn: dateOrNull(data.endsOn) }),
      ...(data.deadline !== undefined && { deadline: dateOrNull(data.deadline) }),
      ...(data.audienceType !== undefined && { audienceType: data.audienceType }),
      ...(audienceIds !== undefined && { audienceIds }),
      ...(data.requirements !== undefined && { requirements: JSON.stringify(this.cleanRequirements(data.requirements)) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
  }

  private cleanRequirements(value: unknown) {
    const rows = Array.isArray(value) ? value : [];
    return rows
      .map((row: any) => ({
        name: String(row?.name ?? '').trim(),
        cost: row?.cost === '' || row?.cost == null || !Number.isFinite(Number(row.cost)) ? null : Number(row.cost),
      }))
      .filter(row => row.name);
  }

  private async syncDetails(activityId: string, schoolId: string, data: any) {
    if (Array.isArray(data.scheduleSlots)) {
      await this.prisma.activityScheduleSlot.deleteMany({ where: { activityId } });
      const slots = data.scheduleSlots
        .filter((slot: any) => Number(slot?.dayOfWeek) >= 1 && Number(slot?.dayOfWeek) <= 7)
        .map((slot: any) => ({
          id: randomUUID(),
          activityId,
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
        }));
      if (slots.length > 0) await this.prisma.activityScheduleSlot.createMany({ data: slots });
    }

    if (data.instructor === undefined) return;
    const instructor = data.instructor;
    const name = String(instructor?.name ?? '').trim();
    if (!instructor || !name) {
      await this.prisma.activityInstructorAssignment.deleteMany({ where: { activityId } });
      return;
    }
    let instructorId = instructor.id as string | undefined;
    if (instructorId) {
      await this.updateInstructor(instructorId, schoolId, {
        name,
        title: instructor.title || null,
        bio: instructor.bio || null,
      });
    } else {
      const created = await this.createInstructor(schoolId, {
        name,
        title: instructor.title || undefined,
        bio: instructor.bio || undefined,
      });
      instructorId = created.id;
    }
    await this.prisma.activityInstructorAssignment.deleteMany({ where: { activityId } });
    await this.assignInstructor(activityId, instructorId, schoolId);
  }

  async remove(id: string, schoolId: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activity.update({ where: { id }, data: { isActive: false } });
  }

  // ── Schedule slots ───────────────────────────────────────

  async getSchedule(schoolId: string) {
    return this.prisma.activityScheduleSlot.findMany({
      where: { activity: { schoolId, isActive: true } },
      include: { activity: { select: { id: true, title: true, activityType: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async addScheduleSlot(activityId: string, schoolId: string, data: { dayOfWeek: number; startTime?: string; endTime?: string; notes?: string }) {
    const activity = await this.prisma.activity.findFirst({ where: { id: activityId, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activityScheduleSlot.create({ data: { activityId, ...data } });
  }

  async deleteScheduleSlot(slotId: string, schoolId: string) {
    const slot = await this.prisma.activityScheduleSlot.findFirst({
      where: { id: slotId, activity: { schoolId } },
    });
    if (!slot) throw new NotFoundException('Schedule slot not found');
    return this.prisma.activityScheduleSlot.delete({ where: { id: slotId } });
  }

  // ── Instructors ──────────────────────────────────────────

  async getInstructors(schoolId: string) {
    return this.prisma.activityInstructor.findMany({
      where: { schoolId, isActive: true },
      include: {
        activityLinks: { include: { activity: { select: { id: true, title: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createInstructor(schoolId: string, data: { name: string; title?: string; bio?: string; photoUrl?: string }) {
    return this.prisma.activityInstructor.create({ data: { schoolId, ...data } });
  }

  async updateInstructor(instructorId: string, schoolId: string, data: { name?: string; title?: string | null; bio?: string | null; photoUrl?: string; isActive?: boolean }) {
    const inst = await this.prisma.activityInstructor.findFirst({ where: { id: instructorId, schoolId } });
    if (!inst) throw new NotFoundException('Instructor not found');
    return this.prisma.activityInstructor.update({ where: { id: instructorId }, data });
  }

  async deleteInstructor(instructorId: string, schoolId: string) {
    const inst = await this.prisma.activityInstructor.findFirst({ where: { id: instructorId, schoolId } });
    if (!inst) throw new NotFoundException('Instructor not found');
    return this.prisma.activityInstructor.delete({ where: { id: instructorId } });
  }

  async assignInstructor(activityId: string, instructorId: string, schoolId: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id: activityId, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activityInstructorAssignment.upsert({
      where: { instructorId_activityId: { instructorId, activityId } },
      create: { instructorId, activityId },
      update: {},
    });
  }

  async unassignInstructor(activityId: string, instructorId: string, schoolId: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id: activityId, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activityInstructorAssignment.deleteMany({ where: { activityId, instructorId } });
  }
}
