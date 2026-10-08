import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const requestInclude = {
  student: { select: { id: true, fullName: true, avatarUrl: true } },
  requestedBy: { select: { id: true, fullName: true } },
  acknowledgedBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class MedicationRequestsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async findAll(schoolId: string, studentId?: string, status?: string) {
    return this.prisma.medicationRequest.findMany({
      where: {
        schoolId,
        ...(studentId ? { studentId } : {}),
        ...(status ? { status } : {}),
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForParent(schoolId: string, parentUserId: string) {
    return this.prisma.medicationRequest.findMany({
      where: { schoolId, student: { parents: { some: { userId: parentUserId } } } },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForTeacher(schoolId: string, teacherUserId: string) {
    const studentIds = await this.teacherStudentIds(schoolId, teacherUserId);
    if (!studentIds.length) return [];
    const today = athensToday();
    return this.prisma.medicationRequest.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: 'approved',
        OR: [{ endDate: null }, { endDate: { gte: new Date(`${today}T00:00:00.000Z`) } }],
      },
      include: requestInclude,
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const req = await this.prisma.medicationRequest.findFirst({
      where: { id, schoolId },
      include: requestInclude,
    });
    if (!req) throw new NotFoundException('Medication request not found');
    return req;
  }

  async create(
    schoolId: string,
    requestedByUserId: string,
    data: {
      studentId: string;
      medicationName: string;
      dose: string;
      frequency: string;
      startDate: string;
      endDate?: string;
      reason?: string;
      doctorNotes?: string;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, schoolId },
      select: { id: true, fullName: true },
    });
    if (!student) throw new NotFoundException('Ο μαθητής δεν βρέθηκε');

    const created = await this.prisma.medicationRequest.create({
      data: {
        schoolId,
        requestedByUserId,
        studentId: data.studentId,
        medicationName: data.medicationName.trim(),
        dose: data.dose.trim(),
        frequency: data.frequency.trim(),
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        reason: data.reason?.trim() || null,
        doctorNotes: data.doctorNotes?.trim() || null,
        status: 'pending',
      },
      include: requestInclude,
    });

    const name = student.fullName;
    const instructions = data.doctorNotes?.trim();
    await this.notifications.notifyStudentParents(schoolId, student.id, {
      event: 'medication_consent',
      type: 'medication',
      title: 'Συναίνεση χορήγησης φαρμάκου',
      body: `Ζητείται η συναίνεσή σας: ο/η ${name} να παίρνει ${created.medicationName}, ${created.dose}, ${created.frequency}.${instructions ? ` Οδηγίες: ${instructions}` : ''}`,
      data: {
        screen: 'medications',
        requestId: created.id,
        studentId: student.id,
        studentName: name,
      },
    });

    return created;
  }

  async consent(id: string, schoolId: string, parentUserId: string, decision: 'approved' | 'rejected') {
    const req = await this.findOne(id, schoolId);
    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_userId: { studentId: req.studentId, userId: parentUserId } },
    });
    if (!link) throw new ForbiddenException('Μόνο ο γονέας του παιδιού μπορεί να δώσει συναίνεση');
    if (req.status !== 'pending') throw new ForbiddenException('Η συναίνεση έχει ήδη καταχωρηθεί');

    const saved = await this.prisma.medicationRequest.update({
      where: { id },
      data: { status: decision, acknowledgedAt: new Date(), acknowledgedByUserId: parentUserId },
      include: requestInclude,
    });

    if (decision === 'approved') {
      const teacherIds = await this.classTeacherIds(schoolId, req.studentId);
      const name = req.student.fullName;
      const instructions = saved.doctorNotes?.trim();
      await this.notifications.notifyUsers(schoolId, teacherIds, {
        event: 'medication_approved',
        type: 'medication',
        title: 'Συναίνεση φαρμάκου',
        body: `Ο γονέας συναίνεσε. Ο/η ${name} παίρνει ${saved.medicationName}, ${saved.dose}, ${saved.frequency}.${instructions ? ` Οδηγίες: ${instructions}` : ''}`,
        data: {
          screen: 'medications',
          requestId: saved.id,
          studentId: req.studentId,
          studentName: name,
        },
      });
    }

    return saved;
  }

  async acknowledge(id: string, schoolId: string, acknowledgedByUserId: string) {
    await this.findOne(id, schoolId);
    return this.prisma.medicationRequest.update({
      where: { id },
      data: { status: 'approved', acknowledgedAt: new Date(), acknowledgedByUserId },
      include: requestInclude,
    });
  }

  async updateStatus(id: string, schoolId: string, status: string) {
    await this.findOne(id, schoolId);
    return this.prisma.medicationRequest.update({ where: { id }, data: { status }, include: requestInclude });
  }

  async remove(id: string) {
    await this.prisma.medicationRequest.delete({ where: { id } });
  }

  private async classTeacherIds(schoolId: string, studentId: string) {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { studentId, student: { schoolId }, academicYear: { isCurrent: true } },
      select: { class: { select: { teachers: { select: { userId: true } } } } },
    });
    return enrollment?.class.teachers.map((teacher) => teacher.userId) ?? [];
  }

  private async teacherStudentIds(schoolId: string, teacherUserId: string) {
    const own = await this.prisma.classTeacher.findMany({
      where: { userId: teacherUserId, class: { schoolId, academicYear: { isCurrent: true } } },
      select: { classId: true },
    });
    const today = athensToday();
    const covers = await this.prisma.teacherAbsence.findMany({
      where: {
        schoolId,
        substituteUserId: teacherUserId,
        date: { gte: new Date(`${today}T00:00:00.000Z`), lte: new Date(`${today}T23:59:59.999Z`) },
      },
      select: { teacherUserId: true },
    });
    const absentIds = [...new Set(covers.map((row) => row.teacherUserId))];
    const covered = absentIds.length
      ? await this.prisma.classTeacher.findMany({
        where: { userId: { in: absentIds }, class: { schoolId, academicYear: { isCurrent: true } } },
        select: { classId: true },
      })
      : [];
    const classIds = [...new Set([...own, ...covered].map((row) => row.classId))];
    if (!classIds.length) return [];
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId: { in: classIds }, academicYear: { isCurrent: true } },
      select: { studentId: true },
    });
    return [...new Set(enrollments.map((row) => row.studentId))];
  }
}

function athensToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
