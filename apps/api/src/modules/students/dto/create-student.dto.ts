import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParentInputDto {
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  relation?: string;

  @IsOptional()
  isPrimary?: boolean;
}

export class CreateStudentDto {
  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Existing parent user IDs to link' })
  @IsOptional()
  parentIds?: { userId: string; relation?: string; isPrimary?: boolean }[];

  @ApiPropertyOptional({ description: 'New parents to create inline' })
  @IsOptional()
  parents?: ParentInputDto[];

  @ApiPropertyOptional({ description: 'Class ID to enroll in' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicYearId?: string;
}
