import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseInterceptors, UploadedFile, BadRequestException, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SchoolEventsService } from './school-events.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('school-events')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('schools/:schoolId/events')
export class SchoolEventsController {
  constructor(
    private svc: SchoolEventsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@Param('schoolId') schoolId: string, @Query('status') status?: string) {
    return this.svc.list(schoolId, status);
  }

  @Get(':eventId')
  get(@Param('schoolId') schoolId: string, @Param('eventId') eventId: string) {
    return this.svc.get(schoolId, eventId);
  }

  @Post()
  create(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: any,
  ) {
    return this.svc.create(schoolId, user.sub, body);
  }

  @Put(':eventId')
  update(
    @Param('schoolId') schoolId: string,
    @Param('eventId') eventId: string,
    @Body() body: any,
  ) {
    return this.svc.update(schoolId, eventId, body);
  }

  @Delete(':eventId')
  remove(@Param('schoolId') schoolId: string, @Param('eventId') eventId: string) {
    return this.svc.remove(schoolId, eventId);
  }

  // Enrollments
  @Get(':eventId/enrollments')
  getEnrollments(@Param('schoolId') schoolId: string, @Param('eventId') eventId: string) {
    return this.svc.getEnrollments(schoolId, eventId);
  }

  @Put(':eventId/enrollments/:enrollmentId/payment')
  markPayment(
    @Param('schoolId') schoolId: string,
    @Param('eventId') eventId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { paid: boolean; paidAt?: string; notes?: string },
  ) {
    return this.svc.updateEnrollmentPayment(schoolId, eventId, enrollmentId, body.paid, body);
  }

  // Admin: manually update enrollment status (consent / payment override)
  @Put(':eventId/enrollments/:enrollmentId/admin-status')
  adminUpdateEnrollment(
    @Param('schoolId') schoolId: string,
    @Param('eventId') eventId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { status: string },
  ) {
    return this.svc.adminUpdateEnrollmentStatus(schoolId, eventId, enrollmentId, body.status);
  }

  // Parent consent (called from mobile)
  @Put('enrollments/:enrollmentId/consent')
  parentConsent(
    @CurrentUser() user: JwtPayload,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { consent: boolean },
  ) {
    return this.svc.parentConsent(user.sub, enrollmentId, body.consent);
  }

  // Parent: list events for own children
  @Get('parent/my-events')
  listForParent(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.listForParent(user.sub, schoolId);
  }

  // Teacher: list events assigned to them
  @Get('teacher/my-events')
  listForTeacher(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.listForTeacher(user.sub, schoolId);
  }

  // Media upload
  @Post(':eventId/media')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^(image\/(jpeg|jpg|png|webp|gif)|video\/(mp4|mov|avi|webm))$/)) {
        return cb(new BadRequestException('Only image and video files are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async uploadMedia(
    @Param('schoolId') schoolId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
    const url = await this.storage.upload(file, 'events');
    return this.svc.addMedia(schoolId, eventId, user.sub, url, mediaType);
  }

  @Delete(':eventId/media/:mediaId')
  removeMedia(
    @Param('schoolId') schoolId: string,
    @Param('eventId') eventId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.svc.removeMedia(schoolId, eventId, mediaId);
  }
}
