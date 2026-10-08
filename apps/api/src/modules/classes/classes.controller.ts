import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('classes')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/classes')
export class ClassesController {
  constructor(private classes: ClassesService) {}

  @Get()
  findAll(@Param('schoolId') schoolId: string, @Query('academicYearId') academicYearId?: string) {
    return this.classes.findAll(schoolId, academicYearId);
  }

  @Get('my-classes')
  myClasses(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.classes.findByTeacher(schoolId, user.sub);
  }

  @Get(':id')
  findOne(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.classes.findOne(id, schoolId);
  }

  @Post()
  @Roles('school_admin')
  create(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.classes.create(schoolId, body);
  }

  @Put(':id')
  @Roles('school_admin')
  update(@Param('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.classes.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.classes.remove(id, schoolId);
  }

  @Post(':id/teachers')
  @Roles('school_admin')
  assignTeacher(@Param('id') classId: string, @Body() body: { userId: string; isPrimary?: boolean }) {
    return this.classes.assignTeacher(classId, body.userId, body.isPrimary);
  }

  @Get('academic-years/list')
  getAcademicYears(@Param('schoolId') schoolId: string) {
    return this.classes.getAcademicYears(schoolId);
  }

  @Post('academic-years')
  @Roles('school_admin')
  createAcademicYear(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.classes.createAcademicYear(schoolId, body);
  }

  // ── Class Instructions ──────────────────────────────────────

  @Post(':id/instructions')
  @UseGuards(JwtAuthGuard)
  createInstruction(
    @Param('schoolId') schoolId: string,
    @Param('id') classId: string,
    @Body() body: { title: string; content: string; category?: string; sortOrder?: number },
  ) {
    return this.classes.createInstruction(classId, schoolId, body);
  }

  @Put(':id/instructions/:instructionId')
  @UseGuards(JwtAuthGuard)
  updateInstruction(
    @Param('schoolId') schoolId: string,
    @Param('id') classId: string,
    @Param('instructionId') instructionId: string,
    @Body() body: { title?: string; content?: string; category?: string; sortOrder?: number },
  ) {
    return this.classes.updateInstruction(instructionId, classId, schoolId, body);
  }

  @Delete(':id/instructions/:instructionId')
  @UseGuards(JwtAuthGuard)
  deleteInstruction(
    @Param('schoolId') schoolId: string,
    @Param('id') classId: string,
    @Param('instructionId') instructionId: string,
  ) {
    return this.classes.deleteInstruction(instructionId, classId, schoolId);
  }
}
