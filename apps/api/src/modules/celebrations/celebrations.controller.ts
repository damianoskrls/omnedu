import { BadRequestException, Body, Controller, Delete, Get, HttpException, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../common/storage/storage.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CelebrationsService } from './celebrations.service';

@ApiTags('celebrations')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/celebrations')
export class CelebrationsController {
  constructor(
    private svc: CelebrationsService,
    private storage: StorageService,
  ) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.svc.findAll(schoolId, user, academicYear);
  }

  @Post()
  @Roles('school_admin')
  create(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.create(schoolId, body);
  }

  @Post(':id/image')
  @Roles('school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Μόνο εικόνα επιτρέπεται.'), false);
      cb(null, true);
    },
    limits: { fileSize: 8 * 1024 * 1024 },
  }))
  async uploadImage(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Διάλεξε εικόνα.');
    try {
      const imageUrl = await this.storage.upload(file, 'celebrations');
      await this.svc.setImage(id, schoolId, imageUrl);
      return { imageUrl };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('Το πόστερ δεν ανέβηκε. Δοκίμασε μια μικρότερη εικόνα JPG ή PNG.');
    }
  }

  @Patch(':id')
  @Roles('school_admin')
  update(@Param('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.remove(id, schoolId);
  }
}
