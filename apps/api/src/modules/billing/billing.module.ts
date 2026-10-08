import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [NotificationsModule, StudentsModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
