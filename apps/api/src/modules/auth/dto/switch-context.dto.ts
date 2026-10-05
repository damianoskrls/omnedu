import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchContextDto {
  @ApiProperty()
  @IsString()
  schoolId: string;

  @ApiProperty({ enum: ['school_admin', 'teacher', 'parent'] })
  @IsIn(['school_admin', 'teacher', 'parent'])
  role: string;
}
