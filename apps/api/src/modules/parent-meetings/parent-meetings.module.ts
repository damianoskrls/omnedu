import { Module } from '@nestjs/common';
import { ParentMeetingsService } from './parent-meetings.service';
import { ParentMeetingsController } from './parent-meetings.controller';

@Module({ controllers: [ParentMeetingsController], providers: [ParentMeetingsService] })
export class ParentMeetingsModule {}
