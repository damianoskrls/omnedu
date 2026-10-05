import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LevelsService {
  constructor(private prisma: PrismaService) {}

  private readonly include = {
    coordinator: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
    coordinatorLinks: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
    classes: {
      where: { academicYear: { isCurrent: true } },
      include: {
        teachers: { include: { user: { select: { id: true, fullName: true } } } },
        _count: { select: { enrollments: true } },
      },
    },
  };

  async findAll(schoolId: string) {
    return this.prisma.level.findMany({
      where: { schoolId },
      include: this.include,
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const level = await this.prisma.level.findFirst({
      where: { id, schoolId },
      include: {
        ...this.include,
        parentMeetings: { orderBy: { meetingDate: 'desc' }, take: 5 },
      },
    });
    if (!level) throw new NotFoundException('Level not found');
    return level;
  }

  async create(schoolId: string, data: { name: string; description?: string; order?: number; coordinatorIds?: string[] }) {
    const { coordinatorIds, ...rest } = data;
    const level = await this.prisma.level.create({ data: { schoolId, ...rest } });
    if (coordinatorIds?.length) {
      await this.prisma.levelCoordinator.createMany({
        data: coordinatorIds.map(userId => ({ levelId: level.id, userId })),
        skipDuplicates: true,
      });
    }
    return this.findOne(level.id, schoolId);
  }

  async update(id: string, schoolId: string, data: { name?: string; description?: string; order?: number; coordinatorIds?: string[] }) {
    const { coordinatorIds, ...rest } = data;
    await this.prisma.level.update({ where: { id }, data: rest });
    if (coordinatorIds !== undefined) {
      await this.prisma.levelCoordinator.deleteMany({ where: { levelId: id } });
      if (coordinatorIds.length) {
        await this.prisma.levelCoordinator.createMany({
          data: coordinatorIds.map(userId => ({ levelId: id, userId })),
          skipDuplicates: true,
        });
      }
    }
    return this.findOne(id, schoolId);
  }

  async remove(id: string, schoolId: string) {
    await this.prisma.level.delete({ where: { id } });
  }
}
