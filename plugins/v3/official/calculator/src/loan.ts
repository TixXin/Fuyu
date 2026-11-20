export type RepayMethod = "annuity" | "principal";

export interface LoanPart {
  amount: number;
  rate: number;
}

export interface LoanResult {
  firstPayment: number;
  lastPayment: number;
  monthlyDrop: number;
  totalInterest: number;
  totalPayment: number;
}

export function annuity(amount: number, annualRate: number, months: number): LoanResult {
  if (amount <= 0 || months <= 0) return empty();
  const r = annualRate / 100 / 12;
  const payment = r === 0 ? amount / months : (amount * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  const totalPayment = payment * months;
  return { firstPayment: payment, lastPayment: payment, monthlyDrop: 0, totalInterest: totalPayment - amount, totalPayment };
}

export function equalPrincipal(amount: number, annualRate: number, months: number): LoanResult {
  if (amount <= 0 || months <= 0) return empty();
  const r = annualRate / 100 / 12;
  const principal = amount / months;
  const totalInterest = (amount * r * (months + 1)) / 2;
  return {
    firstPayment: principal + amount * r,
    lastPayment: principal + principal * r,
    monthlyDrop: principal * r,
    totalInterest,
    totalPayment: amount + totalInterest,
  };
}

function empty(): LoanResult {
  return { firstPayment: 0, lastPayment: 0, monthlyDrop: 0, totalInterest: 0, totalPayment: 0 };
}

function add(a: LoanResult, b: LoanResult): LoanResult {
  return {
    firstPayment: a.firstPayment + b.firstPayment,
    lastPayment: a.lastPayment + b.lastPayment,
    monthlyDrop: a.monthlyDrop + b.monthlyDrop,
    totalInterest: a.totalInterest + b.totalInterest,
    totalPayment: a.totalPayment + b.totalPayment,
  };
}

export function combinedLoan(parts: LoanPart[], years: number, method: RepayMethod): LoanResult {
  const months = Math.round(years * 12);
  const compute = method === "annuity" ? annuity : equalPrincipal;
  return parts.filter((part) => part.amount > 0).reduce((sum, part) => add(sum, compute(part.amount, part.rate, months)), empty());
}

export const DEFAULT_COMMERCIAL_RATE = 3.1;
export const DEFAULT_FUND_RATE = 2.6;
