import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('schools')
@ApiBearerAuth('access-token')
@Controller('schools')
export class SchoolsController {
  constructor(
    private schools: SchoolsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Roles('super_admin')
  @ApiOperation({ summary: 'List all schools (super admin)' })
  findAll() {
    return this.schools.findAll();
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new school tenant (super admin)' })
  create(@Body() dto: CreateSchoolDto) {
    return this.schools.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a school by ID' })
  findOne(@Param('id') id: string) {
    return this.schools.findOne(id);
  }

  @Patch(':id')
  @Roles('super_admin', 'school_admin')
  update(@Param('id') id: string, @Body() body: any) {
    return this.schools.update(id, body);
  }

  @Get(':id/members')
  @Roles('super_admin', 'school_admin')
  getMembers(@Param('id') id: string, @Query('role') role?: string) {
    return this.schools.getMembers(id, role);
  }

  @Post(':id/members')
  @Roles('super_admin', 'school_admin')
  addMember(
    @Param('id') schoolId: string,
    @Body() body: { userId: string; role: 'school_admin' | 'teacher' | 'parent' },
  ) {
    return this.schools.addMember(schoolId, body.userId, body.role);
  }

  @Get(':id/holidays')
  getHolidays(@Param('id') id: string, @Query('academicYear') academicYear?: string) {
    return this.schools.getHolidays(id, academicYear);
  }

  @Post(':id/holidays')
  @Roles('super_admin', 'school_admin')
  createHoliday(@Param('id') id: string, @Body() body: { date: string; name: string; academicYear?: string }) {
    return this.schools.createHoliday(id, body);
  }

  @Delete(':id/holidays/:holidayId')
  @Roles('super_admin', 'school_admin')
  deleteHoliday(@Param('id') id: string, @Param('holidayId') holidayId: string) {
    return this.schools.deleteHoliday(id, holidayId);
  }

  @Post(':id/logo')
  @Roles('super_admin', 'school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Only images allowed'), false);
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const logoUrl = await this.storage.upload(file, 'logos');
    await this.schools.update(id, { logoUrl });
    return { logoUrl };
  }
}
