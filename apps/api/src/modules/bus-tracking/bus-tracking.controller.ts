import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BusTrackingService } from './bus-tracking.service';

@ApiTags('bus-tracking')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools/:schoolId/bus-tracking')
export class BusTrackingController {
  constructor(private readonly service: BusTrackingService) {}

  @Get('drivers')
  @Roles('school_admin')
  drivers(@Param('schoolId') schoolId: string) {
    return this.service.drivers(schoolId);
  }

  @Get('mine')
  mine(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.service.mine(schoolId, user.sub, user.role);
  }

  @Post('ping')
  ping(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { serviceId?: string; latitude?: number; longitude?: number; heading?: number; speed?: number },
  ) {
    return this.service.ping(schoolId, user.sub, user.role, body);
  }

  @Get('route')
  route(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.service.route(schoolId, user.sub, user.role, serviceId);
  }

  @Post('pickup')
  pickup(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { serviceId?: string; studentId?: string },
  ) {
    return this.service.pickup(schoolId, user.sub, user.role, body);
  }

  @Get('student/:studentId')
  forStudent(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.forStudent(schoolId, user.sub, user.role, studentId);
  }
}
