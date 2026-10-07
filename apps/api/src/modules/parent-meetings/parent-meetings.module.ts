import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParentMeetingsController } from './parent-meetings.controller';
import { ParentMeetingsService } from './parent-meetings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ParentMeetingsController],
  providers: [ParentMeetingsService],
})
export class ParentMeetingsModule {}
