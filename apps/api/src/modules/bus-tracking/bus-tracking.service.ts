import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BusTrackingService {
  constructor(private prisma: PrismaService) {}

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
