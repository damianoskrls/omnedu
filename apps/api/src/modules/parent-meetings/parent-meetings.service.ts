import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ParentMeetingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, classId?: string, levelId?: string) {
    return this.prisma.parentMeeting.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : {}),
        ...(levelId ? { levelId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
      },
      orderBy: { meetingDate: 'asc' },
    });
  }

  async create(schoolId: string, data: { title: string; description?: string; meetingDate: string; classId?: string; levelId?: string }) {
    return this.prisma.parentMeeting.create({
      data: {
        schoolId,
        title: data.title,
        description: data.description,
        meetingDate: new Date(data.meetingDate),
        classId: data.classId ?? null,
        levelId: data.levelId ?? null,
      },
    });
  }

  async update(id: string, schoolId: string, data: Partial<{ title: string; description: string; meetingDate: string }>) {
    return this.prisma.parentMeeting.update({
      where: { id },
      data: {
        ...data,
        meetingDate: data.meetingDate ? new Date(data.meetingDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.parentMeeting.delete({ where: { id } });
  }
}
