import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ElorusFuseService, IssueFiscalDocumentDto } from './elorus-fuse.service';

@ApiTags('elorus-fuse')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId')
export class ElorusFuseController {
  constructor(private readonly fuse: ElorusFuseService) {}

  @Get('fiscal-settings')
  @Roles('school_admin', 'super_admin')
  getFiscalSettings(@Param('schoolId') schoolId: string) {
    return this.fuse.getFiscalSettings(schoolId);
  }

  @Patch('fiscal-settings')
  @Roles('school_admin', 'super_admin')
  updateFiscalSettings(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.fuse.updateFiscalSettings(schoolId, body);
  }

  @Get('fiscal-documents')
  @Roles('school_admin', 'super_admin')
  listDocuments(
    @Param('schoolId') schoolId: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.fuse.listDocuments(schoolId, studentId);
  }

  @Get('fiscal-documents/:id')
  @Roles('school_admin', 'super_admin')
  getDocument(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.fuse.getDocument(schoolId, id);
  }

  @Post('fiscal-documents')
  @Roles('school_admin', 'super_admin')
  issue(@Param('schoolId') schoolId: string, @Body() body: IssueFiscalDocumentDto) {
    return this.fuse.issue(schoolId, body);
  }

  @Post('fiscal-documents/:id/refresh')
  @Roles('school_admin', 'super_admin')
  refresh(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.fuse.refresh(schoolId, id);
  }
}
