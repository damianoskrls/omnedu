import { Controller, Get, Post, Delete, Param, Body, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DailyMenusService } from './daily-menus.service';
import { Roles } from '../../common/decorators/roles.decorator';

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
    limits: { fileSize: 12 * 1024 * 1024 },
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

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
