import { Module } from '@nestjs/common';
import { ElorusFuseClient } from './elorus-fuse.client';
import { ElorusFuseController } from './elorus-fuse.controller';
import { ElorusFuseService } from './elorus-fuse.service';

@Module({
  controllers: [ElorusFuseController],
  providers: [ElorusFuseClient, ElorusFuseService],
  exports: [ElorusFuseService],
})
export class ElorusFuseModule {}
