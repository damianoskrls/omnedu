import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MedicationRequestsService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, studentId?: string, status?: string) {
    return this.prisma.medicationRequest.findMany({
      where: {
        schoolId,
        ...(studentId ? { studentId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        requestedBy: { select: { id: true, fullName: true } },
        acknowledgedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const req = await this.prisma.medicationRequest.findFirst({
      where: { id, schoolId },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        requestedBy: { select: { id: true, fullName: true } },
        acknowledgedBy: { select: { id: true, fullName: true } },
      },
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
    return this.prisma.medicationRequest.create({
      data: {
        schoolId,
        requestedByUserId,
        studentId: data.studentId,
        medicationName: data.medicationName,
        dose: data.dose,
        frequency: data.frequency,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        reason: data.reason,
        doctorNotes: data.doctorNotes,
        status: 'pending',
      },
    });
  }

  async acknowledge(id: string, schoolId: string, acknowledgedByUserId: string) {
    return this.prisma.medicationRequest.update({
      where: { id },
      data: { status: 'approved', acknowledgedAt: new Date(), acknowledgedByUserId },
    });
  }

  async updateStatus(id: string, schoolId: string, status: string) {
    return this.prisma.medicationRequest.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.prisma.medicationRequest.delete({ where: { id } });
  }
}
