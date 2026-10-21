import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentsModule } from '../students/students.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [NotificationsModule, StudentsModule, StorageModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
