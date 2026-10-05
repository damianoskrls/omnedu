import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
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
  ) {
    return this.svc.findAll(schoolId, from, to);
  }

  @Get(':date')
  findByDate(@Param('schoolId') schoolId: string, @Param('date') date: string) {
    return this.svc.findByDate(schoolId, date);
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
