// Called by: apps/api/src/app.module.ts imports (AttendanceModule). No prior module (glob attendance/** = 0).
// User: «θελω ο εκπαιδευτικός οταν μπαινει στην εφαρμογη του να εχει και παρουσιολογιο»
import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
