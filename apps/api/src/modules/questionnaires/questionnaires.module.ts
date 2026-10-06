import { Module } from '@nestjs/common';
import { QuestionnairesController } from './questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [QuestionnairesController],
  providers: [QuestionnairesService],
})
export class QuestionnairesModule {}
