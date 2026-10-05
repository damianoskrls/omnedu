import { Module } from '@nestjs/common';
import { MedicationRequestsService } from './medication-requests.service';
import { MedicationRequestsController } from './medication-requests.controller';

@Module({ controllers: [MedicationRequestsController], providers: [MedicationRequestsService] })
export class MedicationRequestsModule {}
