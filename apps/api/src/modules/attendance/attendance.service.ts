// Called by: attendance.controller.ts getForClass/save. No prior attendance service (glob attendance/** = 0).
// Schema R/W: attendance_records; R: students, class_enrollments, daily_reports, teacher_absences.
// User: «θελω ο εκπαιδευτικός οταν μπαινει στην εφαρμογη του να εχει και παρουσιολογιο»
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveAttendanceDto } from './dto/save-attendance.dto';

@Injectable()
export class AttendanceService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "attendance_records" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "class_id" TEXT NOT NULL,
        "student_id" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "status" TEXT NOT NULL,
        "marked_by_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_student_id_date_key" ON "attendance_records"("student_id", "date")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "attendance_records_school_id_class_id_date_idx" ON "attendance_records"("school_id", "class_id", "date")`,
    );
  }

  async getForClass(schoolId: string, classId: string, date: string, userId: string) {
    await this.assertCanMark(schoolId, classId, userId, date);
    const day = new Date(`${date}T00:00:00.000Z`);

    const students = await this.prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        enrollments: { some: { classId, academicYear: { isCurrent: true } } },
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        enrollments: {
          where: { classId },
          take: 1,
          select: { class: { select: { id: true, name: true } } },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: { schoolId, classId, date: day },
      select: { studentId: true, status: true, markedById: true, updatedAt: true },
    });
    const byStudent = new Map(records.map((r) => [r.studentId, r]));

    const reports = await this.prisma.dailyReport.findMany({
      where: {
        schoolId,
        reportDate: day,
        studentId: { in: students.map((s) => s.id) },
      },
      select: { studentId: true },
    });
    const reported = new Set(reports.map((r) => r.studentId));

    return {
      date,
      classId,
      students: students.map((s) => {
        const rec = byStudent.get(s.id);
        return {
          ...s,
          status: rec?.status ?? null,
          hasDailyReport: reported.has(s.id),
        };
      }),
      summary: {
        total: students.length,
        present: records.filter((r) => r.status === 'present').length,
        absent: records.filter((r) => r.status === 'absent').length,
        unmarked: students.length - records.length,
        reported: reported.size,
      },
    };
  }

  /** School-wide snapshot for a date: every current class with attendance counts. */
  async overview(schoolId: string, date: string, userId: string) {
    await this.assertSchoolStaff(schoolId, userId);
    const day = new Date(`${date}T00:00:00.000Z`);

    const classes = await this.prisma.class.findMany({
      where: { schoolId, academicYear: { isCurrent: true } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const enrollments = await this.prisma.classEnrollment.findMany({
      where: {
        classId: { in: classes.map((c) => c.id) },
        academicYear: { isCurrent: true },
        student: { schoolId, isActive: true },
      },
      select: { classId: true, studentId: true },
    });
    const byClass = new Map<string, string[]>();
    for (const e of enrollments) {
      const list = byClass.get(e.classId) ?? [];
      list.push(e.studentId);
      byClass.set(e.classId, list);
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { schoolId, date: day, classId: { in: classes.map((c) => c.id) } },
      select: { classId: true, studentId: true, status: true },
    });

    const reports = await this.prisma.dailyReport.findMany({
      where: {
        schoolId,
        reportDate: day,
        studentId: { in: enrollments.map((e) => e.studentId) },
      },
      select: { studentId: true },
    });
    const reported = new Set(reports.map((r) => r.studentId));

    let schoolPresent = 0;
    let schoolAbsent = 0;
    let schoolTotal = 0;
    let schoolReported = 0;
    let classesMarked = 0;

    const classRows = classes.map((klass) => {
      const studentIds = byClass.get(klass.id) ?? [];
      const classRecords = records.filter((r) => r.classId === klass.id);
      const present = classRecords.filter((r) => r.status === 'present').length;
      const absent = classRecords.filter((r) => r.status === 'absent').length;
      const total = studentIds.length;
      const unmarked = Math.max(0, total - classRecords.length);
      const classReported = studentIds.filter((id) => reported.has(id)).length;
      if (classRecords.length > 0) classesMarked += 1;
      schoolPresent += present;
      schoolAbsent += absent;
      schoolTotal += total;
      schoolReported += classReported;
      return {
        id: klass.id,
        name: klass.name,
        summary: {
          total,
          present,
          absent,
          unmarked,
          reported: classReported,
        },
        marked: classRecords.length > 0,
        complete: total > 0 && unmarked === 0,
      };
    });

    return {
      date,
      classes: classRows,
      schoolSummary: {
        totalStudents: schoolTotal,
        present: schoolPresent,
        absent: schoolAbsent,
        unmarked: Math.max(0, schoolTotal - schoolPresent - schoolAbsent),
        reported: schoolReported,
        classesMarked,
        classesTotal: classes.length,
      },
    };
  }

  async forStudent(
    schoolId: string,
    studentId: string,
    userId: string,
    from?: string,
    to?: string,
  ) {
    await this.assertSchoolStaff(schoolId, userId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, fullName: true },
    });
    if (!student) throw new NotFoundException('Ο μαθητής δεν βρέθηκε.');

    const where: {
      schoolId: string;
      studentId: string;
      date?: { gte?: Date; lte?: Date };
    } = { schoolId, studentId };
    if (from || to) {
      where.date = {
        ...(from && /^\d{4}-\d{2}-\d{2}$/.test(from)
          ? { gte: new Date(`${from}T00:00:00.000Z`) }
          : {}),
        ...(to && /^\d{4}-\d{2}-\d{2}$/.test(to)
          ? { lte: new Date(`${to}T00:00:00.000Z`) }
          : {}),
      };
    }

    const [present, absent, records] = await Promise.all([
      this.prisma.attendanceRecord.count({
        where: { ...where, status: 'present' },
      }),
      this.prisma.attendanceRecord.count({
        where: { ...where, status: 'absent' },
      }),
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          markedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { date: 'desc' },
        take: 400,
      }),
    ]);
    const total = present + absent;

    return {
      student,
      summary: {
        present,
        absent,
        total,
        absenceRate: total ? Math.round((absent / total) * 100) : 0,
      },
      records: records.map((r) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        class: r.class,
        markedBy: r.markedBy,
        updatedAt: r.updatedAt,
      })),
    };
  }

  async save(schoolId: string, userId: string, dto: SaveAttendanceDto) {
    await this.assertCanMark(schoolId, dto.classId, userId, dto.date);
    const day = new Date(`${dto.date}T00:00:00.000Z`);

    if (!dto.records?.length) {
      throw new BadRequestException('Πρέπει να σημάνεις τουλάχιστον έναν μαθητή.');
    }

    const enrolled = await this.prisma.classEnrollment.findMany({
      where: {
        classId: dto.classId,
        academicYear: { isCurrent: true },
        student: { schoolId, isActive: true },
      },
      select: { studentId: true },
    });
    const allowed = new Set(enrolled.map((e) => e.studentId));

    for (const entry of dto.records) {
      if (!allowed.has(entry.studentId)) {
        throw new ForbiddenException('Ο μαθητής δεν ανήκει σε αυτό το τμήμα.');
      }
    }

    // PUT is the full set for the class day: upsert marked, delete cleared.
    const markedIds = dto.records.map((r) => r.studentId);
    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.deleteMany({
        where: {
          schoolId,
          classId: dto.classId,
          date: day,
          ...(markedIds.length ? { studentId: { notIn: markedIds } } : {}),
        },
      });
      for (const entry of dto.records) {
        await tx.attendanceRecord.upsert({
          where: {
            studentId_date: { studentId: entry.studentId, date: day },
          },
          create: {
            schoolId,
            classId: dto.classId,
            studentId: entry.studentId,
            date: day,
            status: entry.status,
            markedById: userId,
          },
          update: {
            status: entry.status,
            classId: dto.classId,
            markedById: userId,
          },
        });
      }
    });

    return this.getForClass(schoolId, dto.classId, dto.date, userId);
  }

  private async assertSchoolStaff(schoolId: string, userId: string) {
    const member = await this.prisma.schoolMember.findFirst({
      where: {
        schoolId,
        userId,
        isActive: true,
        role: { in: ['owner', 'school_admin', 'teacher'] },
      },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('Δεν έχετε πρόσβαση στο παρουσιολόγιο.');
    }
  }

  private async assertCanMark(
    schoolId: string,
    classId: string,
    userId: string,
    date: string,
  ) {
    const klass = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: {
        id: true,
        teachers: { select: { userId: true } },
      },
    });
    if (!klass) throw new NotFoundException('Το τμήμα δεν βρέθηκε.');

    const teacherIds = klass.teachers.map((t) => t.userId);
    if (teacherIds.includes(userId)) return;

    const adminOrOwner = await this.prisma.schoolMember.findFirst({
      where: {
        schoolId,
        userId,
        role: { in: ['owner', 'school_admin'] },
        isActive: true,
      },
      select: { id: true },
    });
    if (adminOrOwner) return;

    if (teacherIds.length) {
      const cover = await this.prisma.teacherAbsence.findFirst({
        where: {
          schoolId,
          substituteUserId: userId,
          teacherUserId: { in: teacherIds },
          date: {
            gte: new Date(`${date}T00:00:00.000Z`),
            lte: new Date(`${date}T23:59:59.999Z`),
          },
        },
        select: { id: true },
      });
      if (cover) return;
    }

    throw new ForbiddenException(
      'Μπορείς να περάσεις παρουσιολόγιο μόνο για τα τμήματά σου ή όταν αντικαθιστάς.',
    );
  }
}
