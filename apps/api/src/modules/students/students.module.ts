import { Module } from '@nestjs/common';
import { ParentsController } from './parents.controller';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  controllers: [StudentsController, ParentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
