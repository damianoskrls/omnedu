const assert = require('node:assert/strict');
import { buildStudentQuoteInput, isOpenMonth, quoteStudentMonth, schoolYearMonths } from './month-quote';

const now = new Date('2026-10-06T12:00:00Z');
const student = {
  enrollments: [{ classId: 'class-1', class: { id: 'class-1' } }],
  studentServices: [],
  activityRegistrations: [],
};
const classes = [{ id: 'class-1', level: { id: 'lvl-nip', name: 'Νηπιαγωγείο' } }];
const fees = [{ levelId: 'lvl-nip', academicYear: '2026-2027', monthlyFee: 420 }];

const tuition = buildStudentQuoteInput(student, classes, fees, [], null);
const octoberTuition = quoteStudentMonth({ ...tuition, month: 10, year: 2026 });
assert.equal(octoberTuition.totalDue, 420);
assert.equal(octoberTuition.schoolFee, 420);

const withVoucher = buildStudentQuoteInput(student, classes, fees, [
  { name: 'ΕΣΠΑ', monthlyAmount: 250, isActive: true, startsFrom: '2026-09-01' },
], null);
assert.equal(quoteStudentMonth({ ...withVoucher, month: 9, year: 2026 }).totalDue, 170);
assert.equal(quoteStudentMonth({ ...withVoucher, month: 10, year: 2026 }).totalDue, 170);

const withBus = buildStudentQuoteInput({
  ...student,
  studentServices: [{
    isActive: true,
    serviceMode: 'both',
    discountAmount: 0,
    service: { name: 'Πρωινό', serviceType: 'bus', monthlyCost: 70 },
  }],
}, classes, fees, [
  { name: 'ΕΣΠΑ', monthlyAmount: 250, isActive: true },
], null);
assert.equal(quoteStudentMonth({ ...withBus, month: 10, year: 2026 }).totalDue, 240);

const withActivity = buildStudentQuoteInput({
  ...student,
  studentServices: [{
    isActive: true,
    serviceMode: 'both',
    service: { name: 'Πρωινό', serviceType: 'bus', monthlyCost: 70 },
  }],
  activityRegistrations: [{
    status: 'approved',
    activity: { title: 'Αγγλικά', monthlyCost: 25, startsOn: '2026-10-01', endsOn: '2027-06-30' },
  }],
}, classes, fees, [
  { name: 'ΕΣΠΑ', monthlyAmount: 250, isActive: true, startsFrom: '2026-09-01' },
], null);
assert.equal(quoteStudentMonth({ ...withActivity, month: 9, year: 2026 }).totalDue, 240);
assert.equal(quoteStudentMonth({ ...withActivity, month: 10, year: 2026 }).totalDue, 265);
assert.equal(quoteStudentMonth({ ...withActivity, month: 11, year: 2026 }).totalDue, 265);

const open = schoolYearMonths(now).filter((slot) => isOpenMonth(slot.month, slot.year, now));
assert.deepEqual(open.map((slot) => slot.month), [9, 10]);

console.log('month quote ok');
