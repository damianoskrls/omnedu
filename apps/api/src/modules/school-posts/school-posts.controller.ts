import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SchoolPostsService } from './school-posts.service';
import { StorageService } from '../../common/storage/storage.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('school-posts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('schools/:schoolId/posts')
export class SchoolPostsController {
  constructor(
    private readonly service: SchoolPostsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  findAll(@Param('schoolId') schoolId: string, @Query('type') type?: string) {
    return this.service.findAll(schoolId, type);
  }

  @Get(':id')
  findOne(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.findOne(id, schoolId);
  }

  @Post()
  create(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; content?: string; postType?: string; mediaUrls?: string[]; publishedAt?: string; audienceType?: string; audienceIds?: string[] | string },
  ) {
    return this.service.create(schoolId, user.sub, body);
  }

  @Post('media')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp|gif)$/)) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.storage.upload(file, 'posts');
    return { url };
  }

  @Put(':id')
  update(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { title?: string; content?: string; postType?: string; mediaUrls?: string[]; publishedAt?: string | null; audienceType?: string; audienceIds?: string[] | string },
  ) {
    return this.service.update(id, schoolId, user.sub, body);
  }

  @Delete(':id')
  delete(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.delete(id, schoolId);
  }
}
