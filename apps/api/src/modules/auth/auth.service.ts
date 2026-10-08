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

type PhoneMembership = {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  schoolId: string;
  schoolName: string;
  role: string;
  schoolLogoUrl: string | null;
  schoolPrimaryColor: string | null;
};

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

    const listed = await this.sessionMemberships(user);
    const own = listed.filter((m) => m.userId === user.id);
    const pool = own.length ? own : listed;
    const preferred = pool.find((m) =>
      (!schoolId || m.schoolId === schoolId) && (!role || m.role === role),
    ) ?? pool.find((m) => schoolId && m.schoolId === schoolId)
      ?? pool[0]
      ?? null;
    const memberships = (listed.length ? listed : pool).map((m) => ({
      userId: m.userId,
      schoolId: m.schoolId,
      schoolName: m.schoolName,
      role: m.role,
    }));

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      schoolId: preferred?.schoolId ?? null,
      role: preferred?.role ?? null,
      schoolLogoUrl: preferred?.schoolLogoUrl ?? null,
      schoolPrimaryColor: preferred?.schoolPrimaryColor ?? null,
      memberships,
    };

    const accessToken = this.jwt.sign(await this.withTerms(payload), {
      expiresIn: this.config.get<string>('jwt.accessExpires', '15m'),
    });
    return { accessToken, refreshToken: token };
  }

  async switchContext(currentUser: JwtPayload, dto: SwitchContextDto) {
    const current = await this.prisma.user.findUnique({ where: { id: currentUser.sub } });
    if (!current?.isActive) throw new UnauthorizedException();

    const targetUserId = dto.userId || currentUser.sub;
    const listed = await this.sessionMemberships(current);
    const match = listed.find((m) => m.userId === targetUserId && m.schoolId === dto.schoolId && m.role === dto.role)
      ?? (targetUserId === currentUser.sub
        ? listed.find((m) => m.schoolId === dto.schoolId && m.role === dto.role && m.userId === currentUser.sub)
        : undefined);

    if (!match && !currentUser.isSuperAdmin) {
      throw new ForbiddenException('Δεν έχεις αυτόν τον ρόλο');
    }

    if (match && match.userId !== currentUser.sub) {
      const target = await this.prisma.user.findUnique({ where: { id: match.userId } });
      const samePhone = phoneKey(current.phone) && phoneKey(current.phone) === phoneKey(target?.phone);
      if (!target?.isActive || !samePhone) throw new ForbiddenException('Δεν έχεις αυτόν τον ρόλο');
    }

    if (!match) {
      const payload: JwtPayload = {
        sub: currentUser.sub,
        email: currentUser.email,
        fullName: currentUser.fullName,
        isSuperAdmin: currentUser.isSuperAdmin,
        schoolId: dto.schoolId,
        role: dto.role,
        memberships: currentUser.memberships,
      };
      return this.generateTokens(payload);
    }

    return this.issuePhoneSession(match, listed.length ? listed : [match]);
  }

  async requestOtp(phone: string) {
    const user = await this.findByPhone(phone);
    if (!user) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός με αυτό το κινητό');
    console.log(`[OTP] ${phoneKey(phone)} → 000000`);
    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, otp: string) {
    if (otp !== '000000') throw new UnauthorizedException('Λάθος κωδικός');
    const accounts = await this.accountsByPhone(phone);
    if (!accounts.length) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός');
    for (const account of accounts) await this.ensureParentMemberships(account.id);
    const choices = await this.membershipsForPhone(phone);
    if (!choices.length) throw new UnauthorizedException('Δεν βρέθηκε λογαριασμός');
    if (new Set(choices.map((choice) => choice.role)).size > 1) {
      const pendingToken = this.jwt.sign(
        { purpose: 'role-choice', phone: phoneKey(phone) },
        { expiresIn: '10m' },
      );
      return {
        needsRole: true,
        pendingToken,
        choices: choices.map((choice) => ({
          userId: choice.userId,
          fullName: choice.fullName,
          schoolId: choice.schoolId,
          schoolName: choice.schoolName,
          role: choice.role,
        })),
      };
    }
    return this.issuePhoneSession(choices[0], choices);
  }

  async selectOtpRole(pendingToken: string, userId: string, schoolId: string, role: string) {
    let pending: { purpose?: string; phone?: string };
    try {
      pending = this.jwt.verify(pendingToken) as { purpose?: string; phone?: string };
    } catch {
      throw new UnauthorizedException('Η επιλογή έληξε. Ζητήστε νέο κωδικό.');
    }
    if (pending.purpose !== 'role-choice' || !pending.phone) {
      throw new UnauthorizedException('Μη έγκυρη επιλογή');
    }
    const choices = await this.membershipsForPhone(pending.phone);
    const match = choices.find((choice) => choice.userId === userId && choice.schoolId === schoolId && choice.role === role);
    if (!match) throw new ForbiddenException('Ο ρόλος δεν είναι διαθέσιμος');
    return this.issuePhoneSession(match, choices);
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private async findByPhone(phone: string) {
    const matches = await this.accountsByPhone(phone);
    return matches[0] ?? null;
  }

  private async accountsByPhone(phone: string) {
    const key = phoneKey(phone);
    if (!key) return [];
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
    return matches;
  }

  private async sessionMemberships(user: { id: string; phone?: string | null }) {
    const listed = await this.membershipsForPhone(user.phone);
    if (listed.some((row) => row.userId === user.id)) return listed;
    const self = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        schoolMemberships: {
          where: { isActive: true },
          include: { school: { select: { id: true, name: true, logoUrl: true, primaryColor: true } } },
        },
      },
    });
    if (!self) return listed;
    const selfRows = this.rowsForAccount(self);
    const rest = listed.filter((row) => !selfRows.some((own) => own.schoolId === row.schoolId && own.role === row.role));
    return [...selfRows, ...rest].sort((a, b) => this.roleRank(a.role) - this.roleRank(b.role));
  }

  private async membershipsForPhone(phone?: string | null): Promise<PhoneMembership[]> {
    const accounts = await this.accountsByPhone(phone ?? '');
    const seen = new Set<string>();
    const choices: PhoneMembership[] = [];
    for (const account of accounts) {
      for (const row of this.rowsForAccount(account)) {
        const key = `${row.schoolId}|${row.role}`;
        if (seen.has(key)) continue;
        seen.add(key);
        choices.push(row);
      }
    }
    choices.sort((a, b) => this.roleRank(a.role) - this.roleRank(b.role));
    return choices;
  }

  private rowsForAccount(account: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
    schoolMemberships: {
      schoolId: string;
      role: string;
      school: { name: string; logoUrl: string | null; primaryColor: string | null };
    }[];
  }): PhoneMembership[] {
    const ordered = [...account.schoolMemberships].sort((a, b) => this.roleRank(a.role) - this.roleRank(b.role));
    return ordered.map((membership) => ({
      userId: account.id,
      email: account.email,
      fullName: account.fullName,
      avatarUrl: account.avatarUrl,
      isSuperAdmin: account.isSuperAdmin,
      schoolId: membership.schoolId,
      schoolName: membership.school.name,
      role: membership.role,
      schoolLogoUrl: membership.school.logoUrl,
      schoolPrimaryColor: membership.school.primaryColor,
    }));
  }

  private roleRank(role: string) {
    if (role === 'parent') return 0;
    if (role === 'teacher') return 1;
    if (role === 'school_admin') return 2;
    return 3;
  }

  private async issuePhoneSession(selected: PhoneMembership, choices: PhoneMembership[]) {
    const memberships = choices.map((choice) => ({
      userId: choice.userId,
      schoolId: choice.schoolId,
      schoolName: choice.schoolName,
      role: choice.role,
    }));
    const payload: JwtPayload = {
      sub: selected.userId,
      email: selected.email,
      fullName: selected.fullName,
      isSuperAdmin: selected.isSuperAdmin,
      schoolId: selected.schoolId,
      role: selected.role,
      schoolLogoUrl: selected.schoolLogoUrl,
      schoolPrimaryColor: selected.schoolPrimaryColor,
      memberships,
    };
    const tokens = await this.generateTokens(payload);
    return {
      ...tokens,
      needsRole: false,
      user: {
        id: selected.userId,
        email: selected.email,
        fullName: selected.fullName,
        avatarUrl: selected.avatarUrl,
        isSuperAdmin: selected.isSuperAdmin,
        memberships,
      },
    };
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
