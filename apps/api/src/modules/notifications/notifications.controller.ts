import { BadRequestException, Body, Controller, Get, HttpException, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StorageService } from '../../common/storage/storage.service';
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

  @IsOptional()
  @IsString()
  deviceId?: string;
}

@Controller({ path: 'schools/:schoolId/notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  @Get('inbox')
  inbox(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.inbox(user.sub, schoolId, user.role);
  }

  @Get('unread-count')
  unreadCount(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.unreadCount(user.sub, schoolId);
  }

  @Post('inbox/read-all')
  markAllRead(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.markAllRead(user.sub, schoolId);
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
    return this.svc.registerDevice(user.sub, body.token, body.platform ?? 'android', body.deviceId);
  }

  @Post('image')
  @Roles('school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Μόνο εικόνα επιτρέπεται.'), false);
      cb(null, true);
    },
    limits: { fileSize: 8 * 1024 * 1024 },
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Διάλεξε εικόνα.');
    try {
      const imageUrl = await this.storage.upload(file, 'notifications');
      return { imageUrl };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('Η εικόνα δεν ανέβηκε. Δοκίμασε μια μικρότερη JPG ή PNG.');
    }
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
