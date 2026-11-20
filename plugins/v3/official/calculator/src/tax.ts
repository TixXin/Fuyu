export interface Bracket {
  upTo: number;
  rate: number;
  quick: number;
}

export const ANNUAL_BRACKETS: Bracket[] = [
  { upTo: 36_000, rate: 0.03, quick: 0 },
  { upTo: 144_000, rate: 0.1, quick: 2_520 },
  { upTo: 300_000, rate: 0.2, quick: 16_920 },
  { upTo: 420_000, rate: 0.25, quick: 31_920 },
  { upTo: 660_000, rate: 0.3, quick: 52_920 },
  { upTo: 960_000, rate: 0.35, quick: 85_920 },
  { upTo: Infinity, rate: 0.45, quick: 181_920 },
];

export const MONTHLY_BRACKETS: Bracket[] = [
  { upTo: 3_000, rate: 0.03, quick: 0 },
  { upTo: 12_000, rate: 0.1, quick: 210 },
  { upTo: 25_000, rate: 0.2, quick: 1_410 },
  { upTo: 35_000, rate: 0.25, quick: 2_660 },
  { upTo: 55_000, rate: 0.3, quick: 4_410 },
  { upTo: 80_000, rate: 0.35, quick: 7_160 },
  { upTo: Infinity, rate: 0.45, quick: 15_160 },
];

export const BASIC_DEDUCTION = 5_000;
export const DEFAULT_INSURANCE_RATE = 0.225;

const round2 = (value: number) => Math.round(value * 100) / 100;

export function bracketOf(taxable: number, table: Bracket[]): Bracket {
  return table.find((bracket) => taxable <= bracket.upTo) ?? table[table.length - 1];
}

export function taxOn(taxable: number, table: Bracket[]): number {
  if (taxable <= 0) return 0;
  const bracket = bracketOf(taxable, table);
  return round2(taxable * bracket.rate - bracket.quick);
}

export interface SalaryInput {
  salary: number;
  insurance: number;
  special: number;
  bonus: number;
}

export interface MonthRow {
  month: number;
  tax: number;
  net: number;
  rate: number;
}

export interface SalaryResult {
  months: MonthRow[];
  salaryTax: number;
  bonusSeparateTax: number;
  bonusMergedTax: number;
  bonusBest: "separate" | "merged";
  totalTax: number;
  annualNet: number;
  averageNet: number;
}

export function bonusTax(bonus: number): number {
  if (bonus <= 0) return 0;
  const bracket = bracketOf(bonus / 12, MONTHLY_BRACKETS);
  return round2(bonus * bracket.rate - bracket.quick);
}

export function estimateInsurance(salary: number, ratePercent = DEFAULT_INSURANCE_RATE * 100): number {
  return round2((Math.max(0, salary) * ratePercent) / 100);
}

export function monthlyTaxable(input: SalaryInput): number {
  return input.salary - input.insurance - BASIC_DEDUCTION - input.special;
}

export function salaryTax(input: SalaryInput): SalaryResult {
  const perMonth = monthlyTaxable(input);
  const months: MonthRow[] = [];
  let paid = 0;
  for (let month = 1; month <= 12; month += 1) {
    const cumulative = Math.max(0, perMonth * month);
    const due = taxOn(cumulative, ANNUAL_BRACKETS);
    const tax = round2(Math.max(0, due - paid));
    paid = round2(paid + tax);
    months.push({ month, tax, net: round2(input.salary - input.insurance - tax), rate: cumulative > 0 ? bracketOf(cumulative, ANNUAL_BRACKETS).rate : 0 });
  }
  const bonus = Math.max(0, input.bonus);
  const bonusSeparateTax = bonusTax(bonus);
  const mergedTotal = taxOn(Math.max(0, perMonth * 12 + bonus), ANNUAL_BRACKETS);
  const bonusMergedTax = round2(Math.max(0, mergedTotal - paid));
  const bonusBest = bonusSeparateTax <= bonusMergedTax ? "separate" : "merged";
  const totalTax = round2(paid + Math.min(bonusSeparateTax, bonusMergedTax));
  const annualNet = round2((input.salary - input.insurance) * 12 + bonus - totalTax);
  return { months, salaryTax: paid, bonusSeparateTax, bonusMergedTax, bonusBest, totalTax, annualNet, averageNet: round2(annualNet / 12) };
}
