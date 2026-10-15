/**
 * Single source of truth for balances, expenses and profit.
 * Spec: docs/specs/finance-formulas.md
 *
 * Pure functions only (no DB, no "@/" imports) so they can be tested in
 * isolation. Data comes from the SQL functions in migration 0013.
 */
import { addMonths, differenceInCalendarDays, endOfMonth, format, getDaysInMonth, max, min, parseISO, startOfMonth } from "date-fns";

// ---------------------------------------------------------------------------
// Classification of MANUAL ledger outflows (spec 3.4, decisions Q5)
// ---------------------------------------------------------------------------

/** Manual cash OUT categories counted as an expense. */
export const CASH_EXPENSE_CATEGORIES = ["purchase", "cod", "other"] as const;
// Not expenses: staff_take (Q5), deposit_to_bank (internal transfer), adjust (till correction).

/** Manual bank OUT categories counted as an expense. */
export const BANK_EXPENSE_CATEGORIES = ["purchase", "expense", "other"] as const;
// Not expense: manual "salary" — salary is counted once, from salary_payments.

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export interface BreakdownLine<K extends string = string> {
  key: K;
  /** Signed: + increases the balance / total, − decreases it. */
  amount: number;
}

export interface CashSummaryRow {
  store_id: string | null;
  direction: string; // "in" | "out"
  category: string;
  source: string; // see cash_ledger_summary()
  total: number | string;
}

export type CashLineKey =
  | "salesCash"
  | "manualIn"
  | "wholesale"
  | "manualOut"
  | "deposit"
  | "expense"
  | "salary"
  | "other";

export const GENERAL_POOL = "__general__";

export function cashBalance(rows: CashSummaryRow[]) {
  const byStore: Record<string, number> = {};
  const acc: Record<CashLineKey, number> = {
    salesCash: 0, manualIn: 0, wholesale: 0, manualOut: 0, deposit: 0, expense: 0, salary: 0, other: 0,
  };

  for (const r of rows) {
    const amt = Number(r.total) || 0;
    const signed = r.direction === "in" ? amt : -amt;
    const storeKey = r.store_id ?? GENERAL_POOL;
    byStore[storeKey] = (byStore[storeKey] ?? 0) + signed;

    if (r.source === "daily_sales" || r.source === "sales_cash_expense") {
      // gross cash IN − cash spent on goods = counted register cash
      acc.salesCash += signed;
    } else if (r.source === "manual") {
      if (r.direction === "in") acc.manualIn += signed;
      else if (r.category === "deposit_to_bank") acc.deposit += signed;
      else acc.manualOut += signed;
    } else if (r.source === "wholesale_sales") {
      acc.wholesale += signed;
    } else if (r.source === "variable_expenses") {
      acc.expense += signed;
    } else if (r.source === "salary_payments") {
      acc.salary += signed;
    } else {
      acc.other += signed;
    }
  }

  const total = Object.values(byStore).reduce((s, v) => s + v, 0);
  const lines: BreakdownLine<CashLineKey>[] = (
    ["salesCash", "manualIn", "wholesale", "manualOut", "deposit", "expense", "salary", "other"] as const
  )
    .map((key) => ({ key, amount: acc[key] }))
    .filter((l) => l.key !== "other" || l.amount !== 0);

  return { total, byStore, general: byStore[GENERAL_POOL] ?? 0, lines };
}

export interface BankSummaryRow {
  direction: string;
  category: string;
  source: string; // 'manual' | ref_table
  total_amount: number | string;
  total_fee: number | string;
}

export type BankLineKey =
  | "salesTransfer"
  | "cashDeposit"
  | "wholesale"
  | "manualIn"
  | "manualOut"
  | "expense"
  | "salary"
  | "other";

export function bankBalance(rows: BankSummaryRow[]) {
  const acc: Record<BankLineKey, number> = {
    salesTransfer: 0, cashDeposit: 0, wholesale: 0, manualIn: 0, manualOut: 0, expense: 0, salary: 0, other: 0,
  };

  for (const r of rows) {
    const amount = Number(r.total_amount) || 0;
    const fee = Number(r.total_fee) || 0;
    // Same rule as before: IN rows already store the NET amount; OUT rows pay amount + fee.
    const signed = r.direction === "in" ? amount : -(amount + fee);

    if (r.source === "daily_sales") acc.salesTransfer += signed;
    else if (r.source === "cash_movements") acc.cashDeposit += signed;
    else if (r.source === "wholesale_sales") acc.wholesale += signed;
    else if (r.source === "manual") {
      if (r.direction === "in") acc.manualIn += signed;
      else acc.manualOut += signed;
    } else if (r.source === "variable_expenses") acc.expense += signed;
    else if (r.source === "salary_payments") acc.salary += signed;
    else acc.other += signed;
  }

  const lines: BreakdownLine<BankLineKey>[] = (
    ["salesTransfer", "cashDeposit", "wholesale", "manualIn", "manualOut", "expense", "salary", "other"] as const
  )
    .map((key) => ({ key, amount: acc[key] }))
    .filter((l) => l.key !== "other" || l.amount !== 0);

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { total, lines };
}

