-- ============================================================
-- 0013: Read-only aggregate functions for balances, period
--       totals and salary totals (spec: docs/specs/finance-formulas.md)
--
-- Requires 0012 (can_read_all).
--
-- Why:
--   * Pages used to download every ledger row and sum in JS. PostgREST
--     caps responses (default max_rows = 1000), so balances could be
--     silently truncated. Summing in SQL returns a handful of rows.
--   * Manager must see TOTAL salary (not per person) for Chi phí /
--     Lợi nhuận, but has no SELECT on salary_payments.
--
-- Safety:
--   * Only CREATE FUNCTION. No table, data or trigger is modified.
--   * cash/bank/period functions are SECURITY INVOKER → RLS still
--     applies (staff only sees their own store's rows).
--   * salary_totals_by_month is SECURITY DEFINER but returns rows only
--     when can_read_all() (admin / manager / accountant), and only
--     monthly totals — never individual payments.
--
-- Rollback:
--   drop function if exists public.cash_ledger_summary();
--   drop function if exists public.bank_ledger_summary();
--   drop function if exists public.finance_period_totals(date, date);
--   drop function if exists public.salary_totals_by_month(date, date);
-- ============================================================

-- 1. Cash ledger, all time, grouped -------------------------------------
--    source: 'manual' | 'daily_sales' | 'wholesale_sales' | 'salary_payments'
--            | 'variable_expenses' | 'sales_cash_expense'
--    'sales_cash_expense' = cash OUT created from "Tiền mặt TT hàng hoá"
--    on a daily_sales row (via its linked variable_expenses row).
create or replace function public.cash_ledger_summary()
returns table (
  store_id  uuid,
  direction text,
  category  text,
  source    text,
  total     bigint
)
language sql stable security invoker set search_path = public as $$
  select
    cm.store_id,
    cm.direction::text,
    cm.category::text,
    case
      when cm.ref_table is null then 'manual'
      when cm.ref_table = 'variable_expenses' and ve.ref_table = 'daily_sales' then 'sales_cash_expense'
      else cm.ref_table
    end as source,
    sum(cm.amount)::bigint as total
  from public.cash_movements cm
  left join public.variable_expenses ve
    on cm.ref_table = 'variable_expenses' and ve.id = cm.ref_id
  group by 1, 2, 3, 4
$$;

-- 2. Bank ledger, all time, grouped -------------------------------------
create or replace function public.bank_ledger_summary()
returns table (
  direction    text,
  category     text,
  source       text,
  total_amount bigint,
  total_fee    bigint
)
language sql stable security invoker set search_path = public as $$
  select
    bt.direction::text,
    bt.category::text,
    coalesce(bt.ref_table, 'manual') as source,
    sum(bt.amount)::bigint,
    sum(coalesce(bt.fee, 0))::bigint
  from public.bank_transactions bt
  group by 1, 2, 3
$$;

-- 3. Totals for a period [p_from, p_to] (inclusive) ---------------------
create or replace function public.finance_period_totals(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'retail_revenue', (select coalesce(sum(total_revenue), 0) from public.daily_sales
                        where sale_date between p_from and p_to),
    'customers',      (select coalesce(sum(customer_count), 0) from public.daily_sales
                        where sale_date between p_from and p_to),
    'cash',           (select coalesce(sum(cash), 0) from public.daily_sales
                        where sale_date between p_from and p_to),
    'qr_card',        (select coalesce(sum(qr_card), 0) from public.daily_sales
                        where sale_date between p_from and p_to),
    'bank_transfer',  (select coalesce(sum(bank_transfer), 0) from public.daily_sales
                        where sale_date between p_from and p_to),
    'wholesale_revenue', (select coalesce(sum(amount), 0) from public.wholesale_sales
                        where sale_date between p_from and p_to),
    'variable_expenses', (select coalesce(sum(amount), 0) from public.variable_expenses
                        where expense_date between p_from and p_to),
    'manual_cash_out', (select coalesce(jsonb_object_agg(category, total), '{}'::jsonb) from (
                          select category::text as category, sum(amount) as total
                          from public.cash_movements
                          where ref_table is null and direction = 'out'
                            and move_date between p_from and p_to
                          group by 1) t),
    'manual_bank_out', (select coalesce(jsonb_object_agg(category, total), '{}'::jsonb) from (
                          select category::text as category, sum(amount) as total
                          from public.bank_transactions
                          where ref_table is null and direction = 'out'
                            and tx_date between p_from and p_to
                          group by 1) t),
    'bank_fees',      (select coalesce(sum(fee), 0) from public.bank_transactions
                        where tx_date between p_from and p_to)
  )
$$;

-- 4. Salary totals per month (no per-person detail) ---------------------
create or replace function public.salary_totals_by_month(p_from date, p_to date)
returns table (period_month date, total bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc('month', sp.period_month)::date, sum(sp.amount)::bigint
  from public.salary_payments sp
  where public.can_read_all()
    and sp.period_month >= date_trunc('month', p_from)::date
    and sp.period_month <= p_to
  group by 1
  order by 1
$$;

revoke execute on function public.cash_ledger_summary()                from public, anon;
revoke execute on function public.bank_ledger_summary()                from public, anon;
revoke execute on function public.finance_period_totals(date, date)    from public, anon;
revoke execute on function public.salary_totals_by_month(date, date)   from public, anon;
grant  execute on function public.cash_ledger_summary()                to authenticated;
grant  execute on function public.bank_ledger_summary()                to authenticated;
grant  execute on function public.finance_period_totals(date, date)    to authenticated;
grant  execute on function public.salary_totals_by_month(date, date)   to authenticated;
