import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExtraServicesService } from './extra-services.service';

@ApiTags('extra-services')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools/:schoolId/extra-services')
export class ExtraServicesController {
  constructor(private svc: ExtraServicesService) {}

  // ─── Services ────────────────────────────────────────────

  @Get()
  findAll(@Param('schoolId') schoolId: string) {
    return this.svc.findAll(schoolId);
  }

  @Get(':id')
  findOne(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.findOne(id, schoolId);
  }

  @Post()
  @Roles('school_admin')
  create(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.create(schoolId, body);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(@Param('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.remove(id, schoolId);
  }

  // ─── Routes ──────────────────────────────────────────────

  @Post(':id/routes')
  @Roles('school_admin')
  addRoute(
    @Param('schoolId') schoolId: string,
    @Param('id') serviceId: string,
    @Body() body: any,
  ) {
    return this.svc.addRoute(serviceId, schoolId, body);
  }

  @Patch(':id/routes/:routeId')
  @Roles('school_admin')
  updateRoute(
    @Param('schoolId') schoolId: string,
    @Param('routeId') routeId: string,
    @Body() body: any,
  ) {
    return this.svc.updateRoute(routeId, schoolId, body);
  }

  @Delete(':id/routes/:routeId')
  @Roles('school_admin')
  removeRoute(@Param('schoolId') schoolId: string, @Param('routeId') routeId: string) {
    return this.svc.removeRoute(routeId, schoolId);
  }

  // ─── Stops ───────────────────────────────────────────────

  @Post(':id/routes/:routeId/stops')
  @Roles('school_admin')
  addStop(
    @Param('schoolId') schoolId: string,
    @Param('routeId') routeId: string,
    @Body() body: any,
  ) {
    return this.svc.addStop(routeId, schoolId, body);
  }

  @Patch(':id/routes/:routeId/stops/:stopId')
  @Roles('school_admin')
  updateStop(
    @Param('schoolId') schoolId: string,
    @Param('stopId') stopId: string,
    @Body() body: any,
  ) {
    return this.svc.updateStop(stopId, schoolId, body);
  }

  @Delete(':id/routes/:routeId/stops/:stopId')
  @Roles('school_admin')
  removeStop(@Param('schoolId') schoolId: string, @Param('stopId') stopId: string) {
    return this.svc.removeStop(stopId, schoolId);
  }

  // ─── Students ────────────────────────────────────────────

  @Get(':id/students')
  getStudents(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.getStudents(id, schoolId);
  }

  @Post(':id/students')
  @Roles('school_admin')
  assignStudent(
    @Param('schoolId') schoolId: string,
    @Param('id') serviceId: string,
    @Body() body: any,
  ) {
    return this.svc.assignStudent(serviceId, schoolId, body);
  }

  @Patch(':id/students/:ssId')
  @Roles('school_admin')
  updateStudentService(
    @Param('schoolId') schoolId: string,
    @Param('ssId') ssId: string,
    @Body() body: any,
  ) {
    return this.svc.updateStudentService(ssId, schoolId, body);
  }

  @Delete(':id/students/:ssId')
  @Roles('school_admin')
  removeStudentService(@Param('schoolId') schoolId: string, @Param('ssId') ssId: string) {
    return this.svc.removeStudentService(ssId, schoolId);
  }
}
