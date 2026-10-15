-- ============================================================
-- READ-ONLY reconciliation for docs/specs/finance-formulas.md
-- Run in Supabase SQL Editor AFTER migration 0013, BEFORE deploying code.
-- Nothing here writes data.
--
-- Part A: are balances on the old pages at risk of the 1,000-row cap?
-- Part B: old vs new Expenses / Profit for the last 3 full months
--         and the current month to date.
-- ============================================================

-- ---------- Part A: row counts & balances ----------
select
  (select count(*) from public.cash_movements)    as cash_rows,
  (select count(*) from public.bank_transactions) as bank_rows,
  (select sum(case when direction = 'in' then amount else -amount end)
     from public.cash_movements)                   as cash_balance_true,
  (select sum(total * case when direction = 'in' then 1 else -1 end)
     from public.cash_ledger_summary())            as cash_balance_new,
  (select sum(case when direction = 'in' then amount else -(amount + coalesce(fee, 0)) end)
     from public.bank_transactions)                as bank_balance_true,
  (select sum(case when direction = 'in' then total_amount else -(total_amount + total_fee) end)
     from public.bank_ledger_summary())            as bank_balance_new;
-- If cash_rows or bank_rows > 1000, the OLD page could show a wrong balance
-- (PostgREST default max_rows = 1000). *_true must equal *_new.

-- ---------- Part B: old vs new per month ----------
with months as (
  select m::date as m_start,
         least((m + interval '1 month - 1 day')::date, current_date) as m_end
  from generate_series(date_trunc('month', current_date) - interval '3 month',
                       date_trunc('month', current_date), interval '1 month') m
),
fx as (select coalesce(sum(amount), 0) as fixed_monthly from public.fixed_expenses where active),
agg as (
  select
    mo.m_start, mo.m_end,
    (mo.m_end - mo.m_start + 1)::numeric
      / extract(day from (mo.m_start + interval '1 month - 1 day'))::numeric as day_ratio,
    (select coalesce(sum(total_revenue), 0) from public.daily_sales
       where sale_date between mo.m_start and mo.m_end) as retail,
    (select coalesce(sum(amount), 0) from public.wholesale_sales
       where sale_date between mo.m_start and mo.m_end) as wholesale,
    (select coalesce(sum(amount), 0) from public.variable_expenses
       where expense_date between mo.m_start and mo.m_end) as variable,
    (select coalesce(sum(amount), 0) from public.salary_payments
       where period_month >= mo.m_start and period_month <= mo.m_end) as salary_month,
    (select coalesce(sum(amount), 0) from public.cash_movements
       where ref_table is null and direction = 'out'
         and category in ('purchase', 'cod', 'other')
         and move_date between mo.m_start and mo.m_end) as manual_cash,
    (select coalesce(sum(amount), 0) from public.bank_transactions
       where ref_table is null and direction = 'out'
         and category in ('purchase', 'expense', 'other')
         and tx_date between mo.m_start and mo.m_end) as manual_bank,
    (select coalesce(sum(fee), 0) from public.bank_transactions
       where tx_date between mo.m_start and mo.m_end) as bank_fees
  from months mo
)
select
  to_char(a.m_start, 'YYYY-MM')                                   as month,
  a.m_end                                                         as through,
  a.retail, a.wholesale, a.variable,
  round(a.salary_month * a.day_ratio)                             as salary_prorated,
  round(fx.fixed_monthly * a.day_ratio)                           as fixed_prorated,
  a.manual_cash, a.manual_bank, a.bank_fees,
  -- OLD Dashboard (range = that month): retail − (variable + salary)
  a.retail - (a.variable + a.salary_month)                        as old_dashboard_profit,
  -- OLD Monthly report: retail + wholesale − (fixed + variable + salary)
  a.retail + a.wholesale - (fx.fixed_monthly + a.variable + a.salary_month) as old_report_profit,
  -- NEW (both pages)
  (a.retail + a.wholesale)
    - ( a.variable
      + round(fx.fixed_monthly * a.day_ratio)
      + round(a.salary_month * a.day_ratio)
      + a.manual_cash + a.manual_bank + a.bank_fees )             as new_profit
from agg a cross join fx
order by a.m_start;
-- Notes:
--  * The new app pro-rates per calendar month; for a full month the ratio is 1.
--  * fixed uses TODAY's active fixed_expenses list for every month (no history yet).
--  * Differences OLD vs NEW come only from: fixed (dashboard), wholesale (dashboard),
--    manual cash/bank expenses, bank fees, and salary pro-rating in the current month.
