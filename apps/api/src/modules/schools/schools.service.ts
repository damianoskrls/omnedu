import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, students: true } } },
    });
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { _count: { select: { members: true, students: true, classes: true } } },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async findBySlug(slug: string) {
    const school = await this.prisma.school.findUnique({ where: { slug } });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async create(dto: CreateSchoolDto) {
    const slugExists = await this.prisma.school.findUnique({ where: { slug: dto.slug } });
    if (slugExists) throw new ConflictException('Slug already in use');

    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (emailExists) throw new ConflictException('Admin email already registered');

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    return this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          timezone: dto.timezone ?? 'Europe/Athens',
          locale: dto.locale ?? 'el',
        },
      });

      const admin = await tx.user.create({
        data: {
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          fullName: dto.adminFullName,
        },
      });

      await tx.schoolMember.create({
        data: { schoolId: school.id, userId: admin.id, role: 'school_admin' },
      });

      return { school, adminId: admin.id };
    });
  }

  async update(id: string, data: { name?: string; logoUrl?: string; primaryColor?: string; subscriptionPlan?: string; isActive?: boolean }) {
    return this.prisma.school.update({ where: { id }, data });
  }

  async addMember(schoolId: string, userId: string, role: 'school_admin' | 'teacher' | 'parent') {
    return this.prisma.schoolMember.upsert({
      where: { schoolId_userId_role: { schoolId, userId, role } },
      create: { schoolId, userId, role },
      update: { isActive: true },
    });
  }

  async removeMember(schoolId: string, userId: string, role: string) {
    return this.prisma.schoolMember.updateMany({
      where: { schoolId, userId, role: role as any },
      data: { isActive: false },
    });
  }

  async getMembers(schoolId: string, role?: string) {
    return this.prisma.schoolMember.findMany({
      where: { schoolId, ...(role ? { role: role as any } : {}), isActive: true },
      include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true } } },
    });
  }

  // ── Holidays ─────────────────────────────────────────────

  async getHolidays(schoolId: string, academicYear?: string) {
    return this.prisma.schoolHoliday.findMany({
      where: { schoolId, ...(academicYear ? { academicYear } : {}) },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(schoolId: string, data: { date: string; name: string; academicYear?: string }) {
    return this.prisma.schoolHoliday.create({
      data: { schoolId, date: new Date(data.date), name: data.name, academicYear: data.academicYear },
    });
  }

  async deleteHoliday(schoolId: string, holidayId: string) {
    const h = await this.prisma.schoolHoliday.findFirst({ where: { id: holidayId, schoolId } });
    if (!h) throw new NotFoundException('Holiday not found');
    return this.prisma.schoolHoliday.delete({ where: { id: holidayId } });
  }
}
