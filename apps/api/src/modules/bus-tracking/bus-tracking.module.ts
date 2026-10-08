import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BusTrackingController } from './bus-tracking.controller';
import { BusTrackingService } from './bus-tracking.service';

@Module({
  imports: [PrismaModule],
  controllers: [BusTrackingController],
  providers: [BusTrackingService],
})
export class BusTrackingModule {}
