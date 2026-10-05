import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MenuTemplatesService } from './menu-templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller({ path: 'schools/:schoolId/menu-templates', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuTemplatesController {
  constructor(private readonly svc: MenuTemplatesService) {}

  @Get()
  @Roles('school_admin', 'teacher')
  findAll(@Param('schoolId') schoolId: string) {
    return this.svc.findAll(schoolId);
  }

  @Get(':id')
  @Roles('school_admin', 'teacher')
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
  update(@Param('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, schoolId, body);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.svc.remove(id, schoolId);
  }

  @Post(':id/apply')
  @Roles('school_admin')
  apply(@Param('schoolId') schoolId: string, @Param('id') id: string, @Body('month') month: string) {
    return this.svc.applyToMonth(id, schoolId, month);
  }
}
