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

export type FeeRule = {
  fixedAmount?: number | null;
  discountPct?: number | null;
  effectiveFrom?: Date | string | null;
  reason?: string | null;
};

/** The price rule in force for a month. A later rule replaces earlier ones. A rule with no amount clears the discount. */
export function feeRuleForMonth(rules: FeeRule[] | null | undefined, month: number, year: number): FeeRule | null {
  if (!rules?.length) return null;
  const monthEnd = Date.UTC(year, month, 0);
  const applicable = rules
    .filter((rule) => !rule.effectiveFrom || utcDay(rule.effectiveFrom) <= monthEnd)
    .sort((a, b) => {
      const ad = a.effectiveFrom ? utcDay(a.effectiveFrom) : Number.NEGATIVE_INFINITY;
      const bd = b.effectiveFrom ? utcDay(b.effectiveFrom) : Number.NEGATIVE_INFINITY;
      return bd - ad;
    });
  const chosen = applicable[0];
  if (!chosen || (chosen.fixedAmount == null && chosen.discountPct == null)) return null;
  return chosen;
}

/** Edit the same subsidy row, or close it and start a new one from the requested month. */
export function subsidyRevision(existingStart: Date | string | null | undefined, requestedStart: Date | string) {
  if (!existingStart) return 'split' as const;
  const start = utcDay(existingStart);
  const requested = utcDay(requestedStart);
  return start >= requested ? 'update' as const : 'split' as const;
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
    ...[1, 2, 3, 4, 5, 6, 7].map((m) => ({ month: m, year: startYear + 1 })),
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
  feeRules?: FeeRule[] | null;
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
  const rule = input.feeRules ? feeRuleForMonth(input.feeRules, input.month, input.year) : null;
  const fixedAmount = input.feeRules
    ? (rule?.fixedAmount != null ? Number(rule.fixedAmount) : null)
    : input.fixedAmount;
  const discountPct = input.feeRules
    ? (fixedAmount == null && rule?.discountPct != null ? Number(rule.discountPct) : null)
    : input.discountPct;
  let schoolFee = levelMonthly;
  let schoolLabel = input.levelName ? `Φοίτηση · ${input.levelName}` : 'Φοίτηση';
  if (fixedAmount != null) {
    schoolFee = Number(fixedAmount);
    schoolLabel = `${schoolLabel} (ειδική τιμή)`;
  } else if (discountPct != null) {
    schoolFee = round2(levelMonthly * (1 - Number(discountPct) / 100));
    schoolLabel = `${schoolLabel} (−${Number(discountPct)}%)`;
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
