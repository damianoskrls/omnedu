import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CelebrationsController } from './celebrations.controller';
import { CelebrationsService } from './celebrations.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CelebrationsController],
  providers: [CelebrationsService],
})
export class CelebrationsModule {}
