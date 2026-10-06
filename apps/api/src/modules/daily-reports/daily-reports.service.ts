import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';

@Injectable()
export class DailyReportsService {
  constructor(private prisma: PrismaService) {}

  async findByStudent(studentId: string, schoolId: string, limit = 30, parentUserId?: string) {
    if (parentUserId) {
      const link = await this.prisma.studentParent.findFirst({
        where: { studentId, userId: parentUserId, student: { schoolId } },
      });
      if (!link) throw new ForbiddenException('Μπορείτε να δείτε μόνο τα δικά σας παιδιά.');
    }
    return this.prisma.dailyReport.findMany({
      where: { studentId, schoolId },
      include: { media: true, teacher: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { reportDate: 'desc' },
      take: limit,
    });
  }

  async findByDate(schoolId: string, date: string) {
    return this.prisma.dailyReport.findMany({
      where: { schoolId, reportDate: new Date(date) },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        media: true,
      },
    });
  }

  async findForClass(classId: string, schoolId: string, date: string) {
    return this.prisma.dailyReport.findMany({
      where: {
        schoolId,
        reportDate: new Date(date),
        student: { enrollments: { some: { classId } } },
      },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        media: true,
      },
    });
  }

  async upsert(schoolId: string, teacherId: string, dto: CreateDailyReportDto) {
    return this.prisma.dailyReport.upsert({
      where: {
        studentId_reportDate: {
          studentId: dto.studentId,
          reportDate: new Date(dto.reportDate),
        },
      },
      create: {
        schoolId,
        teacherId,
        studentId: dto.studentId,
        reportDate: new Date(dto.reportDate),
        mealBreakfast: dto.mealBreakfast,
        mealLunch: dto.mealLunch,
        mealSnack: dto.mealSnack,
        napDurationMinutes: dto.napDurationMinutes,
        nap2DurationMinutes: dto.nap2DurationMinutes,
        bathroomCount: dto.bathroomCount ?? 0,
        diaperChanges: dto.diaperChanges ?? 0,
        activities: dto.activities ?? [],
        mood: dto.mood,
        notes: dto.notes,
      },
      update: {
        mealBreakfast: dto.mealBreakfast,
        mealLunch: dto.mealLunch,
        mealSnack: dto.mealSnack,
        napDurationMinutes: dto.napDurationMinutes,
        nap2DurationMinutes: dto.nap2DurationMinutes,
        bathroomCount: dto.bathroomCount,
        diaperChanges: dto.diaperChanges,
        activities: dto.activities,
        mood: dto.mood,
        notes: dto.notes,
      },
      include: { media: true },
    });
  }

  async bulkUpsert(schoolId: string, teacherId: string, reports: CreateDailyReportDto[]) {
    return Promise.all(reports.map((r) => this.upsert(schoolId, teacherId, r)));
  }

  async getParentFeed(parentUserId: string, schoolId: string, limit = 20) {
    return this.prisma.dailyReport.findMany({
      where: {
        schoolId,
        student: { parents: { some: { userId: parentUserId } } },
      },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        media: true,
        teacher: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { reportDate: 'desc' },
      take: limit,
    });
  }
}
