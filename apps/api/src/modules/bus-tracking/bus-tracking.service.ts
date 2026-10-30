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
    // Ensure BusSkip table exists even before migrate deploy (parent cancel tomorrow).
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bus_skips (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        day DATE NOT NULL,
        direction TEXT NOT NULL,
        reason TEXT,
        created_by_id TEXT NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS bus_skips_service_id_student_id_day_key ON bus_skips(service_id, student_id, day)`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS bus_skips_school_id_day_idx ON bus_skips(school_id, day)`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS bus_skips_service_id_day_idx ON bus_skips(service_id, day)`,
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

  async route(schoolId: string, userId: string, role: string | null | undefined, serviceId?: string, direction?: string, routeId?: string) {
    const id = await this.driverServiceId(schoolId, userId, role, serviceId);
    if (!id) return { serviceId: null, riders: [] };
    const day = schoolDay();
    const dayKey = schoolDayKey();
    const dayStr = day.toISOString().slice(0, 10);
    const [rows, pickups, absentRows, skips] = await Promise.all([
      this.prisma.studentService.findMany({
        where: {
          serviceId: id, isActive: true, student: { schoolId, isActive: true },
          ...(routeId
            ? direction === 'dropoff'
              ? { dropoffRouteId: routeId }
              : { routeId }
            : {}),
        },
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
      this.prisma.busSkip.findMany({ where: { serviceId: id, day } }).catch(() => []),
    ]);
    const picked = new Map(pickups.map((row) => [row.studentId, row.pickedUpAt]));
    const absentSet = new Set(absentRows.map((r) => r.student_id));
    const skipDir = direction === 'dropoff' ? 'dropoff' : 'pickup';
    const skippedSet = new Set(
      skips
        .filter((row) => row.direction === 'both' || row.direction === skipDir)
        .map((row) => row.studentId),
    );
    const riders = rows.map((row) => {
      const point = riderPoint(row);
      const mode = row.serviceMode || 'both';
      const parent = row.student.parents[0]?.user;
      const skippedByParent = skippedSet.has(row.student.id);
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
        isAbsent: absentSet.has(row.student.id) || skippedByParent,
        skippedByParent,
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
    const [buses, school] = await Promise.all([
      this.prisma.extraService.findMany({
        where: { schoolId, serviceType: 'bus', isActive: true, driverUserId: userId },
        include: {
          busPosition: true,
          studentServices: { where: { isActive: true } },
          routes: { where: { isActive: true }, include: { studentServices: { where: { isActive: true } } } },
        },
      }),
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { latitude: true, longitude: true, logoUrl: true },
      }),
    ]);
    const dayKey = schoolDayKey();

    type BusRecord = (typeof buses)[number];
    type StudentService = BusRecord['studentServices'][number];

    const toEntry = (
      bus: BusRecord,
      students: StudentService[],
      kind: 'pickup' | 'dropoff',
      routeId?: string,
      routeName?: string,
    ) => {
      if (students.length === 0) return null;
      const times = students
        .map((ss: Record<string, unknown>) => clockOf(ss as unknown as Parameters<typeof clockOf>[0], kind, dayKey))
        .filter(Boolean);
      times.sort();
      const stops = new Set(students.map((ss: Record<string, unknown>) => (ss as { stopId?: string }).stopId).filter(Boolean)).size;
      return {
        serviceId: bus.id,
        routeId: routeId ?? null,
        name: bus.name,
        routeName: routeName ?? null,
        busNumber: bus.busNumber ?? null,
        direction: kind,
        startTime: times[0] ?? null,
        stopsCount: stops || students.length,
        studentsCount: students.length,
        status: 'pending' as string,
      };
    };

    const routes: NonNullable<ReturnType<typeof toEntry>>[] = [];
    for (const bus of buses) {
      const activeRoutes = (bus as typeof bus & { routes: { id: string; name: string; direction: string; studentServices: StudentService[] }[] }).routes ?? [];

      if (activeRoutes.length > 0) {
        // Use explicit routes — one entry per route
        for (const r of activeRoutes) {
          const dir = r.direction === 'dropoff' ? 'dropoff' : 'pickup';
          let students: StudentService[];
          if (dir === 'dropoff') {
            // Dropoff route: find students by dropoffRouteId
            students = bus.studentServices.filter(
              (ss) => (ss as unknown as { dropoffRouteId?: string }).dropoffRouteId === r.id,
            );
            // Fallback to routeId-linked students (legacy / direction=both routes)
            if (students.length === 0) students = r.studentServices as StudentService[];
          } else {
            students = r.studentServices as StudentService[];
          }
          const entry = toEntry(bus, students, dir, r.id, r.name);
          if (entry) routes.push(entry);
        }
      } else {
        // Legacy: no routes defined — derive from studentService.serviceMode
        const pickupStudents = bus.studentServices.filter((ss) => {
          const mode = (ss as { serviceMode?: string }).serviceMode;
          return !mode || mode === 'pickup' || mode === 'both';
        });
        const dropoffStudents = bus.studentServices.filter((ss) => {
          const mode = (ss as { serviceMode?: string }).serviceMode;
          return !mode || mode === 'dropoff' || mode === 'both';
        });
        const effectiveDropoff = dropoffStudents.length > 0 ? dropoffStudents : (pickupStudents.length === 0 ? bus.studentServices : []);
        const morningEntry = toEntry(bus, pickupStudents, 'pickup');
        const afternoonEntry = toEntry(bus, effectiveDropoff, 'dropoff');
        if (morningEntry) routes.push(morningEntry);
        if (afternoonEntry) routes.push(afternoonEntry);
      }
    }

    // Sort: pickup before dropoff, then by startTime
    routes.sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === 'pickup' ? -1 : 1;
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });

    // Check completions + parent skips for today
    const today = schoolDay();
    const todayKey = today.toISOString().slice(0, 10);
    if (buses.length > 0) {
      const serviceIds = buses.map((b) => b.id);
      const [completions, skips] = await Promise.all([
        this.prisma.$queryRawUnsafe<{ service_id: string; route_id: string | null; direction: string }[]>(
          `SELECT service_id, route_id, direction FROM route_completions WHERE service_id = ANY($1::text[]) AND day_key = $2`,
          serviceIds, todayKey,
        ).catch(() => [] as { service_id: string; route_id: string | null; direction: string }[]),
        this.prisma.busSkip.findMany({
          where: { serviceId: { in: serviceIds }, day: today },
          select: { serviceId: true, studentId: true, direction: true },
        }).catch(() => [] as { serviceId: string; studentId: string; direction: string }[]),
      ]);
      for (const entry of routes) {
        const done = entry.routeId
          ? completions.some((c) => c.service_id === entry.serviceId && c.route_id === entry.routeId)
          : completions.some((c) => c.service_id === entry.serviceId && c.direction === entry.direction && !c.route_id);
        if (done) entry.status = 'completed';
        const skippedIds = new Set(
          skips
            .filter((s) => s.serviceId === entry.serviceId && (s.direction === 'both' || s.direction === entry.direction))
            .map((s) => s.studentId),
        );
        if (skippedIds.size > 0) {
          entry.studentsCount = Math.max(0, entry.studentsCount - skippedIds.size);
        }
      }
    }

    const primaryBus = buses[0] ?? null;
    const position = primaryBus?.busPosition;
    const ageMs = position ? Date.now() - position.updatedAt.getTime() : Infinity;

    return {
      routes,
      isActive: ageMs < 2 * 60 * 60 * 1000,
      activeServiceId: primaryBus?.id ?? null,
      schoolLat: school?.latitude ?? null,
      schoolLng: school?.longitude ?? null,
      schoolLogoUrl: school?.logoUrl ?? null,
      // Legacy aliases for any other consumers
      morningRoute: routes.find((r) => r.direction === 'pickup') ?? null,
      afternoonRoute: routes.find((r) => r.direction === 'dropoff') ?? null,
    };
  }

  async completeRoute(
    schoolId: string,
    userId: string,
    role: string | null | undefined,
    data: { serviceId?: string; direction?: string; routeId?: string; studentsCount?: number },
  ) {
    if (role !== 'driver') throw new ForbiddenException('Μόνο ο οδηγός μπορεί να ολοκληρώσει διαδρομή.');
    if (!data.serviceId || !data.direction) throw new BadRequestException('Απαιτούνται serviceId και direction.');
    const todayKey = schoolDay().toISOString().slice(0, 10);
    const routeId = data.routeId ?? null;
    const rows = await this.prisma.$queryRawUnsafe<{ completed_at: Date; direction: string }[]>(
      `INSERT INTO route_completions (id, school_id, service_id, driver_user_id, direction, route_id, day_key, students_count, completed_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (service_id, COALESCE(route_id, direction), day_key)
       DO UPDATE SET completed_at = NOW(), students_count = EXCLUDED.students_count
       RETURNING completed_at, direction`,
      schoolId, data.serviceId, userId, data.direction, routeId, todayKey, data.studentsCount ?? 0,
    ).catch(() => [] as { completed_at: Date; direction: string }[]);
    const completion = rows[0] ?? { completed_at: new Date(), direction: data.direction ?? '' };
    // Notify school admins
    try {
      const admins = await this.prisma.schoolMember.findMany({
        where: { schoolId, role: { in: ['school_admin'] }, isActive: true },
        select: { userId: true },
      });
      const adminIds = admins.map((a) => a.userId);
      if (adminIds.length > 0) {
        const label = data.direction === 'dropoff' ? 'Απογευματινής Παράδοσης' : 'Πρωινής Παραλαβής';
        await this.notifications.notifyUsers(schoolId, adminIds, {
          event: 'route_completed',
          type: 'route_completed',
          title: 'Ολοκλήρωση Δρομολογίου',
          body: `Το δρομολόγιο ${label} ολοκληρώθηκε επιτυχώς.`,
          data: { screen: 'bus', direction: data.direction ?? '' },
        });
      }
    } catch (_) {}

    return { ok: true, completedAt: completion.completed_at, direction: completion.direction };
  }

  async resetToday(schoolId: string) {
    const today = schoolDay();
    const todayKey = today.toISOString().slice(0, 10);
    const [pickups, completions] = await Promise.all([
      this.prisma.$executeRawUnsafe(
        `DELETE FROM bus_pickups WHERE school_id = $1 AND day = $2::date`,
        schoolId,
        todayKey,
      ),
      this.prisma.$executeRawUnsafe(
        `DELETE FROM route_completions WHERE school_id = $1 AND day_key = $2`,
        schoolId,
        todayKey,
      ),
    ]);
    return { ok: true, deletedPickups: Number(pickups), deletedCompletions: Number(completions) };
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

  async listSkips(schoolId: string, userId: string, role: string | null | undefined, studentId?: string) {
    if (role !== 'parent') throw new ForbiddenException('Η ακύρωση σχολικού είναι για γονείς.');
    const id = (studentId ?? '').trim();
    if (!id) throw new BadRequestException('Διάλεξε παιδί.');
    await this.assertParentOf(schoolId, userId, id);
    const today = schoolDay();
    const rows = await this.prisma.busSkip.findMany({
      where: { schoolId, studentId: id, day: { gte: today } },
      orderBy: { day: 'asc' },
    });
    const tomorrow = schoolTomorrow();
    return {
      today: dayIso(today),
      tomorrow: dayIso(tomorrow),
      skips: rows.map(skipJson),
    };
  }

  async createSkip(
    schoolId: string,
    userId: string,
    role: string | null | undefined,
    body: { studentId?: string; serviceId?: string; day?: string; direction?: string; reason?: string },
  ) {
    if (role !== 'parent') throw new ForbiddenException('Η ακύρωση σχολικού είναι για γονείς.');
    const studentId = (body.studentId ?? '').trim();
    if (!studentId) throw new BadRequestException('Διάλεξε παιδί.');
    await this.assertParentOf(schoolId, userId, studentId);

    const direction = normalizeSkipDirection(body.direction);
    const today = schoolDay();
    const tomorrow = schoolTomorrow();
    const day = body.day ? parseDay(body.day) : tomorrow;
    if (day.getTime() !== today.getTime() && day.getTime() !== tomorrow.getTime()) {
      throw new BadRequestException('Μπορείς να ακυρώσεις μόνο για σήμερα ή αύριο.');
    }

    const serviceId = (body.serviceId ?? '').trim() || undefined;
    const enrollment = await this.prisma.studentService.findFirst({
      where: {
        studentId,
        isActive: true,
        ...(serviceId ? { serviceId } : {}),
        service: { schoolId, serviceType: 'bus', isActive: true },
      },
      include: {
        student: { select: { fullName: true } },
        service: { select: { id: true, name: true, driverUserId: true } },
      },
    });
    if (!enrollment) throw new BadRequestException('Το παιδί δεν έχει ενεργό σχολικό.');

    const mode = enrollment.serviceMode || 'both';
    if (direction === 'pickup' && mode === 'dropoff') {
      throw new BadRequestException('Το παιδί έχει μόνο παράδοση.');
    }
    if (direction === 'dropoff' && mode === 'pickup') {
      throw new BadRequestException('Το παιδί έχει μόνο παραλαβή.');
    }
    if (direction === 'both' && mode !== 'both') {
      throw new BadRequestException(
        mode === 'pickup' ? 'Το παιδί έχει μόνο παραλαβή.' : 'Το παιδί έχει μόνο παράδοση.',
      );
    }

    const reason = (body.reason ?? '').trim().slice(0, 300) || null;
    const saved = await this.prisma.busSkip.upsert({
      where: {
        serviceId_studentId_day: {
          serviceId: enrollment.serviceId,
          studentId,
          day,
        },
      },
      create: {
        schoolId,
        serviceId: enrollment.serviceId,
        studentId,
        day,
        direction,
        reason,
        createdById: userId,
      },
      update: { direction, reason, createdById: userId },
    });

    await this.notifyDriverSkip({
      schoolId,
      driverUserId: enrollment.service.driverUserId,
      studentName: enrollment.student.fullName,
      day,
      direction,
      revoked: false,
    });

    return skipJson(saved);
  }

  async removeSkip(schoolId: string, skipId: string, userId: string, role: string | null | undefined) {
    if (role !== 'parent') throw new ForbiddenException('Η ακύρωση σχολικού είναι για γονείς.');
    const existing = await this.prisma.busSkip.findFirst({
      where: { id: skipId, schoolId },
    });
    if (!existing) throw new NotFoundException('Η ακύρωση δεν βρέθηκε.');
    if (existing.day.getTime() < schoolDay().getTime()) {
      throw new BadRequestException('Δεν γίνεται να αναιρέσεις παλιά ακύρωση.');
    }
    await this.assertParentOf(schoolId, userId, existing.studentId);

    const [student, service] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: existing.studentId, schoolId }, select: { fullName: true } }),
      this.prisma.extraService.findFirst({ where: { id: existing.serviceId, schoolId }, select: { driverUserId: true } }),
    ]);
    await this.prisma.busSkip.delete({ where: { id: existing.id } });

    await this.notifyDriverSkip({
      schoolId,
      driverUserId: service?.driverUserId ?? null,
      studentName: student?.fullName ?? 'Παιδί',
      day: existing.day,
      direction: existing.direction,
      revoked: true,
    });

    return { success: true };
  }

  private async assertParentOf(schoolId: string, parentId: string, studentId: string) {
    const link = await this.prisma.studentParent.findFirst({
      where: { userId: parentId, studentId, student: { schoolId } },
    });
    if (!link) throw new ForbiddenException('Αυτό το παιδί δεν είναι στο προφίλ σου.');
  }

  private async notifyDriverSkip(input: {
    schoolId: string;
    driverUserId: string | null | undefined;
    studentName: string;
    day: Date;
    direction: string;
    revoked: boolean;
  }) {
    if (!input.driverUserId) return;
    const label = dayLabel(input.day);
    const when = input.day.getTime() === schoolDay().getTime() ? 'σήμερα' : `αύριο (${label})`;
    const leg =
      input.direction === 'dropoff' ? 'το απόγευμα' :
      input.direction === 'pickup' ? 'το πρωί' : 'πρωί και απόγευμα';
    try {
      await this.notifications.notifyUsers(input.schoolId, [input.driverUserId], {
        event: 'bus_skip',
        type: 'bus_skip',
        title: input.revoked ? 'Ανάκληση ακύρωσης σχολικού' : 'Ακύρωση σχολικού',
        body: input.revoked
          ? `${input.studentName} θα έρθει ${when} ${leg}.`
          : `${input.studentName} δεν θα έρθει ${when} ${leg}.`,
        data: { screen: 'bus', day: dayIso(input.day), direction: input.direction },
      });
    } catch (_) {}
  }
}

function closureJson(row: { id: string; day: Date; reason: string }) {
  const day = row.day.toISOString().slice(0, 10);
  return { id: row.id, day, reason: row.reason };
}

function skipJson(row: { id: string; serviceId: string; studentId: string; day: Date; direction: string; reason: string | null }) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    studentId: row.studentId,
    day: dayIso(row.day),
    direction: row.direction,
    reason: row.reason,
  };
}

function normalizeSkipDirection(value?: string) {
  const direction = (value ?? 'both').trim().toLowerCase();
  if (direction === 'pickup' || direction === 'dropoff' || direction === 'both') return direction;
  throw new BadRequestException('Διάλεξε πρωί, απόγευμα ή και τα δύο.');
}

function parseDay(value?: string) {
  const day = (value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Η ημερομηνία δεν είναι έγκυρη.');
  return new Date(`${day}T00:00:00.000Z`);
}

function dayIso(day: Date) {
  return day.toISOString().slice(0, 10);
}

function dayLabel(day: Date) {
  return `${String(day.getUTCDate()).padStart(2, '0')}/${String(day.getUTCMonth() + 1).padStart(2, '0')}/${day.getUTCFullYear()}`;
}

function schoolDay(now = new Date()) {
  const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(`${label}T00:00:00.000Z`);
}

function schoolTomorrow(now = new Date()) {
  const today = schoolDay(now);
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
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
