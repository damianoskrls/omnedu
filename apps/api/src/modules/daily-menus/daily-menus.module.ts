import { Module } from '@nestjs/common';
import { DailyMenusService } from './daily-menus.service';
import { DailyMenusController } from './daily-menus.controller';

@Module({ controllers: [DailyMenusController], providers: [DailyMenusService] })
export class DailyMenusModule {}
