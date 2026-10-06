import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { QuestionnairesService } from './questionnaires.service';

@ApiTags('questionnaires')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools/:schoolId/questionnaires')
export class QuestionnairesController {
  constructor(private svc: QuestionnairesService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.svc.findAll(schoolId, academicYear ? Number(academicYear) : undefined);
  }

  @Get(':id')
  findOne(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.findOne(id, schoolId);
  }

  @Post()
  @Roles('school_admin')
  create(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.create(schoolId, body);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.svc.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.remove(id, schoolId);
  }
}
