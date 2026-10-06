import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThematicPlansService } from './thematic-plans.service';

@Controller({ path: 'schools/:schoolId/thematic-plans', version: '1' })
export class ThematicPlansController {
  constructor(private svc: ThematicPlansService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @Query('month') month?: string,
    @Query('classId') classId?: string,
  ) {
    return this.svc.findAll(schoolId, month, classId);
  }

  @Post()
  @Roles('school_admin', 'teacher')
  upsert(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.upsert(schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin', 'teacher')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.remove(id, schoolId);
  }
}
