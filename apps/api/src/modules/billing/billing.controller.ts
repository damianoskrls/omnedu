import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, ParseIntPipe, Optional } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('billing')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  // ── Level fees ──────────────────────────────────────────

  @Get('level-fees')
  @Roles('school_admin')
  getLevelFees(@Param('schoolId') schoolId: string) {
    return this.billing.getLevelFees(schoolId);
  }

  @Put('level-fees/:levelId')
  @Roles('school_admin')
  upsertLevelFee(
    @Param('schoolId') schoolId: string,
    @Param('levelId') levelId: string,
    @Body() body: any,
  ) {
    return this.billing.upsertLevelFee(schoolId, levelId, body);
  }

  @Delete('level-fees/:feeId')
  @Roles('school_admin')
  deleteLevelFee(@Param('schoolId') schoolId: string, @Param('feeId') feeId: string) {
    return this.billing.deleteLevelFee(schoolId, feeId);
  }

  // ── Student fee overrides ────────────────────────────────

  @Get('students/:studentId/fee')
  @Roles('school_admin')
  getStudentFee(@Param('schoolId') schoolId: string, @Param('studentId') studentId: string) {
    return this.billing.getStudentFeeOverride(schoolId, studentId);
  }

  @Put('students/:studentId/fee')
  @Roles('school_admin')
  upsertStudentFee(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Body() body: any,
  ) {
    return this.billing.upsertStudentFeeOverride(schoolId, studentId, body);
  }

  @Delete('students/:studentId/fee')
  @Roles('school_admin')
  deleteStudentFee(@Param('schoolId') schoolId: string, @Param('studentId') studentId: string) {
    return this.billing.deleteStudentFeeOverride(schoolId, studentId);
  }

  // ── Subsidies ────────────────────────────────────────────

  @Get('students/:studentId/subsidies')
  @Roles('school_admin')
  getSubsidies(@Param('schoolId') schoolId: string, @Param('studentId') studentId: string) {
    return this.billing.getStudentSubsidies(schoolId, studentId);
  }

  @Post('students/:studentId/subsidies')
  @Roles('school_admin')
  createSubsidy(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Body() body: any,
  ) {
    return this.billing.createSubsidy(schoolId, studentId, body);
  }

  @Patch('students/:studentId/subsidies/:subsidyId')
  @Roles('school_admin')
  updateSubsidy(
    @Param('schoolId') schoolId: string,
    @Param('subsidyId') subsidyId: string,
    @Body() body: any,
  ) {
    return this.billing.updateSubsidy(schoolId, subsidyId, body);
  }

  @Delete('students/:studentId/subsidies/:subsidyId')
  @Roles('school_admin')
  deleteSubsidy(@Param('schoolId') schoolId: string, @Param('subsidyId') subsidyId: string) {
    return this.billing.deleteSubsidy(schoolId, subsidyId);
  }

  // ── Monthly charges ──────────────────────────────────────

  @Get('charges')
  @Roles('school_admin')
  getCharges(
    @Param('schoolId') schoolId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const now = new Date();
    return this.billing.getMonthlyCharges(
      schoolId,
      month ? parseInt(month) : now.getMonth() + 1,
      year ? parseInt(year) : now.getFullYear(),
    );
  }

  @Get('charges/student/:studentId')
  @Roles('school_admin')
  getStudentCharges(@Param('schoolId') schoolId: string, @Param('studentId') studentId: string) {
    return this.billing.getStudentCharges(schoolId, studentId);
  }

  @Post('students/:studentId/charges/generate')
  @Roles('school_admin')
  generateStudentCharge(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Body() body: { month: number; year: number },
  ) {
    return this.billing.generateStudentCharge(schoolId, studentId, body.month, body.year);
  }

  @Post('charges/generate')
  @Roles('school_admin')
  generateCharges(
    @Param('schoolId') schoolId: string,
    @Body() body: { month: number; year: number },
  ) {
    return this.billing.generateMonthlyCharges(schoolId, body.month, body.year);
  }

  @Delete('charges/:chargeId')
  @Roles('school_admin')
  deleteCharge(@Param('schoolId') schoolId: string, @Param('chargeId') chargeId: string) {
    return this.billing.deleteCharge(schoolId, chargeId);
  }

  @Patch('charges/:chargeId')
  @Roles('school_admin')
  updateCharge(
    @Param('schoolId') schoolId: string,
    @Param('chargeId') chargeId: string,
    @Body() body: any,
  ) {
    return this.billing.updateCharge(schoolId, chargeId, body);
  }

  // ── One-time charges ─────────────────────────────────────

  @Get('one-time')
  @Roles('school_admin')
  getOneTimeCharges(
    @Param('schoolId') schoolId: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    return this.billing.getOneTimeCharges(schoolId, { studentId, status });
  }

  @Post('one-time')
  @Roles('school_admin')
  createOneTimeCharge(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.billing.createOneTimeCharge(schoolId, body);
  }

  @Patch('one-time/:chargeId')
  @Roles('school_admin')
  updateOneTimeCharge(
    @Param('schoolId') schoolId: string,
    @Param('chargeId') chargeId: string,
    @Body() body: any,
  ) {
    return this.billing.updateOneTimeCharge(schoolId, chargeId, body);
  }

  @Delete('one-time/:chargeId')
  @Roles('school_admin')
  deleteOneTimeCharge(@Param('schoolId') schoolId: string, @Param('chargeId') chargeId: string) {
    return this.billing.deleteOneTimeCharge(schoolId, chargeId);
  }

  @Post('one-time/generate-annual')
  @Roles('school_admin')
  generateAnnualCharges(@Param('schoolId') schoolId: string, @Body() body: { year: number }) {
    return this.billing.generateAnnualCharges(schoolId, body.year);
  }

  // ── Stats & legacy ───────────────────────────────────────

  @Get('stats')
  @Roles('school_admin')
  stats(@Param('schoolId') schoolId: string) {
    return this.billing.getStats(schoolId);
  }

  @Get('charges/mine')
  myCharges(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.billing.getMyCharges(user.sub, schoolId);
  }

  @Get('invoices/mine')
  myInvoices(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.billing.getMyInvoices(user.sub, schoolId);
  }

  @Get('invoices')
  @Roles('school_admin')
  getInvoices(@Param('schoolId') schoolId: string) {
    return this.billing.getInvoices(schoolId);
  }

  @Post('invoices')
  @Roles('school_admin')
  createInvoice(@Param('schoolId') schoolId: string, @Body() body: any) {
    return this.billing.createInvoice(schoolId, body);
  }
}
