// Called by: attendance.controller.ts save(@Body() dto). No existing attendance DTO (glob attendance/** = 0).
// Schema: classId, date YYYY-MM-DD, records[{studentId, status: present|absent}].
// User: «θελω ο εκπαιδευτικός ... παρουσιολογιο ... οταν τσεκαρει τους μαθητες»
import { IsArray, IsIn, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AttendanceEntryDto {
  @ApiProperty()
  @IsString()
  studentId: string;

  @ApiProperty({ enum: ['present', 'absent'] })
  @IsIn(['present', 'absent'])
  status: 'present' | 'absent';
}

export class SaveAttendanceDto {
  @ApiProperty()
  @IsString()
  classId: string;

  @ApiProperty({ example: '2026-10-30' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty({ type: [AttendanceEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records: AttendanceEntryDto[];
}
