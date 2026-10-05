import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExtraServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string) {
    return this.prisma.extraService.findMany({
      where: { schoolId },
      include: {
        _count: { select: { studentServices: { where: { isActive: true } } } },
        routes: { include: { _count: { select: { stops: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const service = await this.prisma.extraService.findFirst({
      where: { id, schoolId },
      include: {
        routes: {
          include: {
            stops: { orderBy: { order: 'asc' } },
          },
        },
        studentServices: {
          where: { isActive: true },
          include: {
            student: { select: { id: true, fullName: true, avatarUrl: true } },
            route: { select: { id: true, name: true } },
            stop: { select: { id: true, name: true, pickupTime: true, dropoffTime: true } },
          },
        },
      },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(schoolId: string, data: any) {
    return this.prisma.extraService.create({ data: { id: uuidv4(), schoolId, ...data } });
  }

  async update(id: string, schoolId: string, data: any) {
    const service = await this.prisma.extraService.findFirst({ where: { id, schoolId } });
    if (!service) throw new NotFoundException('Service not found');
    return this.prisma.extraService.update({ where: { id }, data });
  }

  async remove(id: string, schoolId: string) {
    const service = await this.prisma.extraService.findFirst({ where: { id, schoolId } });
    if (!service) throw new NotFoundException('Service not found');
    return this.prisma.extraService.delete({ where: { id } });
  }

  // ─── Routes ──────────────────────────────────────────────

  async addRoute(serviceId: string, schoolId: string, data: any) {
    const service = await this.prisma.extraService.findFirst({ where: { id: serviceId, schoolId } });
    if (!service) throw new NotFoundException('Service not found');
    return this.prisma.serviceRoute.create({ data: { id: uuidv4(), serviceId, ...data } });
  }

  async updateRoute(routeId: string, schoolId: string, data: any) {
    const route = await this.prisma.serviceRoute.findFirst({
      where: { id: routeId, service: { schoolId } },
    });
    if (!route) throw new NotFoundException('Route not found');
    return this.prisma.serviceRoute.update({ where: { id: routeId }, data });
  }

  async removeRoute(routeId: string, schoolId: string) {
    const route = await this.prisma.serviceRoute.findFirst({
      where: { id: routeId, service: { schoolId } },
    });
    if (!route) throw new NotFoundException('Route not found');
    return this.prisma.serviceRoute.delete({ where: { id: routeId } });
  }

  // ─── Stops ───────────────────────────────────────────────

  async addStop(routeId: string, schoolId: string, data: any) {
    const route = await this.prisma.serviceRoute.findFirst({
      where: { id: routeId, service: { schoolId } },
    });
    if (!route) throw new NotFoundException('Route not found');
    const maxOrder = await this.prisma.routeStop.aggregate({
      where: { routeId },
      _max: { order: true },
    });
    const order = data.order ?? (maxOrder._max.order ?? 0) + 1;
    return this.prisma.routeStop.create({ data: { id: uuidv4(), routeId, ...data, order } });
  }

  async updateStop(stopId: string, schoolId: string, data: any) {
    const stop = await this.prisma.routeStop.findFirst({
      where: { id: stopId, route: { service: { schoolId } } },
    });
    if (!stop) throw new NotFoundException('Stop not found');
    return this.prisma.routeStop.update({ where: { id: stopId }, data });
  }

  async removeStop(stopId: string, schoolId: string) {
    const stop = await this.prisma.routeStop.findFirst({
      where: { id: stopId, route: { service: { schoolId } } },
    });
    if (!stop) throw new NotFoundException('Stop not found');
    return this.prisma.routeStop.delete({ where: { id: stopId } });
  }

  // ─── Student Assignments ─────────────────────────────────

  async getStudents(serviceId: string, schoolId: string) {
    const service = await this.prisma.extraService.findFirst({ where: { id: serviceId, schoolId } });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.studentService.findMany({
      where: { serviceId },
      include: {
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        route: { select: { id: true, name: true } },
        stop: { select: { id: true, name: true, pickupTime: true, dropoffTime: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async assignStudent(serviceId: string, schoolId: string, data: any) {
    const service = await this.prisma.extraService.findFirst({ where: { id: serviceId, schoolId } });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.studentService.upsert({
      where: { studentId_serviceId: { studentId: data.studentId, serviceId } },
      create: { id: uuidv4(), serviceId, ...data, isActive: true },
      update: { ...data, isActive: true },
    });
  }

  async updateStudentService(id: string, schoolId: string, data: any) {
    const ss = await this.prisma.studentService.findFirst({
      where: { id, service: { schoolId } },
    });
    if (!ss) throw new NotFoundException('Student service not found');
    return this.prisma.studentService.update({ where: { id }, data });
  }

  async removeStudentService(id: string, schoolId: string) {
    const ss = await this.prisma.studentService.findFirst({
      where: { id, service: { schoolId } },
    });
    if (!ss) throw new NotFoundException('Student service not found');
    return this.prisma.studentService.update({ where: { id }, data: { isActive: false } });
  }
}
