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

  @Post()
  @Roles('school_admin')
  createOwner(
    @Param('schoolId') schoolId: string,
    @Body() body: { fullName?: string; phone?: string },
  ) {
    return this.staff.createOwner(schoolId, body);
  }

  @Get('me/leaves')
  myLeaves(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.staff.myLeaves(schoolId, user.sub);
  }

  @Post('me/leaves')
  @Roles('teacher', 'school_admin')
  createMyLeave(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { leaveType: string; startDate: string; endDate: string; notes?: string },
  ) {
    return this.staff.createMyLeave(schoolId, user.sub, body);
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

  @Patch(':memberId/salary/:salaryId')
  @Roles('school_admin')
  updateSalary(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
    @Param('salaryId') salaryId: string,
    @Body() body: any,
  ) {
    return this.staff.updateSalary(memberId, schoolId, salaryId, body);
  }

  @Delete(':memberId/salary/:salaryId')
  @Roles('school_admin')
  deleteSalary(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
    @Param('salaryId') salaryId: string,
  ) {
    return this.staff.deleteSalary(memberId, schoolId, salaryId);
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
    @Param('schoolId') schoolId: string,
    @Param('leaveId') leaveId: string,
    @Body() body: { status?: string; leaveType?: string; startDate?: string; endDate?: string; notes?: string | null },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staff.updateLeave(leaveId, schoolId, body, user.sub);
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
