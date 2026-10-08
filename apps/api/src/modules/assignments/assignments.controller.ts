import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../common/storage/storage.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('schools/:schoolId/assignments')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService, private readonly storage: StorageService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.service.findAll(schoolId, user, classId, studentId);
  }

  @Post()
  create(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { classId?: string; title?: string; instructions?: string; fileUrls?: string[] },
  ) {
    return this.service.create(schoolId, user.sub, user.role, body);
  }

  @Post('media')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/)) {
        return cb(new BadRequestException('Επιτρέπονται JPG, PNG και PDF'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 25 * 1024 * 1024 },
  }))
  async uploadMedia(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtPayload) {
    if (user.role === 'parent') throw new ForbiddenException('Οι γονείς δεν ανεβάζουν αρχεία.');
    if (!file) throw new BadRequestException('Δεν επιλέχθηκε αρχείο');
    const pdf = file.mimetype === 'application/pdf';
    const url = await this.storage.upload(file, 'assignments', pdf ? 'raw' : 'image');
    return { url, kind: pdf ? 'pdf' : 'image' };
  }

  @Delete(':id')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(schoolId, id, user.role);
  }
}
