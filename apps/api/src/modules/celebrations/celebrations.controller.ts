import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CelebrationsService } from './celebrations.service';

@ApiTags('celebrations')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/celebrations')
export class CelebrationsController {
  constructor(private svc: CelebrationsService) {}

  @Get()
  findAll(@Param('schoolId') schoolId: string, @Query('academicYear') academicYear?: string) {
    return this.svc.findAll(schoolId, academicYear);
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
}
