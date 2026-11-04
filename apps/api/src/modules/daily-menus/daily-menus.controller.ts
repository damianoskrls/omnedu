import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DailyMenusService } from './daily-menus.service';
import { Roles } from '../../common/decorators/roles.decorator';
// Extends existing controller. Routes GET/PUT month-notes before :date.
// User: «στο διατροφολογιο θελω να εμφανιζετε ... σημειωσεις ... edit τις σημειωσεις»

@Controller({ path: 'schools/:schoolId/daily-menus', version: '1' })
export class DailyMenusController {
  constructor(private svc: DailyMenusService) {}

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('audienceType') audienceType?: string,
    @Query('audienceIds') audienceIds?: string,
  ) {
    return this.svc.findAll(schoolId, from, to, audienceType, audienceIds);
  }

  @Post('import')
  @Roles('school_admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  importFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('month') month?: string,
  ) {
    return this.svc.importFile(file, month);
  }

  @Post('bulk')
  @Roles('school_admin')
  bulk(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.bulkUpsert(schoolId, body);
  }

  @Post('copy-month')
  @Roles('school_admin')
  copyMonth(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.copyMonth(schoolId, body);
  }

  @Post('emergency-change')
  @Roles('school_admin', 'owner')
  emergencyChange(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.emergencyChange(schoolId, body);
  }

  @Get('month-notes')
  getMonthNotes(
    @Param('schoolId') schoolId: string,
    @Query('month') month: string,
  ) {
    return this.svc.getMonthNotes(schoolId, month);
  }

  @Put('month-notes')
  @Roles('school_admin', 'owner')
  saveMonthNotes(
    @Param('schoolId') schoolId: string,
    @Body() body: { month?: string; notes?: string },
  ) {
    return this.svc.saveMonthNotes(schoolId, String(body.month || ''), String(body.notes ?? ''));
  }

  @Get(':date')
  findByDate(
    @Param('schoolId') schoolId: string,
    @Param('date') date: string,
    @Query('audienceType') audienceType?: string,
    @Query('audienceIds') audienceIds?: string,
  ) {
    return this.svc.findByDate(schoolId, date, audienceType, audienceIds);
  }

  @Post()
  @Roles('school_admin')
  upsert(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.svc.upsert(schoolId, body);
  }

  @Delete('month')
  @Roles('school_admin')
  clearMonth(
    @Param('schoolId') schoolId: string,
    @Query('month') month: string,
    @Query('audienceType') audienceType?: string,
    @Query('audienceIds') audienceIds?: string,
  ) {
    return this.svc.clearMonth(schoolId, month, audienceType, audienceIds);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
