import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
