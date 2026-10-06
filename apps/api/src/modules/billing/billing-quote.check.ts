const assert = require('node:assert/strict');
import { isOpenMonth, quoteStudentMonth, rangeCoversMonth, schoolYearBounds } from './billing-quote';

const base = {
  levelName: 'Νηπιαγωγείο',
  levelMonthly: 420,
  buses: [{ name: 'Πρωινό', net: 70, enrolledAt: '2026-09-01' }],
  activities: [{ title: 'Αγγλικά', monthlyCost: 25, startsOn: '2026-10-01', endsOn: '2027-06-30' }],
  subsidies: [] as { name: string; monthlyAmount: number; startsFrom?: string }[],
};

const october = quoteStudentMonth({ ...base, month: 10, year: 2026 });
assert.equal(october.totalDue, 515);
assert.deepEqual(october.lines.map((line) => line.amount), [420, 70, 25]);

const september = quoteStudentMonth({ ...base, month: 9, year: 2026 });
assert.equal(september.totalDue, 490);
assert.equal(september.activityFees, 0);

const withVoucher = quoteStudentMonth({
  ...base,
  month: 10,
  year: 2026,
  subsidies: [{ name: 'Voucher', monthlyAmount: 300, startsFrom: '2026-09-01' }],
});
assert.equal(withVoucher.totalDue, 215);
assert.equal(withVoucher.subsidyTotal, 300);

assert.equal(rangeCoversMonth('2026-10-01', null, 9, 2026), false);
assert.equal(rangeCoversMonth('2026-10-01', null, 10, 2026), true);

const now = new Date('2026-10-06T12:00:00Z');
const year = schoolYearBounds(now);
assert.equal(year.label, '2026-2027');
assert.deepEqual(
  year.months.filter((month) => isOpenMonth(month.month, month.year, now)).map((month) => month.month),
  [9, 10],
);

console.log('billing quote ok');
