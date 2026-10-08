import { Controller, Get, Param } from '@nestjs/common';
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
  overview(@Param('schoolId') schoolId: string) {
    return this.reports.overview(schoolId);
  }
}
