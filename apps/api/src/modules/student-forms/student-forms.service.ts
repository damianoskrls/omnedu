import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentFormsService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, academicYear?: number) {
    return this.prisma.studentForm.findMany({
      where: { schoolId, ...(academicYear ? { academicYear } : {}) },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        submittedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { student: { fullName: 'asc' } },
    });
  }

  async findOne(schoolId: string, studentId: string, academicYear: number) {
    return this.prisma.studentForm.findUnique({
      where: { schoolId_studentId_academicYear: { schoolId, studentId, academicYear } },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true, dob: true } },
        submittedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async upsert(
    schoolId: string,
    studentId: string,
    academicYear: number,
    submittedByUserId: string,
    data: {
      foodAllergies?: string;
      medicationAllergies?: string;
      chronicConditions?: string;
      dietaryNotes?: string;
      emergencyContact?: string;
      pediatricianName?: string;
      pediatricianPhone?: string;
      additionalNotes?: string;
    },
  ) {
    const payload = {
      ...data,
      submittedAt: new Date(),
      submittedByUserId,
    };
    return this.prisma.studentForm.upsert({
      where: { schoolId_studentId_academicYear: { schoolId, studentId, academicYear } },
      create: { schoolId, studentId, academicYear, ...payload },
      update: payload,
    });
  }
}
