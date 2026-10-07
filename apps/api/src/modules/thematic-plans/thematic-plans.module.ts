import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ThematicPlansController } from './thematic-plans.controller';
import { ThematicPlansService } from './thematic-plans.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ThematicPlansController],
  providers: [ThematicPlansService],
})
export class ThematicPlansModule {}
