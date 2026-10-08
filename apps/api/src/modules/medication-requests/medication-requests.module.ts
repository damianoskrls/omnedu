import { Module } from '@nestjs/common';
import { MedicationRequestsService } from './medication-requests.service';
import { MedicationRequestsController } from './medication-requests.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [MedicationRequestsController],
  providers: [MedicationRequestsService],
})
export class MedicationRequestsModule {}
