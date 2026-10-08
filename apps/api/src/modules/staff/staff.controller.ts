import { Controller, Get, Post, Patch, Delete, Body, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('staff')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/staff')
export class StaffController {
  constructor(
    private staff: StaffService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  findAll(@Param('schoolId') schoolId: string) {
    return this.staff.findAll(schoolId);
  }

  @Get(':memberId')
  findOne(@Param('schoolId') schoolId: string, @Param('memberId') memberId: string) {
    return this.staff.findOne(memberId, schoolId);
  }

  @Patch(':memberId/profile')
  @Roles('school_admin')
  upsertProfile(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
    @Body() body: any,
  ) {
    return this.staff.upsertProfile(memberId, schoolId, body);
  }

  @Delete(':memberId')
  @Roles('school_admin')
  remove(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staff.remove(memberId, schoolId, user.sub);
  }

  @Get(':memberId/salary')
  getSalary(@Param('schoolId') schoolId: string, @Param('memberId') memberId: string) {
    return this.staff.getSalary(memberId, schoolId);
  }

  @Post(':memberId/salary')
  @Roles('school_admin')
  createSalary(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
    @Body() body: any,
  ) {
    return this.staff.createSalary(memberId, schoolId, body);
  }

  @Get(':memberId/leaves')
  getLeaves(@Param('schoolId') schoolId: string, @Param('memberId') memberId: string) {
    return this.staff.getLeaves(memberId, schoolId);
  }

  @Post(':memberId/leaves')
  createLeave(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
    @Body() body: any,
  ) {
    return this.staff.createLeave(memberId, schoolId, body);
  }

  @Patch(':memberId/leaves/:leaveId')
  @Roles('school_admin')
  updateLeave(
    @Param('leaveId') leaveId: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staff.updateLeaveStatus(leaveId, body.status, user.sub);
  }

  @Post(':memberId/avatar')
  @Roles('school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|webp|gif)$/)) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadAvatar(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = await this.storage.upload(file, 'avatars');
    return this.staff.updateAvatar(memberId, schoolId, avatarUrl);
  }
}
