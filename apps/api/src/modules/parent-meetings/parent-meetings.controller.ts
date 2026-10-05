import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ParentMeetingsService } from './parent-meetings.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller({ path: 'schools/:schoolId/parent-meetings', version: '1' })
export class ParentMeetingsController {
  constructor(private svc: ParentMeetingsService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @Query('classId') classId?: string,
    @Query('levelId') levelId?: string,
  ) {
    return this.svc.findAll(schoolId, classId, levelId);
  }

  @Post()
  @Roles('school_admin', 'teacher')
  create(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.create(schoolId, body);
  }

  @Patch(':id')
  @Roles('school_admin', 'teacher')
  update(@Param('id') id: string, @Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
