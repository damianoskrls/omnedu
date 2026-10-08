import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../auth/phone';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StaffService implements OnModuleInit {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "teacher_profiles" ADD COLUMN IF NOT EXISTS "annual_leave_days" INTEGER NOT NULL DEFAULT 0`,
      );
    } catch {
      // The column is also added by migration. A repeat on boot is safe.
    }
  }

  async findAll(schoolId: string) {
    return this.prisma.schoolMember.findMany({
      where: { schoolId, role: { in: ['teacher', 'school_admin', 'owner'] }, isActive: true },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true, phone: true } },
        teacherProfile: true,
      },
      orderBy: { user: { fullName: 'asc' } },
    });
  }

  async findOne(memberId: string, schoolId: string) {
    const member = await this.prisma.schoolMember.findFirst({
      where: { id: memberId, schoolId },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true, phone: true, createdAt: true } },
        teacherProfile: {
          include: {
            salaryRecords: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
            leaveRequests: { orderBy: { startDate: 'desc' } },
          },
        },
      },
    });
    if (!member) throw new NotFoundException('Staff member not found');

    // Get classes they teach
    const classes = await this.prisma.classTeacher.findMany({
      where: { userId: member.userId },
      include: {
        class: { include: { academicYear: { select: { label: true, isCurrent: true } } } },
      },
      orderBy: { class: { academicYear: { startsOn: 'desc' } } },
    });

    return { ...member, classes };
  }

  async createOwner(schoolId: string, data: { fullName?: string; phone?: string }) {
    const fullName = data.fullName?.trim() ?? '';
    const phone = normalizePhone(data.phone);
    if (!fullName) throw new BadRequestException('Συμπληρώστε το ονοματεπώνυμο');
    if (!phone || phone.length < 10) throw new BadRequestException('Συμπληρώστε ένα έγκυρο κινητό');

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, { phone: phone.replace(/^\+30/, '') }, { phone: `+30${phone.replace(/^\+30/, '')}` }] },
    });
    const user = existing ?? await this.prisma.user.create({
      data: {
        email: `owner-${phone.replace(/\D/g, '')}@omnedu.placeholder`,
        fullName,
        phone,
        passwordHash: randomBytes(32).toString('hex'),
      },
    });
    if (existing && existing.fullName !== fullName) {
      await this.prisma.user.update({ where: { id: existing.id }, data: { fullName, phone } });
    }

    const membership = await this.prisma.schoolMember.findFirst({
      where: { schoolId, userId: user.id, role: 'owner' },
    });
    if (membership?.isActive) throw new ConflictException('Αυτό το κινητό είναι ήδη ιδιοκτήτης');
    if (membership) {
      await this.prisma.schoolMember.update({ where: { id: membership.id }, data: { isActive: true } });
      return this.findOne(membership.id, schoolId);
    }
    const created = await this.prisma.schoolMember.create({
      data: { schoolId, userId: user.id, role: 'owner' },
    });
    return this.findOne(created.id, schoolId);
  }

  async upsertProfile(memberId: string, schoolId: string, data: {
    fullName?: string;
    email?: string;
    phone?: string | null;
    address?: string | null;
    bio?: string | null;
    specialization?: string | null;
    contractType?: string | null;
    hireDate?: string | null;
    monthlyGross?: number | string | null;
    annualLeaveDays?: number | string | null;
    education?: { degree: string; institution: string; year: number }[];
  }) {
    const member = await this.prisma.schoolMember.findFirst({ where: { id: memberId, schoolId } });
    if (!member) throw new NotFoundException('Staff member not found');

    const userData: { fullName?: string; email?: string; phone?: string | null } = {};
    if (data.fullName !== undefined) {
      const fullName = data.fullName.trim();
      if (!fullName) throw new BadRequestException('Συμπληρώστε το ονοματεπώνυμο');
      userData.fullName = fullName;
    }
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (!email) throw new BadRequestException('Συμπληρώστε το email');
      const taken = await this.prisma.user.findFirst({ where: { email, NOT: { id: member.userId } } });
      if (taken) throw new ConflictException('Αυτό το email χρησιμοποιείται ήδη');
      userData.email = email;
    }
    if (data.phone !== undefined) userData.phone = normalizePhone(data.phone);

    if (Object.keys(userData).length) {
      await this.prisma.user.update({ where: { id: member.userId }, data: userData });
    }

    const profile: Record<string, unknown> = {};
    if (data.phone !== undefined) profile.phone = normalizePhone(data.phone);
    if (data.address !== undefined) profile.address = blankToNull(data.address);
    if (data.bio !== undefined) profile.bio = blankToNull(data.bio);
    if (data.specialization !== undefined) profile.specialization = blankToNull(data.specialization);
    if (data.contractType !== undefined) {
      const allowed = ['full_time', 'part_time', 'hourly'];
      profile.contractType = data.contractType && allowed.includes(data.contractType) ? data.contractType : null;
    }
    if (data.hireDate !== undefined) profile.hireDate = data.hireDate ? new Date(data.hireDate) : null;
    if (data.monthlyGross !== undefined) {
      if (data.monthlyGross === '' || data.monthlyGross === null) profile.monthlyGross = null;
      else {
        const amount = Number(data.monthlyGross);
        if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('Ο μισθός δεν είναι έγκυρος');
        profile.monthlyGross = amount;
      }
    }
    if (data.annualLeaveDays !== undefined) {
      const days = Number(data.annualLeaveDays);
      if (!Number.isInteger(days) || days < 0 || days > 366) throw new BadRequestException('Οι ημέρες άδειας δεν είναι έγκυρες');
      profile.annualLeaveDays = days;
    }
    if (data.education !== undefined) profile.education = data.education;

    if (Object.keys(profile).length) {
      await this.prisma.teacherProfile.upsert({
        where: { schoolMemberId: memberId },
        create: { schoolMemberId: memberId, ...(profile as object) },
        update: profile,
      });
    }

    return this.findOne(memberId, schoolId);
  }

  async remove(memberId: string, schoolId: string, actorId: string) {
    const member = await this.prisma.schoolMember.findFirst({ where: { id: memberId, schoolId, isActive: true } });
    if (!member) throw new NotFoundException('Staff member not found');
    if (member.userId === actorId) throw new ForbiddenException('Δεν μπορείτε να διαγράψετε τον δικό σας λογαριασμό');
    if (member.role === 'school_admin') {
      const admins = await this.prisma.schoolMember.count({ where: { schoolId, role: 'school_admin', isActive: true } });
      if (admins <= 1) throw new ForbiddenException('Πρέπει να μείνει τουλάχιστον ένας διαχειριστής');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.schoolMember.update({ where: { id: member.id }, data: { isActive: false } });
      const classes = await tx.class.findMany({ where: { schoolId }, select: { id: true } });
      if (classes.length) {
        await tx.classTeacher.deleteMany({
          where: { userId: member.userId, classId: { in: classes.map((row) => row.id) } },
        });
      }
      await tx.levelCoordinator.deleteMany({ where: { userId: member.userId, level: { schoolId } } });
      await tx.level.updateMany({ where: { schoolId, coordinatorId: member.userId }, data: { coordinatorId: null } });
      const stillActive = await tx.schoolMember.count({ where: { userId: member.userId, isActive: true } });
      if (stillActive === 0) {
        await tx.user.update({ where: { id: member.userId }, data: { isActive: false } });
      }
    });
    return { ok: true };
  }

  async getSalary(memberId: string, schoolId: string) {
    const profile = await this.getProfileOrThrow(memberId, schoolId);
    return this.prisma.salaryRecord.findMany({
      where: { teacherProfileId: profile.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async createSalary(memberId: string, schoolId: string, data: {
    month: number; year: number; grossAmount: number;
    deductions?: number; paidAt?: string; notes?: string;
  }) {
    const profile = await this.getProfileOrThrow(memberId, schoolId);
    const net = data.grossAmount - (data.deductions ?? 0);
    try {
      return await this.prisma.salaryRecord.create({
        data: {
          teacherProfileId: profile.id,
          month: data.month,
          year: data.year,
          grossAmount: data.grossAmount,
          deductions: data.deductions ?? 0,
          netAmount: net,
          paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
          notes: data.notes,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Υπάρχει ήδη μισθοδοσία για αυτόν τον μήνα. Άνοιξέ την για επεξεργασία.');
      }
      throw error;
    }
  }

  async updateSalary(memberId: string, schoolId: string, salaryId: string, data: {
    month?: number; year?: number; grossAmount?: number;
    deductions?: number; paidAt?: string | null; notes?: string | null;
  }) {
    const profile = await this.getProfileOrThrow(memberId, schoolId);
    const row = await this.prisma.salaryRecord.findFirst({ where: { id: salaryId, teacherProfileId: profile.id } });
    if (!row) throw new NotFoundException('Η μισθοδοσία δεν βρέθηκε');
    const gross = data.grossAmount ?? Number(row.grossAmount);
    const deductions = data.deductions ?? Number(row.deductions);
    if (!Number.isFinite(gross) || gross < 0 || !Number.isFinite(deductions) || deductions < 0) {
      throw new BadRequestException('Τα ποσά δεν είναι έγκυρα');
    }
    try {
      return await this.prisma.salaryRecord.update({
        where: { id: salaryId },
        data: {
          month: data.month ?? row.month,
          year: data.year ?? row.year,
          grossAmount: gross,
          deductions,
          netAmount: gross - deductions,
          ...(data.paidAt !== undefined ? { paidAt: data.paidAt ? new Date(data.paidAt) : null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Υπάρχει ήδη μισθοδοσία για αυτόν τον μήνα.');
      }
      throw error;
    }
  }

  async deleteSalary(memberId: string, schoolId: string, salaryId: string) {
    const profile = await this.getProfileOrThrow(memberId, schoolId);
    const row = await this.prisma.salaryRecord.findFirst({ where: { id: salaryId, teacherProfileId: profile.id } });
    if (!row) throw new NotFoundException('Η μισθοδοσία δεν βρέθηκε');
    await this.prisma.salaryRecord.delete({ where: { id: salaryId } });
    return { ok: true };
  }

  async getLeaves(memberId: string, schoolId: string) {
    const profile = await this.getProfileOrThrow(memberId, schoolId);
    return this.prisma.leaveRequest.findMany({
      where: { teacherProfileId: profile.id },
      orderBy: { startDate: 'desc' },
    });
  }

  async createLeave(memberId: string, schoolId: string, data: {
    leaveType: string; startDate: string; endDate: string; notes?: string;
  }) {
    const profile = await this.getProfileOrThrow(memberId, schoolId);
    this.assertLeaveInput(data.leaveType, data.startDate, data.endDate);
    return this.prisma.leaveRequest.create({
      data: {
        teacherProfileId: profile.id,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        notes: data.notes,
        status: 'pending',
      },
    });
  }

  async updateLeave(leaveId: string, schoolId: string, data: {
    status?: string;
    leaveType?: string;
    startDate?: string;
    endDate?: string;
    notes?: string | null;
  }, approverId: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, teacherProfile: { schoolMember: { schoolId } } },
      include: { teacherProfile: { include: { schoolMember: true } } },
    });
    if (!leave) throw new NotFoundException('Η άδεια δεν βρέθηκε');
    const status = data.status ?? leave.status;
    if (!['pending', 'approved', 'rejected'].includes(status)) throw new BadRequestException('Η κατάσταση δεν είναι έγκυρη');
    const leaveType = data.leaveType ?? leave.leaveType;
    if (!['annual', 'sick', 'maternity', 'other'].includes(leaveType)) throw new BadRequestException('Ο τύπος άδειας δεν είναι έγκυρος');
    const start = data.startDate ? new Date(data.startDate) : leave.startDate;
    const end = data.endDate ? new Date(data.endDate) : leave.endDate;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new BadRequestException('Οι ημερομηνίες της άδειας δεν είναι έγκυρες');
    }
    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status,
        leaveType,
        startDate: start,
        endDate: end,
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(data.status && data.status !== 'pending' ? { approvedById: approverId } : {}),
      },
    });
    if (data.status && data.status !== leave.status && data.status !== 'pending') {
      const label = data.status === 'approved' ? 'εγκρίθηκε' : 'απορρίφθηκε';
      await this.notifications.notifyUsers(schoolId, [leave.teacherProfile.schoolMember.userId], {
        event: 'leave_decision',
        type: 'leave',
        title: data.status === 'approved' ? 'Η άδειά σου εγκρίθηκε' : 'Η άδειά σου απορρίφθηκε',
        body: `Το αίτημα άδειας ${label}.`,
        data: { screen: 'leaves', leaveId },
      });
    }
    return updated;
  }

  async myLeaves(schoolId: string, userId: string) {
    const summary = await this.leaveSummary(schoolId, userId);
    if (!summary) throw new NotFoundException('Δεν βρέθηκε προφίλ προσωπικού');
    return summary;
  }

  async createMyLeave(schoolId: string, userId: string, data: {
    leaveType: string; startDate: string; endDate: string; notes?: string;
  }) {
    const member = await this.memberForUser(schoolId, userId);
    if (!member) throw new NotFoundException('Δεν βρέθηκε προφίλ προσωπικού');
    this.assertLeaveInput(data.leaveType, data.startDate, data.endDate);
    const profile = member.teacherProfile ?? await this.prisma.teacherProfile.create({ data: { schoolMemberId: member.id } });
    return this.prisma.leaveRequest.create({
      data: {
        teacherProfileId: profile.id,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        notes: data.notes?.trim() || null,
        status: 'pending',
      },
    });
  }

  async updateAvatar(memberId: string, schoolId: string, avatarUrl: string) {
    const member = await this.prisma.schoolMember.findFirst({ where: { id: memberId, schoolId } });
    if (!member) throw new NotFoundException('Staff member not found');
    return this.prisma.user.update({ where: { id: member.userId }, data: { avatarUrl } });
  }

  private async getProfileOrThrow(memberId: string, schoolId: string) {
    const member = await this.prisma.schoolMember.findFirst({
      where: { id: memberId, schoolId },
      include: { teacherProfile: true },
    });
    if (!member) throw new NotFoundException('Staff member not found');
    if (!member.teacherProfile) {
      return this.prisma.teacherProfile.create({ data: { schoolMemberId: memberId } });
    }
    return member.teacherProfile;
  }

  private async memberForUser(schoolId: string, userId: string) {
    return this.prisma.schoolMember.findFirst({
      where: { schoolId, userId, isActive: true, role: { in: ['teacher', 'school_admin'] } },
      include: { teacherProfile: true },
      orderBy: { role: 'desc' },
    });
  }

  private async leaveSummary(schoolId: string, userId: string) {
    const member = await this.memberForUser(schoolId, userId);
    if (!member) return null;
    const profile = member.teacherProfile ?? await this.prisma.teacherProfile.create({ data: { schoolMemberId: member.id } });
    const requests = await this.prisma.leaveRequest.findMany({
      where: { teacherProfileId: profile.id },
      orderBy: { startDate: 'desc' },
    });
    const { from, to } = currentSchoolYear();
    const usedDays = requests
      .filter((row) => row.status === 'approved' && row.leaveType === 'annual')
      .reduce((sum, row) => sum + overlapDays(row.startDate, row.endDate, from, to), 0);
    const pendingDays = requests
      .filter((row) => row.status === 'pending' && row.leaveType === 'annual')
      .reduce((sum, row) => sum + overlapDays(row.startDate, row.endDate, from, to), 0);
    const entitlement = profile.annualLeaveDays ?? 0;
    return {
      entitlement,
      usedDays,
      pendingDays,
      remaining: entitlement - usedDays,
      requests,
    };
  }

  private assertLeaveInput(leaveType: string, startDate: string, endDate: string) {
    if (!['annual', 'sick', 'maternity', 'other'].includes(leaveType)) throw new BadRequestException('Ο τύπος άδειας δεν είναι έγκυρος');
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new BadRequestException('Οι ημερομηνίες της άδειας δεν είναι έγκυρες');
    }
  }
}

function currentSchoolYear(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month] = day.split('-').map(Number);
  const start = month >= 9 ? year : year - 1;
  return { from: `${start}-09-01`, to: `${start + 1}-08-31` };
}

function overlapDays(start: Date, end: Date, from: string, to: string) {
  const a = start.toISOString().slice(0, 10) > from ? start.toISOString().slice(0, 10) : from;
  const b = end.toISOString().slice(0, 10) < to ? end.toISOString().slice(0, 10) : to;
  if (b < a) return 0;
  const ms = new Date(`${b}T00:00:00.000Z`).getTime() - new Date(`${a}T00:00:00.000Z`).getTime();
  return Math.round(ms / 86400000) + 1;
}

function blankToNull(value?: string | null) {
  const text = value?.trim() ?? '';
  return text || null;
}
