import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, type?: string) {
    return this.prisma.activity.findMany({
      where: { schoolId, isActive: true, ...(type ? { activityType: type } : {}) },
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
    return this.prisma.activity.create({ data: { schoolId, ...data } });
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
    const activity = await this.prisma.activity.findFirst({ where: { id, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activity.update({ where: { id }, data });
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

  async updateInstructor(instructorId: string, schoolId: string, data: { name?: string; title?: string; bio?: string; photoUrl?: string; isActive?: boolean }) {
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
