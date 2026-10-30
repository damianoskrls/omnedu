// Called by: NestJS via AttendanceModule → AppModule imports. Routes hit by Flutter TeacherAttendanceScreen.
// No prior attendance controller (glob attendance/** = 0). Schema via AttendanceService.
// User: «θελω ο εκπαιδευτικός ... να εχει ενα κουμπι παρουσιολογιο για σημερα»
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { SaveAttendanceDto } from './dto/save-attendance.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/attendance')
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Get()
  @Roles('teacher', 'school_admin', 'owner')
  @ApiOperation({ summary: 'Get class attendance for a date (default today)' })
  getForClass(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('classId') classId: string,
    @Query('date') date?: string,
  ) {
    // Prefer client date; fallback uses Europe/Athens local calendar day.
    const day =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Athens',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date());
    return this.attendance.getForClass(schoolId, classId, day, user.sub);
  }

  @Put()
  @Roles('teacher', 'school_admin', 'owner')
  @ApiOperation({ summary: 'Save present/absent marks for a class day' })
  save(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveAttendanceDto,
  ) {
    return this.attendance.save(schoolId, user.sub, dto);
  }
}
