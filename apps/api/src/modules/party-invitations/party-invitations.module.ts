import { Module } from '@nestjs/common';
import { PartyInvitationsController } from './party-invitations.controller';
import { PartyInvitationsService } from './party-invitations.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PartyInvitationsController],
  providers: [PartyInvitationsService],
})
export class PartyInvitationsModule {}
