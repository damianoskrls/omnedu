import { Module } from '@nestjs/common';
import { MenuTemplatesController } from './menu-templates.controller';
import { MenuTemplatesService } from './menu-templates.service';

@Module({ controllers: [MenuTemplatesController], providers: [MenuTemplatesService] })
export class MenuTemplatesModule {}
