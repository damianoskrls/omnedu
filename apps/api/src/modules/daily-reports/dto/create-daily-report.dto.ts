import { IsString, IsOptional, IsInt, IsDateString, IsIn, Min, Max, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MEAL_OPTIONS = ['all', 'most', 'half', 'little', 'none'];
const MOOD_OPTIONS = [
  'great', 'good', 'okay', 'tired', 'upset',
  'χαρούμενος', 'ήρεμος', 'κουρασμένος', 'λυπημένος', 'αγχωμένος', 'ενθουσιασμένος',
];

export class CreateDailyReportDto {
  @ApiProperty()
  @IsString()
  studentId: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  reportDate: string;

  @ApiPropertyOptional({ enum: MEAL_OPTIONS })
  @IsOptional()
  @IsIn(MEAL_OPTIONS)
  mealBreakfast?: string;

  @ApiPropertyOptional({ enum: MEAL_OPTIONS })
  @IsOptional()
  @IsIn(MEAL_OPTIONS)
  mealLunch?: string;

  @ApiPropertyOptional({ enum: MEAL_OPTIONS })
  @IsOptional()
  @IsIn(MEAL_OPTIONS)
  mealSnack?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  napDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  bathroomCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  diaperChanges?: number;

  @ApiPropertyOptional({ enum: MOOD_OPTIONS })
  @IsOptional()
  @IsIn(MOOD_OPTIONS)
  mood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  nap2DurationMinutes?: number;
}
