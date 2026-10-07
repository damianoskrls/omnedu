import { Module } from '@nestjs/common';
import { CelebrationsController } from './celebrations.controller';
import { CelebrationsService } from './celebrations.service';

@Module({ controllers: [CelebrationsController], providers: [CelebrationsService] })
export class CelebrationsModule {}
