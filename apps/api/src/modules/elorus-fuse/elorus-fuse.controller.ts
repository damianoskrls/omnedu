import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  ElorusFuseService,
  IssueCreditNoteDto,
  IssueFiscalDocumentDto,
} from './elorus-fuse.service';

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

  /** Parent: issued fiscal docs for their children (open/download via verification URL). */
  @Get('fiscal-documents/mine')
  @Roles('parent', 'school_admin', 'super_admin')
  listMine(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fuse.listDocumentsForParent(schoolId, user.sub);
  }

  @Get('fiscal-documents/mine/:id')
  @Roles('parent', 'school_admin', 'super_admin')
  getMine(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fuse.getDocumentForParent(schoolId, user.sub, id);
  }

  @Post('fiscal-documents/mine/:id/refresh')
  @Roles('parent', 'school_admin', 'super_admin')
  refreshMine(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fuse.refreshForParent(schoolId, user.sub, id);
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

  @Post('fiscal-documents/:id/credit')
  @Roles('school_admin', 'super_admin')
  issueCredit(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: IssueCreditNoteDto,
  ) {
    return this.fuse.issueCredit(schoolId, id, body || {});
  }

  @Post('fiscal-documents/:id/refresh')
  @Roles('school_admin', 'super_admin')
  refresh(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.fuse.refresh(schoolId, id);
  }

  @Post('fiscal-documents/:id/resend')
  @Roles('school_admin', 'super_admin')
  resend(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.fuse.resendToParents(schoolId, id);
  }
}
