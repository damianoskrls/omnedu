import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, academicYearId?: string) {
    return this.prisma.class.findMany({
      where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
      include: {
        teachers: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        _count: { select: { enrollments: true } },
        academicYear: true,
        level: { select: { id: true, name: true, description: true } },
        instructions: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findByTeacher(schoolId: string, teacherUserId: string) {
    const include = {
      _count: { select: { enrollments: true } },
      academicYear: true,
    };
    const own = await this.prisma.class.findMany({
      where: { schoolId, teachers: { some: { userId: teacherUserId } } },
      include,
    });
    const today = athensToday();
    const covers = await this.prisma.teacherAbsence.findMany({
      where: {
        schoolId,
        substituteUserId: teacherUserId,
        date: { gte: new Date(`${today}T00:00:00.000Z`), lte: new Date(`${today}T23:59:59.999Z`) },
      },
      include: { teacher: { select: { fullName: true } } },
    });
    const absentIds = [...new Set(covers.map((row) => row.teacherUserId))];
    const covered = absentIds.length
      ? await this.prisma.class.findMany({
        where: {
          schoolId,
          academicYear: { isCurrent: true },
          teachers: { some: { userId: { in: absentIds } } },
        },
        include: { ...include, teachers: { select: { userId: true } } },
      })
      : [];
    const byId = new Map<string, Record<string, unknown>>();
    for (const cls of own) byId.set(cls.id, { ...cls, covering: null });
    for (const cls of covered) {
      const match = covers.find((row) => cls.teachers.some((teacher) => teacher.userId === row.teacherUserId));
      const covering = match
        ? { teacherName: match.teacher.fullName, reason: match.reason || match.note || '', date: today }
        : null;
      const existing = byId.get(cls.id);
      const { teachers: _teachers, ...rest } = cls;
      byId.set(cls.id, { ...(existing ?? rest), covering: covering ?? (existing?.covering ?? null) });
    }
    return [...byId.values()];
  }

  async findOne(id: string, schoolId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, schoolId },
      include: {
        teachers: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        enrollments: {
          include: { student: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
        academicYear: true,
        level: { select: { id: true, name: true, description: true } },
        parentMeetings: { orderBy: { meetingDate: 'asc' }, take: 10 },
        instructions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  // ── Class Instructions ──────────────────────────────────────

  async createInstruction(classId: string, schoolId: string, data: { title: string; content: string; category?: string; sortOrder?: number }) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException('Class not found');
    return this.prisma.classInstruction.create({ data: { classId, ...data } });
  }

  async updateInstruction(instructionId: string, classId: string, schoolId: string, data: { title?: string; content?: string; category?: string; sortOrder?: number }) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException('Class not found');
    return this.prisma.classInstruction.update({ where: { id: instructionId }, data });
  }

  async deleteInstruction(instructionId: string, classId: string, schoolId: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException('Class not found');
    return this.prisma.classInstruction.delete({ where: { id: instructionId } });
  }

  async create(schoolId: string, data: { name: string; academicYearId: string; levelId?: string; ageGroup?: string; capacity?: number }) {
    return this.prisma.class.create({ data: { schoolId, ...data } });
  }

  async assignTeacher(classId: string, userId: string, isPrimary = false) {
    return this.prisma.classTeacher.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId, isPrimary },
      update: { isPrimary },
    });
  }

  async getAcademicYears(schoolId: string) {
    return this.prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startsOn: 'desc' },
    });
  }

  async createAcademicYear(schoolId: string, data: { label: string; startsOn: string; endsOn: string; isCurrent?: boolean }) {
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({ where: { schoolId }, data: { isCurrent: false } });
    }
    return this.prisma.academicYear.create({
      data: { schoolId, ...data, startsOn: new Date(data.startsOn), endsOn: new Date(data.endsOn) },
    });
  }
}

function athensToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
