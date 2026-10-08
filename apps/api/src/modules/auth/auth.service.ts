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
import { phoneKey } from './phone';

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

  async refresh(token: string, schoolId?: string, role?: string) {
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

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.update({ where: { token }, data: { expiresAt } });

    const memberships = user.schoolMemberships.map((m) => ({
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
    }));

    const preferred = user.schoolMemberships.find((m) =>
      (!schoolId || m.schoolId === schoolId) && (!role || m.role === role),
    ) ?? user.schoolMemberships.find((m) => schoolId && m.schoolId === schoolId)
      ?? user.schoolMemberships[0]
      ?? null;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      schoolId: preferred?.schoolId ?? null,
      role: preferred?.role ?? null,
      schoolLogoUrl: preferred?.school?.logoUrl ?? null,
      schoolPrimaryColor: preferred?.school?.primaryColor ?? null,
      memberships,
    };

    const accessToken = this.jwt.sign(await this.withTerms(payload), {
      expiresIn: this.config.get<string>('jwt.accessExpires', '15m'),
    });
    return { accessToken, refreshToken: token };
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
    const user = await this.findByPhone(phone);
    if (!user) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός με αυτό το κινητό');
    console.log(`[OTP] ${phoneKey(phone)} → 000000`);
    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, otp: string) {
    if (otp !== '000000') throw new UnauthorizedException('Λάθος κωδικός');
    const user = await this.findByPhone(phone);
    if (!user) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός');
    await this.ensureParentMemberships(user.id);
    const refreshed = await this.findByPhone(phone);
    if (!refreshed?.schoolMemberships.length) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός');

    const ordered = [...refreshed.schoolMemberships].sort((a, b) => Number(b.role === 'parent') - Number(a.role === 'parent'));
    const memberships = ordered.map((m) => ({
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
    }));
    const primary = ordered[0];
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
      user: { id: refreshed.id, email: refreshed.email, fullName: refreshed.fullName, avatarUrl: refreshed.avatarUrl, isSuperAdmin: refreshed.isSuperAdmin, memberships },
    };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private async findByPhone(phone: string) {
    const key = phoneKey(phone);
    if (!key) return null;
    const users = await this.prisma.user.findMany({
      where: { isActive: true, phone: { not: null } },
      include: {
        schoolMemberships: {
          where: { isActive: true },
          include: { school: { select: { id: true, name: true, logoUrl: true, primaryColor: true } } },
        },
      },
    });
    const matches = users.filter((row) => phoneKey(row.phone) === key);
    matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return matches[0] ?? null;
  }

  private async ensureParentMemberships(userId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { userId, student: { isActive: true } },
      select: { student: { select: { schoolId: true } } },
    });
    const schoolIds = [...new Set(links.map((link) => link.student.schoolId))];
    for (const schoolId of schoolIds) {
      const existing = await this.prisma.schoolMember.findFirst({
        where: { schoolId, userId, role: 'parent' },
      });
      if (!existing) {
        await this.prisma.schoolMember.create({ data: { schoolId, userId, role: 'parent', isActive: true } });
      } else if (!existing.isActive) {
        await this.prisma.schoolMember.update({ where: { id: existing.id }, data: { isActive: true } });
      }
    }
  }

  async issueForUser(userId: string, schoolId?: string | null, role?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        schoolMemberships: {
          where: { isActive: true },
          include: { school: { select: { id: true, name: true, logoUrl: true, primaryColor: true } } },
        },
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Ο λογαριασμός δεν είναι ενεργός');
    const memberships = user.schoolMemberships.map((m) => ({
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
    }));
    const preferred = user.schoolMemberships.find((m) => m.schoolId === schoolId && (!role || m.role === role))
      ?? user.schoolMemberships[0]
      ?? null;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      schoolId: preferred?.schoolId ?? null,
      role: preferred?.role ?? null,
      schoolLogoUrl: preferred?.school?.logoUrl ?? null,
      schoolPrimaryColor: preferred?.school?.primaryColor ?? null,
      memberships,
    };
    const tokens = await this.generateTokens(payload);
    return {
      ...tokens,
      user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, avatarUrl: user.avatarUrl },
    };
  }

  private async generateTokens(payload: JwtPayload) {
    const full = await this.withTerms(payload);
    const refreshExpires = this.config.get<string>('jwt.refreshExpires', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = uuidv4();
    await this.prisma.refreshToken.create({
      data: { userId: payload.sub, token: refreshToken, expiresAt },
    });

    const accessToken = this.jwt.sign(full, {
      expiresIn: this.config.get<string>('jwt.accessExpires', '15m'),
    });

    return { accessToken, refreshToken };
  }

  private async withTerms(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.role !== 'parent' || !payload.schoolId) return { ...payload, termsAccepted: true };
    try {
      const member = await this.prisma.schoolMember.findFirst({
        where: { userId: payload.sub, schoolId: payload.schoolId, role: 'parent', isActive: true },
        select: { termsAcceptedAt: true },
      });
      return { ...payload, termsAccepted: Boolean(member?.termsAcceptedAt) };
    } catch {
      return { ...payload, termsAccepted: false };
    }
  }
}
