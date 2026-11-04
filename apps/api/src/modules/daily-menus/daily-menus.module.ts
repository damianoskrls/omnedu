import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DailyMenusService } from './daily-menus.service';
import { DailyMenusController } from './daily-menus.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [DailyMenusController],
  providers: [DailyMenusService],
})
export class DailyMenusModule {}
