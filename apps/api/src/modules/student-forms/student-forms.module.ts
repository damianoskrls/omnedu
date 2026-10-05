import { Module } from '@nestjs/common';
import { StudentFormsService } from './student-forms.service';
import { StudentFormsController } from './student-forms.controller';

@Module({ controllers: [StudentFormsController], providers: [StudentFormsService] })
export class StudentFormsModule {}
