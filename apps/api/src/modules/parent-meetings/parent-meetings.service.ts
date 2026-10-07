import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class ParentMeetingsService implements OnModuleInit {
  private readonly logger = new Logger(ParentMeetingsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.ensureSchema();
  }

  private async ensureSchema() {
    const statements = [
      `ALTER TABLE parent_meetings ADD COLUMN IF NOT EXISTS teacher_user_id TEXT`,
      `ALTER TABLE parent_meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 15`,
      `ALTER TABLE parent_meetings ADD COLUMN IF NOT EXISTS window_start TEXT`,
      `ALTER TABLE parent_meetings ADD COLUMN IF NOT EXISTS window_end TEXT`,
      `CREATE TABLE IF NOT EXISTS parent_meeting_requests (
        id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        parent_user_id TEXT NOT NULL,
        slot_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT parent_meeting_requests_pkey PRIMARY KEY (id)
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS parent_meeting_requests_meeting_id_student_id_key ON parent_meeting_requests (meeting_id, student_id)`,
      `CREATE INDEX IF NOT EXISTS parent_meeting_requests_meeting_id_slot_time_idx ON parent_meeting_requests (meeting_id, slot_time)`,
    ];
    for (const sql of statements) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/already exists|duplicate/i.test(message)) this.logger.warn(`Parent meeting schema skipped: ${message}`);
      }
    }
  }

  async findAll(schoolId: string, user: JwtPayload, classId?: string, levelId?: string) {
    await this.ensureSchema();
    const allowed = await this.allowedClassIds(schoolId, user);
    if (classId && allowed && !allowed.includes(classId)) throw new ForbiddenException('Δεν έχεις πρόσβαση σε αυτή την τάξη.');
    const meetings = await this.prisma.parentMeeting.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : allowed ? { classId: { in: allowed } } : {}),
        ...(levelId ? { levelId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
        requests: {
          include: { student: { select: { id: true, fullName: true } }, parent: { select: { id: true, fullName: true } } },
          orderBy: { slotTime: 'asc' },
        },
      },
      orderBy: { meetingDate: 'asc' },
    });
    const parentView = user.role === 'parent' && !user.isSuperAdmin;
    return meetings.map((meeting) => this.present(meeting, parentView ? user.sub : null));
  }

  async create(schoolId: string, user: JwtPayload, data: any) {
    await this.ensureSchema();
    const title = String(data.title ?? '').trim();
    if (!title) throw new BadRequestException('Γράψε το θέμα της ενημέρωσης.');
    const meetingDate = this.parseDay(data.meetingDate);
    const classId = data.classId ? String(data.classId) : null;
    if (!classId) throw new BadRequestException('Διάλεξε τάξη.');
    await this.assertCanManage(schoolId, user, classId);
    const classRow = await this.prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!classRow) throw new NotFoundException('Η τάξη δεν βρέθηκε.');

    const durationMinutes = this.duration(data.durationMinutes);
    const windowStart = data.windowStart ? this.time(data.windowStart, 'Από') : null;
    const windowEnd = data.windowEnd ? this.time(data.windowEnd, 'Έως') : null;
    if (windowStart && windowEnd) {
      const slots = this.slots(windowStart, windowEnd, durationMinutes);
      if (!slots.length) throw new BadRequestException('Οι ώρες δεν χωράνε ούτε μία συνάντηση με αυτή τη διάρκεια.');
    }

    const meeting = await this.prisma.parentMeeting.create({
      data: {
        schoolId,
        title,
        description: data.description ? String(data.description) : null,
        meetingDate,
        classId,
        levelId: data.levelId ? String(data.levelId) : null,
        teacherUserId: user.role === 'teacher' ? user.sub : data.teacherUserId || user.sub,
        durationMinutes,
        windowStart,
        windowEnd,
      },
      include: { class: { select: { id: true, name: true } }, teacher: { select: { id: true, fullName: true } } },
    });

    const parents = await this.classParentIds(schoolId, classId);
    const day = this.dayLabel(meetingDate);
    const hours = windowStart && windowEnd ? ` Διάλεξε ώρα από ${windowStart} έως ${windowEnd}.` : '';
    await this.notifications.notifyUsers(schoolId, parents, {
      event: 'parent_meeting',
      type: 'parent_meeting',
      title: 'Ενημέρωση γονέων',
      body: `${classRow.name}: ${title} στις ${day}.${hours}`,
      data: { screen: 'parent_meeting', meetingId: meeting.id, classId, className: classRow.name },
    });
    return this.present({ ...meeting, requests: [] }, null);
  }

  async requestSlot(schoolId: string, user: JwtPayload, meetingId: string, data: { studentId?: string; slotTime?: string }) {
    const meeting = await this.meetingOrThrow(schoolId, meetingId);
    const slotTime = this.time(data.slotTime, 'Ώρα');
    const available = this.slots(meeting.windowStart, meeting.windowEnd, meeting.durationMinutes);
    if (!available.includes(slotTime)) throw new BadRequestException('Αυτή η ώρα δεν είναι διαθέσιμη.');
    const studentId = String(data.studentId ?? '');
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, userId: user.sub, student: { schoolId, isActive: true, enrollments: { some: { classId: meeting.classId ?? undefined } } } },
      include: { student: { select: { fullName: true } } },
    });
    if (!link) throw new ForbiddenException('Μπορείς να ζητήσεις ώρα μόνο για το παιδί σου.');
    const taken = await this.prisma.parentMeetingRequest.findFirst({
      where: { meetingId, slotTime, status: 'accepted', studentId: { not: studentId } },
    });
    if (taken) throw new BadRequestException('Η ώρα έχει ήδη κλείσει.');
    const existing = await this.prisma.parentMeetingRequest.findUnique({ where: { meetingId_studentId: { meetingId, studentId } } });
    if (existing?.status === 'accepted') throw new BadRequestException('Η συνάντηση έχει ήδη κλείσει.');

    const saved = existing
      ? await this.prisma.parentMeetingRequest.update({
          where: { id: existing.id },
          data: { slotTime, status: 'requested', parentUserId: user.sub },
        })
      : await this.prisma.parentMeetingRequest.create({
          data: { meetingId, studentId, parentUserId: user.sub, slotTime, status: 'requested' },
        });

    if (meeting.teacherUserId) {
      await this.notifications.notifyUsers(schoolId, [meeting.teacherUserId], {
        event: 'parent_meeting_request',
        type: 'parent_meeting_request',
        title: 'Αίτημα συνάντησης',
        body: `${link.student.fullName} ζήτησε ${slotTime} στις ${this.dayLabel(meeting.meetingDate)}.`,
        data: { screen: 'parent_meeting', meetingId, classId: meeting.classId ?? '', studentId },
      });
    }
    return saved;
  }

  async decide(schoolId: string, user: JwtPayload, meetingId: string, requestId: string, status: string) {
    if (status !== 'accepted' && status !== 'declined') throw new BadRequestException('Η απάντηση είναι αποδοχή ή απόρριψη.');
    const meeting = await this.meetingOrThrow(schoolId, meetingId);
    if (!meeting.classId) throw new BadRequestException('Η ενημέρωση δεν ανήκει σε τάξη.');
    await this.assertCanManage(schoolId, user, meeting.classId);
    const request = await this.prisma.parentMeetingRequest.findFirst({
      where: { id: requestId, meetingId },
      include: { student: { select: { fullName: true } } },
    });
    if (!request) throw new NotFoundException('Το αίτημα δεν βρέθηκε.');

    if (status === 'accepted') {
      const taken = await this.prisma.parentMeetingRequest.findFirst({
        where: { meetingId, slotTime: request.slotTime, status: 'accepted', id: { not: request.id } },
      });
      if (taken) throw new BadRequestException('Η ώρα έχει ήδη κλείσει για άλλον γονέα.');
      await this.prisma.parentMeetingRequest.updateMany({
        where: { meetingId, slotTime: request.slotTime, status: 'requested', id: { not: request.id } },
        data: { status: 'declined' },
      });
    }

    const saved = await this.prisma.parentMeetingRequest.update({ where: { id: request.id }, data: { status } });
    const teacherName = meeting.teacher?.fullName || 'τον εκπαιδευτικό';
    const day = this.dayLabel(meeting.meetingDate);
    await this.notifications.notifyUsers(schoolId, [request.parentUserId], {
      event: status === 'accepted' ? 'parent_meeting_accepted' : 'parent_meeting_request',
      type: status === 'accepted' ? 'parent_meeting_accepted' : 'parent_meeting',
      title: status === 'accepted' ? 'Η συνάντηση έκλεισε' : 'Η ώρα δεν είναι διαθέσιμη',
      body: status === 'accepted'
        ? `${request.student.fullName}: ${day} στις ${request.slotTime} με ${teacherName}.`
        : `Η ώρα ${request.slotTime} για ${request.student.fullName} δεν έγινε δεκτή. Διάλεξε άλλη.`,
      data: { screen: 'parent_meeting', meetingId, classId: meeting.classId, studentId: request.studentId },
    });
    return saved;
  }

  async update(id: string, schoolId: string, data: Partial<{ title: string; description: string; meetingDate: string }>) {
    const existing = await this.prisma.parentMeeting.findFirst({ where: { id, schoolId } });
    if (!existing) throw new NotFoundException('Η ενημέρωση δεν βρέθηκε.');
    return this.prisma.parentMeeting.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        meetingDate: data.meetingDate ? this.parseDay(data.meetingDate) : undefined,
      },
    });
  }

  async remove(id: string, schoolId: string) {
    const existing = await this.prisma.parentMeeting.findFirst({ where: { id, schoolId } });
    if (!existing) throw new NotFoundException('Η ενημέρωση δεν βρέθηκε.');
    await this.prisma.parentMeeting.delete({ where: { id } });
  }

  private present(meeting: any, parentUserId: string | null) {
    const slots = this.slots(meeting.windowStart, meeting.windowEnd, meeting.durationMinutes);
    const requests = (meeting.requests ?? []).map((request: any) => ({
      id: request.id,
      studentId: request.studentId,
      studentName: parentUserId && request.parentUserId !== parentUserId ? '' : request.student?.fullName ?? '',
      parentUserId: parentUserId && request.parentUserId !== parentUserId ? '' : request.parentUserId,
      parentName: parentUserId && request.parentUserId !== parentUserId ? '' : request.parent?.fullName ?? '',
      slotTime: request.slotTime,
      status: request.status,
      mine: parentUserId ? request.parentUserId === parentUserId : false,
    }));
    return { ...meeting, slots, requests };
  }

  private async meetingOrThrow(schoolId: string, id: string) {
    await this.ensureSchema();
    const meeting = await this.prisma.parentMeeting.findFirst({
      where: { id, schoolId },
      include: { teacher: { select: { id: true, fullName: true } } },
    });
    if (!meeting) throw new NotFoundException('Η ενημέρωση δεν βρέθηκε.');
    return meeting;
  }

  private async classParentIds(schoolId: string, classId: string) {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId, student: { schoolId, isActive: true } },
      select: { studentId: true },
    });
    const studentIds = [...new Set(enrollments.map((row) => row.studentId))];
    if (!studentIds.length) return [];
    const parents = await this.prisma.studentParent.findMany({
      where: { studentId: { in: studentIds } },
      select: { userId: true },
    });
    return [...new Set(parents.map((row) => row.userId))];
  }

  private async assertCanManage(schoolId: string, user: JwtPayload, classId: string) {
    if (user.isSuperAdmin || user.role === 'school_admin') return;
    if (user.role !== 'teacher') throw new ForbiddenException('Μόνο ο εκπαιδευτικός ή ο διαχειριστής δημιουργεί ενημέρωση.');
    const link = await this.prisma.classTeacher.findFirst({ where: { classId, userId: user.sub, class: { schoolId } } });
    if (!link) throw new ForbiddenException('Μπορείς να ορίσεις συνάντηση μόνο για τις τάξεις σου.');
  }

  private async allowedClassIds(schoolId: string, user: JwtPayload) {
    if (user.isSuperAdmin || user.role === 'school_admin') return null;
    if (user.role === 'teacher') {
      const rows = await this.prisma.classTeacher.findMany({
        where: { userId: user.sub, class: { schoolId } },
        select: { classId: true },
      });
      return rows.map((row) => row.classId);
    }
    const rows = await this.prisma.classEnrollment.findMany({
      where: { class: { schoolId }, student: { parents: { some: { userId: user.sub } }, isActive: true } },
      select: { classId: true },
    });
    return [...new Set(rows.map((row) => row.classId))];
  }

  private slots(start?: string | null, end?: string | null, duration = 15) {
    if (!start || !end || !TIME.test(start) || !TIME.test(end)) return [];
    const toMinutes = (value: string) => {
      const [hour, minute] = value.split(':').map(Number);
      return hour * 60 + minute;
    };
    const out: string[] = [];
    let cursor = toMinutes(start);
    const last = toMinutes(end);
    const step = Math.max(5, duration);
    while (cursor + step <= last && out.length < 40) {
      const hour = Math.floor(cursor / 60);
      const minute = cursor % 60;
      out.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      cursor += step;
    }
    return out;
  }

  private duration(value: unknown) {
    const minutes = Number(value ?? 15);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 60) throw new BadRequestException('Η διάρκεια είναι από 5 έως 60 λεπτά.');
    return Math.round(minutes);
  }

  private time(value: unknown, label: string) {
    const text = String(value ?? '').trim();
    if (!TIME.test(text)) throw new BadRequestException(`${label}: γράψε ώρα όπως 16:00.`);
    return text;
  }

  private parseDay(value: unknown) {
    const text = String(value ?? '').trim();
    const day = text.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Διάλεξε ημερομηνία.');
    return new Date(`${day}T12:00:00.000Z`);
  }

  private dayLabel(date: Date) {
    const iso = date.toISOString().slice(0, 10);
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }
}
