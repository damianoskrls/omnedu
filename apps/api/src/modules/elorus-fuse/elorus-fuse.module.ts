import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ElorusFuseClient } from './elorus-fuse.client';
import { ElorusFuseController } from './elorus-fuse.controller';
import { ElorusFuseService } from './elorus-fuse.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ElorusFuseController],
  providers: [ElorusFuseClient, ElorusFuseService],
  exports: [ElorusFuseService],
})
export class ElorusFuseModule {}
