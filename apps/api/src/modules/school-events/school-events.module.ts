import { Module } from '@nestjs/common';
import { SchoolEventsService } from './school-events.service';
import { SchoolEventsController } from './school-events.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolEventsController],
  providers: [SchoolEventsService],
  exports: [SchoolEventsService],
})
export class SchoolEventsModule {}
