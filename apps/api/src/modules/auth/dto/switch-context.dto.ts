import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SwitchContextDto {
  @ApiProperty()
  @IsString()
  schoolId: string;

  @ApiProperty({ enum: ['school_admin', 'teacher', 'parent'] })
  @IsIn(['school_admin', 'teacher', 'parent'])
  role: string;

  @ApiPropertyOptional({ description: 'Account that owns the role when the phone has more than one user' })
  @IsOptional()
  @IsString()
  userId?: string;
}
