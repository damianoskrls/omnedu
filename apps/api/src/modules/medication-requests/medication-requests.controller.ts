import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { MedicationRequestsService } from './medication-requests.service';
import { Roles } from '../../common/decorators/roles.decorator';

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

  @Get(':id')
  findOne(@Param('id') id: string, @Param('schoolId') schoolId: string) {
    return this.svc.findOne(id, schoolId);
  }

  @Post()
  create(
    @Param('schoolId') schoolId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const userId = req.user?.id ?? req.user?.userId;
    return this.svc.create(schoolId, userId, body);
  }

  @Patch(':id/acknowledge')
  @Roles('school_admin', 'teacher')
  acknowledge(
    @Param('id') id: string,
    @Param('schoolId') schoolId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id ?? req.user?.userId;
    return this.svc.acknowledge(id, schoolId, userId);
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
