import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

class RegisterDeviceDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

@Controller({ path: 'schools/:schoolId/notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('inbox')
  inbox(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.inbox(user.sub, schoolId);
  }

  @Post('inbox/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.markRead(user.sub, id);
  }

  @Post('device')
  registerDevice(
    @CurrentUser() user: JwtPayload,
    @Body() body: RegisterDeviceDto,
  ) {
    return this.svc.registerDevice(user.sub, body.token, body.platform ?? 'android');
  }

  @Get()
  @Roles('school_admin', 'teacher')
  findAll(@Param('schoolId') schoolId: string) {
    return this.svc.findAll(schoolId);
  }

  @Post('send')
  @Roles('school_admin')
  send(@Param('schoolId') schoolId: string, @Req() req: any, @Body() body: any) {
    return this.svc.send(schoolId, req.user.sub ?? req.user.userId, body);
  }

  @Get('settings')
  @Roles('school_admin')
  getSettings(@Param('schoolId') schoolId: string) {
    return this.svc.getSettings(schoolId);
  }

  @Patch('settings')
  @Roles('school_admin')
  updateSettings(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.updateSettings(schoolId, body);
  }
}
