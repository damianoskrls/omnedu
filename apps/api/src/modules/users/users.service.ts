import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, fullName: true, phone: true,
        avatarUrl: true, isSuperAdmin: true, isActive: true, createdAt: true,
        schoolMemberships: {
          include: { school: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findBySchool(schoolId: string, role?: string) {
    return this.prisma.schoolMember.findMany({
      where: { schoolId, ...(role ? { role: role as any } : {}), isActive: true },
      include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true, phone: true } } },
    });
  }

  async updateProfile(id: string, data: { fullName?: string; phone?: string; avatarUrl?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async saveFcmToken(userId: string, token: string, platform: 'android' | 'ios') {
    return this.prisma.fcmToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { updatedAt: new Date() },
    });
  }

  async removeFcmToken(token: string) {
    await this.prisma.fcmToken.deleteMany({ where: { token } });
  }
}
