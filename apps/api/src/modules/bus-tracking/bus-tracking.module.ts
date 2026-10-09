import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusTrackingController } from './bus-tracking.controller';
import { BusTrackingService } from './bus-tracking.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BusTrackingController],
  providers: [BusTrackingService],
})
export class BusTrackingModule {}
