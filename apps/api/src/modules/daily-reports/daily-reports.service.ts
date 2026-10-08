import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DailyReportsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async findByStudent(studentId: string, schoolId: string, limit = 30, parentUserId?: string, date?: string) {
    if (parentUserId) {
      const link = await this.prisma.studentParent.findFirst({
        where: { studentId, userId: parentUserId, student: { schoolId } },
      });
      if (!link) throw new ForbiddenException('Μπορείτε να δείτε μόνο τα δικά σας παιδιά.');
    }
    const take = Number(limit) > 0 ? Number(limit) : 30;
    const where: { studentId: string; schoolId: string; reportDate?: Date } = { studentId, schoolId };
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      where.reportDate = new Date(`${date}T00:00:00.000Z`);
    }
    return this.prisma.dailyReport.findMany({
      where,
      include: { media: true, teacher: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { reportDate: 'desc' },
      take,
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
    const reportDate = new Date(dto.reportDate);
    await this.assertCanReport(schoolId, teacherId, dto.studentId, reportDate);
    const existing = await this.prisma.dailyReport.findUnique({
      where: { studentId_reportDate: { studentId: dto.studentId, reportDate } },
      select: { id: true },
    });
    const saved = await this.prisma.dailyReport.upsert({
      where: {
        studentId_reportDate: {
          studentId: dto.studentId,
          reportDate,
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
    await this.tellParents(schoolId, dto.studentId, dto.reportDate, !existing);
    return saved;
  }

  private async tellParents(schoolId: string, studentId: string, reportDate: string, created: boolean) {
    const since = new Date(Date.now() - 2 * 60 * 1000);
    const recent = await this.prisma.notification.findFirst({
      where: { schoolId, type: 'daily_report', sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
    });
    const recentStudent = (recent?.data as { studentId?: string } | null)?.studentId;
    if (recent && recentStudent === studentId) return;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { fullName: true },
    });
    const day = reportDate.slice(0, 10).split('-').reverse().join('/');
    const name = student?.fullName ?? 'παιδιού';
    await this.notifications.notifyStudentParents(schoolId, studentId, {
      event: 'daily_report',
      type: 'daily_report',
      title: 'Ημερήσιο δελτίο',
      body: created
        ? `Το δελτίο του ${name} για ${day} είναι έτοιμο.`
        : `Το δελτίο του ${name} για ${day} ενημερώθηκε.`,
      data: {
        screen: 'bulletin',
        studentId,
        studentName: student?.fullName ?? '',
        date: reportDate.slice(0, 10),
      },
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

  private async assertCanReport(schoolId: string, teacherId: string, studentId: string, reportDate: Date) {
    const day = Number.isNaN(reportDate.getTime()) ? '' : reportDate.toISOString().slice(0, 10);
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { studentId, student: { schoolId, isActive: true }, academicYear: { isCurrent: true } },
      select: { class: { select: { teachers: { select: { userId: true } } } } },
    });
    const teacherIds = enrollment?.class.teachers.map((teacher) => teacher.userId) ?? [];
    if (teacherIds.includes(teacherId)) return;
    if (day && teacherIds.length) {
      const cover = await this.prisma.teacherAbsence.findFirst({
        where: {
          schoolId,
          substituteUserId: teacherId,
          teacherUserId: { in: teacherIds },
          date: { gte: new Date(`${day}T00:00:00.000Z`), lte: new Date(`${day}T23:59:59.999Z`) },
        },
        select: { id: true },
      });
      if (cover) return;
    }
    throw new ForbiddenException('Μπορείς να περάσεις ημερήσια ενημέρωση μόνο για τους μαθητές σου ή για την ημέρα που αντικαθιστάς.');
  }
}