// ---------------------------------------------------------------------------
// Pro-rating monthly amounts over an arbitrary date range (spec 3.5, Q10)
// ---------------------------------------------------------------------------

/**
 * Sum over every calendar month touched by [from, to] (inclusive, yyyy-MM-dd):
 *   amountFor(month) × overlapDays / daysInMonth, rounded per month.
 * A whole month returns exactly amountFor(month).
 */
export function prorateMonthly(
  from: string,
  to: string,
  amountFor: (monthKey: string) => number,
): number {
  const start = parseISO(from);
  const end = parseISO(to);
  if (end < start) return 0;

  let total = 0;
  for (let m = startOfMonth(start); m <= end; m = addMonths(m, 1)) {
    const overlapStart = max([m, start]);
    const overlapEnd = min([endOfMonth(m), end]);
    const days = differenceInCalendarDays(overlapEnd, overlapStart) + 1;
    if (days <= 0) continue;
    const monthAmount = amountFor(format(m, "yyyy-MM"));
    total += Math.round((monthAmount * days) / getDaysInMonth(m));
  }
  return total;
}

// ---------------------------------------------------------------------------
// Period expenses & profit (spec 3.3, 3.6)
// ---------------------------------------------------------------------------

export interface PeriodTotals {
  retail_revenue: number;
  customers: number;
  cash: number;
  qr_card: number;
  bank_transfer: number;
  wholesale_revenue: number;
  variable_expenses: number;
  manual_cash_out: Record<string, number>;
  manual_bank_out: Record<string, number>;
  bank_fees: number;
}

export interface SalaryMonth {
  period_month: string; // yyyy-MM-dd (first of month)
  total: number | string;
}

export type ExpenseLineKey = "variable" | "fixed" | "salary" | "manualCash" | "manualBank" | "bankFees";

const sumCategories = (bucket: Record<string, number> | null | undefined, cats: readonly string[]) =>
  cats.reduce((s, c) => s + (Number(bucket?.[c]) || 0), 0);

export function periodExpenses(
  totals: PeriodTotals,
  opts: { from: string; to: string; fixedMonthlyTotal: number; salaryByMonth: SalaryMonth[] },
) {
  const salaryMap = new Map<string, number>();
  for (const s of opts.salaryByMonth) {
    const key = String(s.period_month).slice(0, 7);
    salaryMap.set(key, (salaryMap.get(key) ?? 0) + (Number(s.total) || 0));
  }

  const values: Record<ExpenseLineKey, number> = {
    variable: Number(totals.variable_expenses) || 0,
    fixed: prorateMonthly(opts.from, opts.to, () => opts.fixedMonthlyTotal),
    salary: prorateMonthly(opts.from, opts.to, (m) => salaryMap.get(m) ?? 0),
    manualCash: sumCategories(totals.manual_cash_out, CASH_EXPENSE_CATEGORIES),
    manualBank: sumCategories(totals.manual_bank_out, BANK_EXPENSE_CATEGORIES),
    bankFees: Number(totals.bank_fees) || 0,
  };

  const lines: BreakdownLine<ExpenseLineKey>[] = (
    ["variable", "fixed", "salary", "manualCash", "manualBank", "bankFees"] as const
  ).map((key) => ({ key, amount: values[key] }));

  return { total: lines.reduce((s, l) => s + l.amount, 0), lines };
}

export function periodProfit(
  totals: PeriodTotals,
  opts: { from: string; to: string; fixedMonthlyTotal: number; salaryByMonth: SalaryMonth[] },
) {
  const retail = Number(totals.retail_revenue) || 0;
  const wholesale = Number(totals.wholesale_revenue) || 0;
  const revenue = retail + wholesale;
  const expenses = periodExpenses(totals, opts);
  return { revenue, retail, wholesale, expenses, profit: revenue - expenses.total };
}

export const EMPTY_TOTALS: PeriodTotals = {
  retail_revenue: 0, customers: 0, cash: 0, qr_card: 0, bank_transfer: 0,
  wholesale_revenue: 0, variable_expenses: 0, manual_cash_out: {}, manual_bank_out: {}, bank_fees: 0,
};
