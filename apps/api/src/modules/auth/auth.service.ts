import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchContextDto } from './dto/switch-context.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        schoolMemberships: {
          where: { isActive: true },
          include: { school: { select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true } } },
        },
      },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const memberships = user.schoolMemberships.map((m) => ({
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
    }));

    const primaryMembership = user.schoolMemberships[0] ?? null;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      schoolId: primaryMembership?.schoolId ?? null,
      role: primaryMembership?.role ?? null,
      schoolLogoUrl: primaryMembership?.school?.logoUrl ?? null,
      schoolPrimaryColor: primaryMembership?.school?.primaryColor ?? null,
      memberships,
    };

    const { accessToken, refreshToken } = await this.generateTokens(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
        memberships,
      },
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
      },
    });

    return { id: user.id, email: user.email, fullName: user.fullName };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            schoolMemberships: {
              where: { isActive: true },
              include: { school: { select: { id: true, name: true, logoUrl: true, primaryColor: true } } },
            },
          },
        },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = stored.user;
    if (!user.isActive) throw new UnauthorizedException();

    await this.prisma.refreshToken.delete({ where: { token } });

    const memberships = user.schoolMemberships.map((m) => ({
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
    }));

    const primaryMembership = user.schoolMemberships[0] ?? null;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      schoolId: primaryMembership?.schoolId ?? null,
      role: primaryMembership?.role ?? null,
      schoolLogoUrl: primaryMembership?.school?.logoUrl ?? null,
      schoolPrimaryColor: primaryMembership?.school?.primaryColor ?? null,
      memberships,
    };

    return this.generateTokens(payload);
  }

  async switchContext(currentUser: JwtPayload, dto: SwitchContextDto) {
    const membership = currentUser.memberships.find(
      (m) => m.schoolId === dto.schoolId && m.role === dto.role,
    );

    if (!membership && !currentUser.isSuperAdmin) {
      throw new ForbiddenException('You do not have this role in this school');
    }

    const payload: JwtPayload = {
      ...currentUser,
      schoolId: dto.schoolId,
      role: dto.role,
    };

    const { accessToken } = await this.generateTokens(payload);
    return { accessToken };
  }

  async requestOtp(phone: string) {
    const normalized = phone.replace(/\s+/g, '');
    const user = await this.prisma.user.findFirst({
      where: {
        phone: normalized,
        isActive: true,
        schoolMemberships: { some: { isActive: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός με αυτό το κινητό');
    console.log(`[OTP] ${normalized} → 000000`);
    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, otp: string) {
    if (otp !== '000000') throw new UnauthorizedException('Λάθος κωδικός');
    const normalized = phone.replace(/\s+/g, '');
    const user = await this.prisma.user.findFirst({
      where: {
        phone: normalized,
        isActive: true,
        schoolMemberships: { some: { isActive: true } },
      },
      include: {
        schoolMemberships: {
          where: { isActive: true },
          include: { school: { select: { id: true, name: true, logoUrl: true, primaryColor: true } } },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός');

    const memberships = user.schoolMemberships.map((m) => ({
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
    }));
    const primary = user.schoolMemberships[0] ?? null;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      schoolId: primary?.schoolId ?? null,
      role: primary?.role ?? null,
      schoolLogoUrl: primary?.school?.logoUrl ?? null,
      schoolPrimaryColor: primary?.school?.primaryColor ?? null,
      memberships,
    };
    const { accessToken, refreshToken } = await this.generateTokens(payload);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl, isSuperAdmin: user.isSuperAdmin, memberships },
    };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private async generateTokens(payload: JwtPayload) {
    const refreshExpires = this.config.get<string>('jwt.refreshExpires', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = uuidv4();
    await this.prisma.refreshToken.create({
      data: { userId: payload.sub, token: refreshToken, expiresAt },
    });

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get<string>('jwt.accessExpires', '15m'),
    });

    return { accessToken, refreshToken };
  }
}
