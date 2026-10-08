import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('overview')
  @Roles('school_admin')
  overview(
    @Param('schoolId') schoolId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('fromMonth') fromMonth?: string,
    @Query('fromYear') fromYear?: string,
    @Query('toMonth') toMonth?: string,
    @Query('toYear') toYear?: string,
  ) {
    return this.reports.overview(schoolId, {
      academicYearId,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      fromMonth: fromMonth ? Number(fromMonth) : undefined,
      fromYear: fromYear ? Number(fromYear) : undefined,
      toMonth: toMonth ? Number(toMonth) : undefined,
      toYear: toYear ? Number(toYear) : undefined,
    });
  }
}
