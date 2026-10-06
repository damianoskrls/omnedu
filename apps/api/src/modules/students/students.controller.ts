import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('students')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/students')
export class StudentsController {
  constructor(
    private students: StudentsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Query('classId') classId?: string,
    @Query('isActive') isActive?: string,
  ) {
    if (user.role === 'parent') return this.students.findByParent(user.sub, schoolId);
    const active = isActive === 'false' ? false : isActive === 'true' ? true : undefined;
    return this.students.findAll(schoolId, classId, active);
  }

  @Get('my-children')
  myChildren(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.students.findByParent(user.sub, schoolId);
  }

  @Get(':id')
  findOne(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.students.findOne(id, schoolId, user.role === 'parent' ? user.sub : undefined);
  }

  @Post()
  @Roles('school_admin')
  create(@Param('schoolId') schoolId: string, @Body() dto: CreateStudentDto) {
    return this.students.create(schoolId, dto);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(@Param('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.students.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  permanentDelete(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.students.permanentDelete(id, schoolId);
  }

  @Post(':id/enroll')
  @Roles('school_admin')
  enroll(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: { classId: string },
  ) {
    return this.students.upsertEnrollment(id, schoolId, body.classId);
  }

  @Get(':id/siblings')
  getSiblings(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.students.getSiblings(id, schoolId);
  }

  @Post(':id/parents')
  @Roles('school_admin')
  addParent(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: { fullName: string; email?: string; phone?: string; relation?: string; isPrimary?: boolean },
  ) {
    return this.students.addParent(id, schoolId, body);
  }

  @Patch(':id/parents/:parentId')
  @Roles('school_admin')
  updateParent(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Param('parentId') parentId: string,
    @Body() body: { fullName?: string; phone?: string; relation?: string; isPrimary?: boolean },
  ) {
    return this.students.updateParent(id, schoolId, parentId, body);
  }

  @Delete(':id/parents/:parentId')
  @Roles('school_admin')
  removeParent(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Param('parentId') parentId: string,
  ) {
    return this.students.removeParent(id, schoolId, parentId);
  }

  @Post(':id/siblings')
  @Roles('school_admin')
  linkSibling(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: { siblingId: string },
  ) {
    return this.students.linkSibling(id, body.siblingId, schoolId);
  }

  @Delete(':id/siblings/:siblingId')
  @Roles('school_admin')
  unlinkSibling(@Param('id') id: string, @Param('siblingId') siblingId: string) {
    return this.students.unlinkSibling(id, siblingId);
  }

  @Get(':id/documents')
  getDocuments(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.students.getDocuments(id, schoolId, academicYear);
  }

  @Delete(':id/documents/:docId')
  @Roles('school_admin')
  deleteDocument(
    @Param('schoolId') schoolId: string,
    @Param('docId') docId: string,
  ) {
    return this.students.deleteDocument(docId, schoolId);
  }

  @Post(':id/documents')
  @Roles('school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadDocument(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; category?: string; notes?: string; academicYear?: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const fileUrl = await this.storage.upload(file, 'documents');
    return this.students.createDocument(id, schoolId, {
      title: body.title || file.originalname,
      fileUrl,
      fileType: file.mimetype,
      fileSize: file.size,
      category: body.category || 'other',
      notes: body.notes,
      academicYear: body.academicYear,
    });
  }

  @Post(':id/avatar')
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
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = await this.storage.upload(file, 'avatars');
    return this.students.update(id, schoolId, { avatarUrl });
  }
}
