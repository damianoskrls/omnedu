import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private auth: AuthService) {}

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

  async updateProfile(id: string, data: { fullName?: string; phone?: string; avatarUrl?: string; email?: string }, current?: JwtPayload) {
    const fullName = data.fullName?.trim();
    const email = data.email?.trim().toLowerCase();
    if (fullName !== undefined && fullName.length < 2) {
      throw new ConflictException('Το όνομα είναι πολύ μικρό.');
    }
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConflictException('Το email δεν είναι έγκυρο.');
    }
    if (email) {
      const taken = await this.prisma.user.findFirst({ where: { email, NOT: { id } } });
      if (taken) throw new ConflictException('Αυτό το email χρησιμοποιείται ήδη.');
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });
    return this.auth.issueForUser(id, current?.schoolId, current?.role);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    if (newPassword.trim().length < 6) {
      throw new BadRequestException('Ο νέος κωδικός χρειάζεται τουλάχιστον 6 χαρακτήρες.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Ο λογαριασμός δεν βρέθηκε.');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Ο τρέχων κωδικός δεν είναι σωστός.');
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(newPassword.trim(), 12) },
    });
    return { updated: true };
  }

  async deleteAccount(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Ο λογαριασμός δεν βρέθηκε.');
    if (user.isSuperAdmin) throw new ForbiddenException('Αυτός ο λογαριασμός δεν διαγράφεται από το κινητό.');
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.fcmToken.deleteMany({ where: { userId: id } }),
      this.prisma.schoolMember.updateMany({ where: { userId: id }, data: { isActive: false } }),
      this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          email: `deleted-${id}@removed.invalid`,
          fullName: 'Διαγραμμένος λογαριασμός',
          phone: null,
          avatarUrl: null,
        },
      }),
    ]);
    return { deleted: true };
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
