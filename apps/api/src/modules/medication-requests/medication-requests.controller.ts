import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { MedicationRequestsService } from './medication-requests.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller({ path: 'schools/:schoolId/medication-requests', version: '1' })
export class MedicationRequestsController {
  constructor(private svc: MedicationRequestsService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(schoolId, studentId, status);
  }

  @Get('mine')
  mine(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    if (user.role === 'parent') return this.svc.findForParent(schoolId, user.sub);
    if (user.role === 'owner') return this.svc.findAll(schoolId, undefined, 'approved');
    return this.svc.findForTeacher(schoolId, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Param('schoolId') schoolId: string) {
    return this.svc.findOne(id, schoolId);
  }

  @Post()
  create(
    @Param('schoolId') schoolId: string,
    @Body() body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.create(schoolId, user.sub, body);
  }

  @Patch(':id/consent')
  @Roles('parent')
  consent(
    @Param('id') id: string,
    @Param('schoolId') schoolId: string,
    @Body() body: { decision?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
    return this.svc.consent(id, schoolId, user.sub, decision);
  }

  @Patch(':id/acknowledge')
  @Roles('school_admin', 'teacher')
  acknowledge(
    @Param('id') id: string,
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.acknowledge(id, schoolId, user.sub);
  }

  @Patch(':id/status')
  @Roles('school_admin', 'teacher')
  updateStatus(
    @Param('id') id: string,
    @Param('schoolId') schoolId: string,
    @Body() body: { status: string },
  ) {
    return this.svc.updateStatus(id, schoolId, body.status);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
