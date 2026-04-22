-- ============================================================
-- 0005: Fix RLS delete policy + backfill missing auto-entries
--
-- Problems fixed:
--   1. daily_sales DELETE was admin-only → manager couldn't delete
--   2. Sales entered BEFORE trigger 0002 have no auto cash_movements /
--      bank_transactions → cash/bank sections of report show ¥0 while
--      revenue shows real figures (inconsistent).
--
-- Solution:
--   1. Allow admin + manager to delete daily_sales
--   2. Backfill cash_movements / bank_transactions for all daily_sales
--      rows that have no existing auto-entry (inserted pre-trigger)
-- ============================================================

-- 1. Fix delete policy: allow admin OR manager
DROP POLICY IF EXISTS daily_sales_delete ON public.daily_sales;
CREATE POLICY daily_sales_delete ON public.daily_sales FOR DELETE TO authenticated
  USING (public.is_admin_or_manager());

-- 2. Backfill cash_movements for pre-trigger daily_sales (cash > 0, no entry yet)
INSERT INTO public.cash_movements
  (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
SELECT
  ds.sale_date,
  ds.store_id,
  'in',
  'sales',
  ds.cash,
  'Doanh thu tiền mặt',
  'daily_sales',
  ds.id
FROM public.daily_sales ds
WHERE ds.cash > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_movements cm
    WHERE cm.ref_table = 'daily_sales' AND cm.ref_id = ds.id
  );

-- 3. Backfill bank_transactions for pre-trigger daily_sales (bank_transfer > 0, no entry yet)
INSERT INTO public.bank_transactions
  (tx_date, direction, category, payment_method, amount, store_id, note, ref_table, ref_id)
SELECT
  ds.sale_date,
  'in',
  'deposit_from_store',
  'bank_transfer',
  ds.bank_transfer,
  ds.store_id,
  'Doanh thu chuyển khoản',
  'daily_sales',
  ds.id
FROM public.daily_sales ds
WHERE ds.bank_transfer > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_transactions bt
    WHERE bt.ref_table = 'daily_sales' AND bt.ref_id = ds.id
  );
