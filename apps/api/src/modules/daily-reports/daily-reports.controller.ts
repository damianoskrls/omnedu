import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DailyReportsService } from './daily-reports.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('daily-reports')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/daily-reports')
export class DailyReportsController {
  constructor(private reports: DailyReportsService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Parent: get diary feed for own children' })
  feed(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload, @Query('limit') limit?: number) {
    return this.reports.getParentFeed(user.sub, schoolId, limit);
  }

  @Get('by-date')
  @Roles('teacher', 'school_admin')
  findByDate(@Param('schoolId') schoolId: string, @Query('date') date: string) {
    return this.reports.findByDate(schoolId, date);
  }

  @Get('class/:classId')
  @Roles('teacher', 'school_admin')
  findForClass(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Query('date') date: string,
  ) {
    return this.reports.findForClass(classId, schoolId, date);
  }

  @Get('student/:studentId')
  findByStudent(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Query('limit') limit?: number,
  ) {
    return this.reports.findByStudent(studentId, schoolId, limit);
  }

  @Post()
  @Roles('teacher', 'school_admin')
  @ApiOperation({ summary: 'Create or update a daily report (upsert by studentId+date)' })
  upsert(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDailyReportDto,
  ) {
    return this.reports.upsert(schoolId, user.sub, dto);
  }

  @Post('bulk')
  @Roles('teacher', 'school_admin')
  @ApiOperation({ summary: 'Bulk upsert multiple reports at once' })
  bulkUpsert(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { reports: CreateDailyReportDto[] },
  ) {
    return this.reports.bulkUpsert(schoolId, user.sub, body.reports);
  }
}
