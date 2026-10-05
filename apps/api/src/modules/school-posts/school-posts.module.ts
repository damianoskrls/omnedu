import { Module } from '@nestjs/common';
import { SchoolPostsService } from './school-posts.service';
import { SchoolPostsController } from './school-posts.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolPostsController],
  providers: [SchoolPostsService],
  exports: [SchoolPostsService],
})
export class SchoolPostsModule {}
