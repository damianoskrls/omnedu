import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BusTrackingService implements OnModuleInit {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE bus_pickups ADD COLUMN IF NOT EXISTS is_absent BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  async drivers(schoolId: string) {
    return this.prisma.schoolMember.findMany({
      where: { schoolId, role: 'driver', isActive: true },
      include: { user: { select: { id: true, fullName: true, phone: true, avatarUrl: true } } },
      orderBy: { user: { fullName: 'asc' } },
    });
  }

  async mine(schoolId: string, userId: string, role?: string | null) {
    if (role !== 'driver') throw new ForbiddenException('Μόνο ο οδηγός στέλνει θέση.');
    const buses = await this.prisma.extraService.findMany({
      where: { schoolId, serviceType: 'bus', isActive: true, driverUserId: userId },
      select: { id: true, name: true, busNumber: true, driverName: true },
      orderBy: { name: 'asc' },
    });
    return { buses };
  }

  async ping(schoolId: string, userId: string, role: string | null | undefined, data: {
    serviceId?: string;
    latitude?: number;
    longitude?: number;
    heading?: number;
    speed?: number;
  }) {
    if (role !== 'driver') throw new ForbiddenException('Μόνο ο οδηγός στέλνει θέση.');
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new BadRequestException('Η θέση δεν είναι έγκυρη.');
    }
    const buses = await this.prisma.extraService.findMany({
      where: { schoolId, serviceType: 'bus', isActive: true, driverUserId: userId },
      select: { id: true },
    });
    const serviceId = data.serviceId && buses.some((bus) => bus.id === data.serviceId) ? data.serviceId : buses[0]?.id;
    if (!serviceId) throw new ForbiddenException('Ο διαχειριστής δεν σε έχει συνδέσει με σχολικό.');
    const saved = await this.prisma.busPosition.upsert({
      where: { serviceId },
      create: {
        schoolId,
        serviceId,
        driverUserId: userId,
        latitude,
        longitude,
        heading: numberOrNull(data.heading),
        speed: numberOrNull(data.speed),
      },
      update: {
        driverUserId: userId,
        latitude,
        longitude,
        heading: numberOrNull(data.heading),
        speed: numberOrNull(data.speed),
      },
    });
    return { ok: true, serviceId, updatedAt: saved.updatedAt };
  }

  async route(schoolId: string, userId: string, role: string | null | undefined, serviceId?: string, direction?: string) {
    const id = await this.driverServiceId(schoolId, userId, role, serviceId);
    if (!id) return { serviceId: null, riders: [] };
    const day = schoolDay();
    const dayKey = schoolDayKey();
    const dayStr = day.toISOString().slice(0, 10);
    const [rows, pickups, absentRows] = await Promise.all([
      this.prisma.studentService.findMany({
        where: { serviceId: id, isActive: true, student: { schoolId, isActive: true } },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              parents: { include: { user: { select: { id: true, fullName: true, phone: true, avatarUrl: true } } } },
            },
          },
          stop: true,
        },
      }),
      this.prisma.busPickup.findMany({ where: { serviceId: id, day } }),
      this.prisma.$queryRawUnsafe<{ student_id: string }[]>(
        `SELECT student_id FROM bus_pickups WHERE service_id = $1 AND day = $2::date AND is_absent = true`,
        id, dayStr,
      ),
    ]);
    const picked = new Map(pickups.map((row) => [row.studentId, row.pickedUpAt]));
    const absentSet = new Set(absentRows.map((r) => r.student_id));
    const riders = rows.map((row) => {
      const point = riderPoint(row);
      const mode = row.serviceMode || 'both';
      const parent = row.student.parents[0]?.user;
      return {
        studentId: row.student.id,
        name: row.student.fullName,
        avatarUrl: row.student.avatarUrl,
        serviceMode: mode,
        pickupTime: clockOf(row, 'pickup', dayKey),
        dropoffTime: clockOf(row, 'dropoff', dayKey),
        pickupContact: row.pickupContact,
        dropoffContact: row.dropoffContact,
        address: row.homeAddress || row.stop?.address || row.stop?.name || null,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        parentId: parent?.id ?? null,
        parentName: parent?.fullName ?? null,
        parentPhone: parent?.phone ?? null,
        parentAvatarUrl: parent?.avatarUrl ?? null,
        canPickup: direction === 'dropoff' ? mode !== 'pickup' : mode !== 'dropoff',
        pickedUp: picked.has(row.student.id),
        pickedUpAt: picked.get(row.student.id) ?? null,
        isAbsent: absentSet.has(row.student.id),
      };
    }).sort((a, b) => {
      const left = minutesOf(a.pickupTime) ?? 24 * 60;
      const right = minutesOf(b.pickupTime) ?? 24 * 60;
      if (left !== right) return left - right;
      return a.name.localeCompare(b.name, 'el');
    });
    return { serviceId: id, riders };
  }

  async pickup(
    schoolId: string,
    userId: string,
    role: string | null | undefined,
    data: { serviceId?: string; studentId?: string },
  ) {
    const serviceId = await this.driverServiceId(schoolId, userId, role, data.serviceId);
    const studentId = data.studentId?.trim() ?? '';
    if (!serviceId || !studentId) throw new BadRequestException('Διάλεξε παιδί από το δρομολόγιο.');
    const rider = await this.prisma.studentService.findFirst({
      where: { serviceId, studentId, isActive: true, student: { schoolId, isActive: true } },
    });
    if (!rider) throw new NotFoundException('Αυτό το παιδί δεν είναι στο σχολικό σου.');
    if (rider.serviceMode === 'dropoff') throw new BadRequestException('Αυτό το παιδί έχει μόνο παράδοση.');
    const day = schoolDay();
    const saved = await this.prisma.busPickup.upsert({
      where: { serviceId_studentId_day: { serviceId, studentId, day } },
      create: { schoolId, serviceId, studentId, driverUserId: userId, day },
      update: {},
    });
    return { ok: true, studentId, pickedUpAt: saved.pickedUpAt };
  }

  private async driverServiceId(schoolId: string, userId: string, role: string | null | undefined, serviceId?: string) {
    if (role !== 'driver') throw new ForbiddenException('Μόνο ο οδηγός βλέπει το δρομολόγιο.');
    const buses = await this.prisma.extraService.findMany({
      where: { schoolId, serviceType: 'bus', isActive: true, driverUserId: userId },
      select: { id: true },
    });
    return serviceId && buses.some((bus) => bus.id === serviceId) ? serviceId : buses[0]?.id ?? null;
  }

  async forStudent(schoolId: string, parentId: string, role: string | null | undefined, studentId: string) {
    if (role !== 'parent') throw new ForbiddenException('Ο χάρτης είναι για τον γονέα.');
    const link = await this.prisma.studentParent.findFirst({
      where: { userId: parentId, studentId, student: { schoolId } },
    });
    if (!link) throw new ForbiddenException('Αυτό το παιδί δεν είναι στο προφίλ σου.');
    const services = await this.prisma.studentService.findMany({
      where: { studentId, isActive: true, service: { schoolId, serviceType: 'bus', isActive: true } },
      include: {
        service: {
          include: {
            busPosition: true,
            driverUser: { select: { id: true, fullName: true, phone: true } },
          },
        },
        stop: true,
      },
    });
    return {
      buses: services.map((row) => {
        const position = row.service.busPosition;
        const ageMs = position ? Date.now() - position.updatedAt.getTime() : Number.POSITIVE_INFINITY;
        const live = ageMs < 3 * 60 * 1000;
        const destination = destinationOf(row);
        const eta = position && destination
          ? etaMinutes(position.latitude, position.longitude, destination.latitude, destination.longitude, position.speed)
          : null;
        return {
          serviceId: row.service.id,
          name: row.service.name,
          busNumber: row.service.busNumber,
          driverName: row.service.driverUser?.fullName || row.service.driverName,
          driverUserId: row.service.driverUser?.id ?? null,
          driverPhone: row.service.driverUser?.phone ?? null,
          live,
          updatedAt: position?.updatedAt ?? null,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          heading: position?.heading ?? null,
          destination,
          etaMinutes: live ? eta?.minutes ?? null : null,
          distanceKm: eta?.distanceKm ?? null,
        };
      }),
    };
  }

  async listClosures(schoolId: string) {
    const rows = await this.prisma.busClosure.findMany({
      where: { schoolId },
      orderBy: { day: 'desc' },
      take: 80,
    });
    return rows.map(closureJson);
  }

  async todayClosure(schoolId: string) {
    const row = await this.prisma.busClosure.findUnique({
      where: { schoolId_day: { schoolId, day: schoolDay() } },
    });
    if (!row) return { closed: false };
    return { closed: true, ...closureJson(row) };
  }

  async createClosure(schoolId: string, userId: string, body: { day?: string; reason?: string }) {
    const day = parseDay(body.day);
    const reason = (body.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Γράψε τον λόγο.');
    const saved = await this.prisma.busClosure.upsert({
      where: { schoolId_day: { schoolId, day } },
      create: { schoolId, day, reason: reason.slice(0, 500), createdById: userId },
      update: { reason: reason.slice(0, 500), createdById: userId },
    });
    await this.notifyClosure(schoolId, saved.day, saved.reason);
    return closureJson(saved);
  }

  async removeClosure(schoolId: string, closureId: string) {
    const existing = await this.prisma.busClosure.findFirst({ where: { id: closureId, schoolId } });
    if (!existing) throw new NotFoundException('Η ημέρα δεν βρέθηκε.');
    await this.prisma.busClosure.delete({ where: { id: existing.id } });
    return { success: true };
  }

  async absent(schoolId: string, userId: string, role: string | null | undefined, data: { serviceId?: string; studentId?: string }) {
    const serviceId = await this.driverServiceId(schoolId, userId, role, data.serviceId);
    const studentId = data.studentId?.trim() ?? '';
    if (!serviceId || !studentId) throw new BadRequestException('Διάλεξε παιδί από το δρομολόγιο.');
    const rider = await this.prisma.studentService.findFirst({
      where: { serviceId, studentId, isActive: true, student: { schoolId, isActive: true } },
    });
    if (!rider) throw new NotFoundException('Αυτό το παιδί δεν είναι στο σχολικό σου.');
    const day = schoolDay();
    const dayStr = day.toISOString().slice(0, 10);
    const { randomUUID } = await import('crypto');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO bus_pickups (id, school_id, service_id, student_id, driver_user_id, day, picked_up_at, is_absent)
       VALUES ($1, $2, $3, $4, $5, $6::date, NOW(), true)
       ON CONFLICT (service_id, student_id, day) DO UPDATE SET is_absent = true`,
      randomUUID(), schoolId, serviceId, studentId, userId, dayStr,
    );
    return { ok: true, studentId };
  }

  async dashboard(schoolId: string, userId: string, role: string | null | undefined) {
    if (role !== 'driver') throw new ForbiddenException('Μόνο ο οδηγός βλέπει το dashboard.');
    const buses = await this.prisma.extraService.findMany({
      where: { schoolId, serviceType: 'bus', isActive: true, driverUserId: userId },
      include: { busPosition: true, studentServices: { where: { isActive: true } } },
    });
    const dayKey = schoolDayKey();
    const primaryBus = buses[0] ?? null;
    // If there are 2+ separate bus records, use them as morning/afternoon respectively.
    // Otherwise (the common case: one bus does both), split students by serviceMode.
    const dedicatedAfternoonBus = buses.length >= 2 ? buses[1] : null;

    type BusRecord = typeof primaryBus;
    type StudentService = NonNullable<BusRecord>['studentServices'][number];

    const toStats = (bus: BusRecord, students: StudentService[], kind: 'pickup' | 'dropoff') => {
      if (!bus || students.length === 0) return null;
      const times = students
        .map((ss: Record<string, unknown>) => clockOf(ss as unknown as Parameters<typeof clockOf>[0], kind, dayKey))
        .filter(Boolean);
      times.sort();
      const stops = new Set(students.map((ss: Record<string, unknown>) => (ss as { stopId?: string }).stopId).filter(Boolean)).size;
      return {
        serviceId: bus.id,
        name: bus.name,
        busNumber: bus.busNumber ?? null,
        startTime: times[0] ?? null,
        stopsCount: stops || students.length,
        studentsCount: students.length,
      };
    };

    let morningRoute = null;
    let afternoonRoute = null;

    if (primaryBus) {
      const pickupStudents = primaryBus.studentServices.filter((ss) => {
        const mode = (ss as { serviceMode?: string }).serviceMode;
        return !mode || mode === 'pickup' || mode === 'both';
      });
      morningRoute = toStats(primaryBus, pickupStudents, 'pickup');

      if (dedicatedAfternoonBus) {
        afternoonRoute = toStats(dedicatedAfternoonBus, dedicatedAfternoonBus.studentServices, 'dropoff');
      } else {
        const dropoffStudents = primaryBus.studentServices.filter((ss) => {
          const mode = (ss as { serviceMode?: string }).serviceMode;
          return !mode || mode === 'dropoff' || mode === 'both';
        });
        // Fallback: if no explicit dropoff students, the whole bus does both directions
        const afternoonStudents = dropoffStudents.length > 0 ? dropoffStudents : primaryBus.studentServices;
        afternoonRoute = toStats(primaryBus, afternoonStudents, 'dropoff');
      }
    }

    // Check completions for today
    const todayDate = schoolDay();
    const todayKey = todayDate.toISOString().slice(0, 10);
    const completions = primaryBus
      ? await this.prisma.routeCompletion
          .findMany({ where: { serviceId: primaryBus.id, dayKey: todayKey } })
          .catch(() => [])
      : [];
    const morningDone = completions.some((c) => c.direction === 'pickup');
    const afternoonDone = completions.some((c) => c.direction === 'dropoff');

    if (morningRoute) (morningRoute as Record<string, unknown>).status = morningDone ? 'completed' : 'pending';
    if (afternoonRoute) (afternoonRoute as Record<string, unknown>).status = afternoonDone ? 'completed' : 'pending';

    const position = primaryBus?.busPosition;
    const ageMs = position ? Date.now() - position.updatedAt.getTime() : Infinity;
    return {
      morningRoute,
      afternoonRoute,
      isActive: ageMs < 2 * 60 * 60 * 1000,
      activeServiceId: primaryBus?.id ?? null,
    };
  }

  async completeRoute(
    schoolId: string,
    userId: string,
    role: string | null | undefined,
    data: { serviceId?: string; direction?: string; studentsCount?: number },
  ) {
    if (role !== 'driver') throw new ForbiddenException('Μόνο ο οδηγός μπορεί να ολοκληρώσει διαδρομή.');
    if (!data.serviceId || !data.direction) throw new BadRequestException('Απαιτούνται serviceId και direction.');
    const todayKey = schoolDay().toISOString().slice(0, 10);
    const completion = await this.prisma.routeCompletion.upsert({
      where: { serviceId_direction_dayKey: { serviceId: data.serviceId, direction: data.direction, dayKey: todayKey } },
      create: {
        schoolId,
        serviceId: data.serviceId,
        driverUserId: userId,
        direction: data.direction,
        dayKey: todayKey,
        studentsCount: data.studentsCount ?? 0,
      },
      update: { completedAt: new Date(), studentsCount: data.studentsCount ?? 0 },
    });
    return { ok: true, completedAt: completion.completedAt, direction: completion.direction };
  }

  async completedToday(schoolId: string) {
    const todayKey = schoolDay().toISOString().slice(0, 10);
    const completions = await this.prisma.routeCompletion
      .findMany({ where: { schoolId, dayKey: todayKey }, orderBy: { completedAt: 'desc' } })
      .catch(() => []);
    return completions.map((c) => ({
      direction: c.direction,
      studentsCount: c.studentsCount,
      completedAt: c.completedAt,
      serviceId: c.serviceId,
    }));
  }

  private async notifyClosure(schoolId: string, day: Date, reason: string) {
    const rows = await this.prisma.studentService.findMany({
      where: {
        isActive: true,
        service: { schoolId, isActive: true, OR: [{ serviceType: 'bus' }, { name: { contains: 'σχολ', mode: 'insensitive' } }] },
        student: { schoolId, isActive: true },
      },
      select: { student: { select: { parents: { select: { userId: true } } } } },
    });
    const parents = rows.flatMap((row) => row.student.parents.map((parent) => parent.userId));
    const label = `${String(day.getUTCDate()).padStart(2, '0')}/${String(day.getUTCMonth() + 1).padStart(2, '0')}/${day.getUTCFullYear()}`;
    const today = schoolDay().getTime() === day.getTime();
    await this.notifications.notifyUsers(schoolId, parents, {
      event: 'bus_closure',
      type: 'bus_closure',
      title: today ? 'Σήμερα δεν θα έχει σχολικό' : `Στις ${label} δεν θα έχει σχολικό`,
      body: `Λόγος: ${reason}`,
      data: { screen: 'bus', day: label },
    });
  }
}

function closureJson(row: { id: string; day: Date; reason: string }) {
  const day = row.day.toISOString().slice(0, 10);
  return { id: row.id, day, reason: row.reason };
}

function parseDay(value?: string) {
  const day = (value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Η ημερομηνία δεν είναι έγκυρη.');
  return new Date(`${day}T00:00:00.000Z`);
}

function schoolDay(now = new Date()) {
  const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(`${label}T00:00:00.000Z`);
}

function schoolDayKey(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Athens', weekday: 'short' }).format(now);
  const keys: Record<string, string> = { Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat' };
  return keys[name] ?? 'mon';
}

function clockOf(
  row: {
    dailyTimes: unknown;
    pickupTime: string | null;
    dropoffTime: string | null;
    stop: { pickupTime: string | null; dropoffTime: string | null } | null;
  },
  kind: 'pickup' | 'dropoff',
  dayKey: string,
) {
  const daily = row.dailyTimes;
  if (daily && typeof daily === 'object' && !Array.isArray(daily)) {
    const day = (daily as Record<string, unknown>)[dayKey];
    if (day && typeof day === 'object' && !Array.isArray(day)) {
      const value = (day as Record<string, unknown>)[kind];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  const own = kind === 'pickup' ? row.pickupTime : row.dropoffTime;
  if (own?.trim()) return own.trim();
  const stop = kind === 'pickup' ? row.stop?.pickupTime : row.stop?.dropoffTime;
  return stop?.trim() || null;
}

function minutesOf(value?: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function riderPoint(row: {
  homeLat: { toNumber?: () => number } | number | null;
  homeLng: { toNumber?: () => number } | number | null;
  stop: { latitude: { toNumber?: () => number } | number | null; longitude: { toNumber?: () => number } | number | null } | null;
}) {
  const homeLat = asNumber(row.homeLat);
  const homeLng = asNumber(row.homeLng);
  if (homeLat != null && homeLng != null) return { latitude: homeLat, longitude: homeLng };
  const stopLat = asNumber(row.stop?.latitude);
  const stopLng = asNumber(row.stop?.longitude);
  if (stopLat != null && stopLng != null) return { latitude: stopLat, longitude: stopLng };
  return null;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function destinationOf(row: {
  homeAddress: string | null;
  homeLat: { toNumber?: () => number } | number | null;
  homeLng: { toNumber?: () => number } | number | null;
  stop: { name: string; address: string | null; latitude: { toNumber?: () => number } | number | null; longitude: { toNumber?: () => number } | number | null } | null;
}) {
  const homeLat = asNumber(row.homeLat);
  const homeLng = asNumber(row.homeLng);
  if (homeLat != null && homeLng != null) {
    return { latitude: homeLat, longitude: homeLng, label: row.homeAddress || 'Σπίτι' };
  }
  const stopLat = asNumber(row.stop?.latitude);
  const stopLng = asNumber(row.stop?.longitude);
  if (stopLat != null && stopLng != null) {
    return { latitude: stopLat, longitude: stopLng, label: row.stop?.address || row.stop?.name || 'Στάση' };
  }
  return null;
}

function asNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return null;
  const number = typeof value === 'number' ? value : value.toNumber?.();
  return number != null && Number.isFinite(number) ? number : null;
}

function etaMinutes(fromLat: number, fromLng: number, toLat: number, toLng: number, speedMps: number | null) {
  const distanceKm = haversineKm(fromLat, fromLng, toLat, toLng);
  const reported = speedMps != null && speedMps > 1 ? speedMps * 3.6 : 0;
  const speedKmh = reported > 8 ? Math.min(reported, 70) : 25;
  const minutes = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
  return { minutes: Math.min(minutes, 180), distanceKm: Math.round(distanceKm * 10) / 10 };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earth = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}
