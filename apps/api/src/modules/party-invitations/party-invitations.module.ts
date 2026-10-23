import { Module } from '@nestjs/common';
import { PartyInvitationsController } from './party-invitations.controller';
import { PartyInvitationsService } from './party-invitations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [PartyInvitationsController],
  providers: [PartyInvitationsService],
})
export class PartyInvitationsModule {}
