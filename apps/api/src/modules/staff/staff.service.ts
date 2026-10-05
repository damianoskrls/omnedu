import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
    phone?: string; address?: string; bio?: string; specialization?: string;
    contractType?: string; hireDate?: string; monthlyGross?: number;
    education?: { degree: string; institution: string; year: number }[];
  }) {
    const member = await this.prisma.schoolMember.findFirst({ where: { id: memberId, schoolId } });
    if (!member) throw new NotFoundException('Staff member not found');

    return this.prisma.teacherProfile.upsert({
      where: { schoolMemberId: memberId },
      create: {
        schoolMemberId: memberId,
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
      },
      update: {
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
      },
    });
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
