import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ParentMeetingsService } from './parent-meetings.service';

@Controller({ path: 'schools/:schoolId/parent-meetings', version: '1' })
export class ParentMeetingsController {
  constructor(private svc: ParentMeetingsService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('classId') classId?: string,
    @Query('levelId') levelId?: string,
  ) {
    return this.svc.findAll(schoolId, user, classId, levelId);
  }

  @Post()
  @Roles('school_admin', 'teacher')
  create(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.svc.create(schoolId, user, body);
  }

  @Post(':id/requests')
  @Roles('parent')
  requestSlot(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { studentId?: string; slotTime?: string },
  ) {
    return this.svc.requestSlot(schoolId, user, id, body);
  }

  @Patch(':id/requests/:requestId')
  @Roles('school_admin', 'teacher')
  decide(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { status?: string },
  ) {
    return this.svc.decide(schoolId, user, id, requestId, String(body.status ?? ''));
  }

  @Patch(':id')
  @Roles('school_admin', 'teacher')
  update(@Param('id') id: string, @Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('id') id: string, @Param('schoolId') schoolId: string) {
    return this.svc.remove(id, schoolId);
  }
}
