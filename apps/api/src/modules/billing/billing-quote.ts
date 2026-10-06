export type QuoteLine = { label: string; amount: number };

export type MonthQuote = {
  schoolFee: number;
  busFee: number;
  activityFees: number;
  subsidyTotal: number;
  totalDue: number;
  lines: QuoteLine[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function utcDay(value: Date | string) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** True when [startsOn, endsOn] overlaps the calendar month. Missing bounds are open. */
export function rangeCoversMonth(
  startsOn: Date | string | null | undefined,
  endsOn: Date | string | null | undefined,
  month: number,
  year: number,
) {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 0);
  if (startsOn && utcDay(startsOn) > monthEnd) return false;
  if (endsOn && utcDay(endsOn) < monthStart) return false;
  return true;
}

export function schoolYearBounds(now = new Date()) {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const months = [
    ...[9, 10, 11, 12].map((m) => ({ month: m, year: startYear })),
    ...[1, 2, 3, 4, 5, 6].map((m) => ({ month: m, year: startYear + 1 })),
  ];
  return { startYear, label: `${startYear}-${startYear + 1}`, months };
}

export function isOpenMonth(month: number, year: number, now = new Date()) {
  const cursor = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  return year * 12 + month <= cursor;
}

export function quoteStudentMonth(input: {
  month: number;
  year: number;
  levelName?: string | null;
  levelMonthly?: number | null;
  fixedAmount?: number | null;
  discountPct?: number | null;
  buses?: { name: string; net: number; enrolledAt?: Date | string | null; isActive?: boolean }[];
  activities?: {
    title: string;
    monthlyCost?: number | null;
    startsOn?: Date | string | null;
    endsOn?: Date | string | null;
  }[];
  subsidies?: {
    name: string;
    monthlyAmount: number;
    isActive?: boolean;
    startsFrom?: Date | string | null;
    endsAt?: Date | string | null;
  }[];
}): MonthQuote {
  const levelMonthly = Number(input.levelMonthly ?? 0);
  let schoolFee = levelMonthly;
  let schoolLabel = input.levelName ? `Φοίτηση · ${input.levelName}` : 'Φοίτηση';
  if (input.fixedAmount != null) {
    schoolFee = Number(input.fixedAmount);
    schoolLabel = `${schoolLabel} (ειδική τιμή)`;
  } else if (input.discountPct != null) {
    schoolFee = round2(levelMonthly * (1 - Number(input.discountPct) / 100));
    schoolLabel = `${schoolLabel} (−${Number(input.discountPct)}%)`;
  }

  const lines: QuoteLine[] = [];
  if (schoolFee > 0) lines.push({ label: schoolLabel, amount: schoolFee });

  let busFee = 0;
  for (const bus of input.buses ?? []) {
    if (bus.isActive === false) continue;
    const net = round2(Number(bus.net) || 0);
    if (net <= 0) continue;
    busFee += net;
    lines.push({ label: `Σχολικό · ${bus.name}`, amount: net });
  }
  busFee = round2(busFee);

  let activityFees = 0;
  for (const activity of input.activities ?? []) {
    const amount = round2(Number(activity.monthlyCost) || 0);
    if (amount <= 0) continue;
    if (!rangeCoversMonth(activity.startsOn, activity.endsOn, input.month, input.year)) continue;
    activityFees += amount;
    lines.push({ label: `Δραστηριότητα · ${activity.title}`, amount });
  }
  activityFees = round2(activityFees);

  let subsidyTotal = 0;
  for (const subsidy of input.subsidies ?? []) {
    if (subsidy.isActive === false) continue;
    if (!rangeCoversMonth(subsidy.startsFrom, subsidy.endsAt, input.month, input.year)) continue;
    const amount = round2(Number(subsidy.monthlyAmount) || 0);
    if (amount <= 0) continue;
    subsidyTotal += amount;
    lines.push({ label: subsidy.name || 'Voucher', amount: -amount });
  }
  subsidyTotal = round2(subsidyTotal);

  const totalDue = Math.max(0, round2(schoolFee + busFee + activityFees - subsidyTotal));
  return { schoolFee: round2(schoolFee), busFee, activityFees, subsidyTotal, totalDue, lines };
}
