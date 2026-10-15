import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bankBalance,
  cashBalance,
  EMPTY_TOTALS,
  periodProfit,
  type BankSummaryRow,
  type CashSummaryRow,
  type PeriodTotals,
  type SalaryMonth,
} from "@/lib/finance";

/** All-time cash balance (respects RLS: staff only sees their own store). */
export async function getCashBalance(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("cash_ledger_summary");
  if (error) throw new Error(`cash_ledger_summary: ${error.message}`);
  return cashBalance((data ?? []) as CashSummaryRow[]);
}

/** All-time bank balance. */
export async function getBankBalance(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bank_ledger_summary");
  if (error) throw new Error(`bank_ledger_summary: ${error.message}`);
  return bankBalance((data ?? []) as BankSummaryRow[]);
}

/**
 * Revenue, expenses and profit for [from, to] (inclusive, yyyy-MM-dd).
 * Same function for Dashboard, Expenses and Reports so the numbers always agree.
 */
export async function getPeriodFinance(supabase: SupabaseClient, from: string, to: string) {
  const [totalsRes, salaryRes, fixedRes] = await Promise.all([
    supabase.rpc("finance_period_totals", { p_from: from, p_to: to }),
    supabase.rpc("salary_totals_by_month", { p_from: from, p_to: to }),
    supabase.from("fixed_expenses").select("amount").eq("active", true),
  ]);
  if (totalsRes.error) throw new Error(`finance_period_totals: ${totalsRes.error.message}`);
  if (salaryRes.error) throw new Error(`salary_totals_by_month: ${salaryRes.error.message}`);

  const totals: PeriodTotals = { ...EMPTY_TOTALS, ...((totalsRes.data ?? {}) as Partial<PeriodTotals>) };
  const fixedMonthlyTotal = (fixedRes.data ?? []).reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const result = periodProfit(totals, {
    from,
    to,
    fixedMonthlyTotal,
    salaryByMonth: (salaryRes.data ?? []) as SalaryMonth[],
  });
  return { ...result, totals, fixedMonthlyTotal };
}
