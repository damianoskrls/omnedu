import { Controller, Get, Post, Patch, Body, Param, Query, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('activities')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/activities')
export class ActivitiesController {
  constructor(
    private activities: ActivitiesService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  findAll(@Param('schoolId') schoolId: string, @Query('type') type?: string) {
    return this.activities.findAll(schoolId, type);
  }

  @Get(':id')
  findOne(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.activities.findOne(id, schoolId);
  }

  @Post()
  @Roles('school_admin')
  create(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.activities.create(schoolId, body);
  }

  @Post(':id/register')
  register(
    @Param('id') activityId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { studentId: string },
  ) {
    return this.activities.register(activityId, body.studentId, user.sub);
  }

  @Delete(':id/register/:studentId')
  cancel(@Param('id') activityId: string, @Param('studentId') studentId: string) {
    return this.activities.cancelRegistration(activityId, studentId);
  }

  @Get('registrations/mine')
  myRegistrations(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.activities.getRegistrationsForParent(user.sub, schoolId);
  }

  @Get(':id/registrations')
  @Roles('school_admin')
  getRegistrations(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.activities.getRegistrations(id, schoolId);
  }

  @Post(':id/enroll')
  @Roles('school_admin')
  adminEnroll(
    @Param('schoolId') schoolId: string,
    @Param('id') activityId: string,
    @Body() body: { studentId: string; notes?: string },
  ) {
    return this.activities.adminEnroll(activityId, schoolId, body.studentId, body.notes);
  }

  @Patch(':id/registrations/:regId/status')
  @Roles('school_admin')
  updateStatus(
    @Param('schoolId') schoolId: string,
    @Param('regId') regId: string,
    @Body('status') status: string,
  ) {
    return this.activities.updateRegistrationStatus(regId, schoolId, status);
  }

  @Delete(':id/registrations/:regId')
  @Roles('school_admin')
  removeRegistration(
    @Param('schoolId') schoolId: string,
    @Param('regId') regId: string,
  ) {
    return this.activities.removeRegistration(regId, schoolId);
  }

  @Post(':id/image')
  @Roles('school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Only images allowed'), false);
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadImage(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const imageUrl = await this.storage.upload(file, 'activities');
    await this.activities.update(id, schoolId, { imageUrl });
    return { imageUrl };
  }

  @Patch(':id')
  @Roles('school_admin')
  update(@Param('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.activities.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.activities.remove(id, schoolId);
  }

  // ── Schedule ─────────────────────────────────────────────

  @Get('schedule/all')
  @Roles('school_admin')
  getSchedule(@Param('schoolId') schoolId: string) {
    return this.activities.getSchedule(schoolId);
  }

  @Post(':id/schedule')
  @Roles('school_admin')
  addScheduleSlot(
    @Param('schoolId') schoolId: string,
    @Param('id') activityId: string,
    @Body() body: { dayOfWeek: number; startTime?: string; endTime?: string; notes?: string },
  ) {
    return this.activities.addScheduleSlot(activityId, schoolId, body);
  }

  @Delete(':id/schedule/:slotId')
  @Roles('school_admin')
  deleteScheduleSlot(@Param('schoolId') schoolId: string, @Param('slotId') slotId: string) {
    return this.activities.deleteScheduleSlot(slotId, schoolId);
  }

  // ── Instructors ───────────────────────────────────────────

  @Get('instructors/all')
  @Roles('school_admin')
  getInstructors(@Param('schoolId') schoolId: string) {
    return this.activities.getInstructors(schoolId);
  }

  @Post('instructors/create')
  @Roles('school_admin')
  createInstructor(
    @Param('schoolId') schoolId: string,
    @Body() body: { name: string; title?: string; bio?: string; photoUrl?: string },
  ) {
    return this.activities.createInstructor(schoolId, body);
  }

  @Patch('instructors/:instructorId')
  @Roles('school_admin')
  updateInstructor(
    @Param('schoolId') schoolId: string,
    @Param('instructorId') instructorId: string,
    @Body() body: any,
  ) {
    return this.activities.updateInstructor(instructorId, schoolId, body);
  }

  @Delete('instructors/:instructorId')
  @Roles('school_admin')
  deleteInstructor(@Param('schoolId') schoolId: string, @Param('instructorId') instructorId: string) {
    return this.activities.deleteInstructor(instructorId, schoolId);
  }

  @Post('instructors/:instructorId/photo')
  @Roles('school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Only images allowed'), false);
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadInstructorPhoto(
    @Param('schoolId') schoolId: string,
    @Param('instructorId') instructorId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const photoUrl = await this.storage.upload(file, 'instructors');
    await this.activities.updateInstructor(instructorId, schoolId, { photoUrl });
    return { photoUrl };
  }

  @Post(':id/instructors/:instructorId')
  @Roles('school_admin')
  assignInstructor(
    @Param('schoolId') schoolId: string,
    @Param('id') activityId: string,
    @Param('instructorId') instructorId: string,
  ) {
    return this.activities.assignInstructor(activityId, instructorId, schoolId);
  }

  @Delete(':id/instructors/:instructorId')
  @Roles('school_admin')
  unassignInstructor(
    @Param('schoolId') schoolId: string,
    @Param('id') activityId: string,
    @Param('instructorId') instructorId: string,
  ) {
    return this.activities.unassignInstructor(activityId, instructorId, schoolId);
  }
}
