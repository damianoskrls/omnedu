import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PartyInvitationsService } from './party-invitations.service';
import { StorageService } from '../../common/storage/storage.service';

@Controller('schools/:schoolId/party-invitations')
@UseGuards(JwtAuthGuard)
export class PartyInvitationsController {
  constructor(
    private readonly service: PartyInvitationsService,
    private readonly storage: StorageService,
  ) {}

  @Post('upload-attachment')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/)) {
        return cb(new BadRequestException('Επιτρέπονται εικόνες και PDF'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.storage.upload(file, 'party-invitations');
    return { url, type: file.mimetype === 'application/pdf' ? 'pdf' : 'image' };
  }

  @Get()
  list(@Param('schoolId') schoolId: string) {
    return this.service.list(schoolId);
  }

  @Get('received')
  listReceived(@Param('schoolId') schoolId: string, @Request() req: any) {
    return this.service.listReceived(schoolId, req.user.sub);
  }

  @Get('sent-by-my-child')
  listSentByMyChild(@Param('schoolId') schoolId: string, @Request() req: any) {
    return this.service.listSentByMyChild(schoolId, req.user.sub);
  }

  @Get(':id')
  get(@Param('schoolId') schoolId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.get(schoolId, id, req.user.sub);
  }

  @Post()
  create(@Param('schoolId') schoolId: string, @Body() body: {
    birthdayStudentId: string;
    title: string;
    body?: string;
    imageUrl?: string;
    pdfUrl?: string;
    eventDate?: string;
    recipientStudentIds: string[];
  }) {
    return this.service.create(schoolId, body);
  }

  @Put(':id')
  update(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      body?: string;
      imageUrl?: string;
      pdfUrl?: string;
      eventDate?: string;
      recipientStudentIds?: string[];
    },
  ) {
    return this.service.update(schoolId, id, body);
  }

  @Delete(':id')
  delete(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.delete(schoolId, id);
  }

  @Post(':id/send')
  send(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.send(schoolId, id, false);
  }

  @Post(':id/remind')
  remind(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.send(schoolId, id, true);
  }
}
