import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller({ path: 'schools/:schoolId/notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

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
