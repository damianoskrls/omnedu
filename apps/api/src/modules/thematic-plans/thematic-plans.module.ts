import { Module } from '@nestjs/common';
import { ThematicPlansController } from './thematic-plans.controller';
import { ThematicPlansService } from './thematic-plans.service';

@Module({ controllers: [ThematicPlansController], providers: [ThematicPlansService] })
export class ThematicPlansModule {}
