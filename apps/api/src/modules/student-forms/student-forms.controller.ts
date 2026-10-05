import { Controller, Get, Post, Param, Body, Query, Request } from '@nestjs/common';
import { StudentFormsService } from './student-forms.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller({ path: 'schools/:schoolId/student-forms', version: '1' })
export class StudentFormsController {
  constructor(private svc: StudentFormsService) {}

  @Get()
  @Roles('school_admin', 'teacher')
  findAll(
    @Param('schoolId') schoolId: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.svc.findAll(schoolId, academicYear ? Number(academicYear) : undefined);
  }

  @Get(':studentId/:year')
  findOne(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Param('year') year: string,
  ) {
    return this.svc.findOne(schoolId, studentId, Number(year));
  }

  @Post(':studentId/:year')
  upsert(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Param('year') year: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const userId = req.user?.id ?? req.user?.userId;
    return this.svc.upsert(schoolId, studentId, Number(year), userId, body);
  }
}
