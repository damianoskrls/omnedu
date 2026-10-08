import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../auth/phone';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string) {
    return this.prisma.schoolMember.findMany({
      where: { schoolId, role: { in: ['teacher', 'school_admin'] }, isActive: true },
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
    return this.prisma.salaryRecord.create({
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

  async updateLeaveStatus(leaveId: string, status: string, approverId: string) {
    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status, approvedById: approverId },
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
}

function blankToNull(value?: string | null) {
  const text = value?.trim() ?? '';
  return text || null;
}
