import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ThematicPlansService } from './thematic-plans.service';

@Controller({ path: 'schools/:schoolId/thematic-plans', version: '1' })
export class ThematicPlansController {
  constructor(private svc: ThematicPlansService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('month') month?: string,
    @Query('classId') classId?: string,
  ) {
    return this.svc.findAll(schoolId, user, month, classId);
  }

  @Post()
  @Roles('school_admin', 'teacher')
  upsert(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.svc.upsert(schoolId, user, body);
  }

  @Delete(':id')
  @Roles('school_admin', 'teacher')
  remove(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(id, schoolId, user);
  }
}
