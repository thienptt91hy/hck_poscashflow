-- ============================================================
-- 0009: daily_sales.cash_expense → auto variable_expenses (Chi phí)
--
-- When staff record cash_expense (cash taken from the register to
-- buy goods during the day), we now:
--   1. record the store cash IN as GROSS (cash + cash_expense), and
--   2. auto-create a LINKED variable_expenses row (paid_from='cash').
--
-- The existing expense trigger (fn_sync_expense, 0007) turns that
-- variable_expense into a cash OUT of the same store. Net effect on
-- the register = the counted `cash`, the purchase shows up in Chi phí,
-- and gross revenue already includes cash_expense (migration 0008).
--
--   cash IN (sales) = cash + cash_expense
--   cash OUT (purchase, via variable_expenses) = cash_expense
--   => register net = cash  ✓   |   Chi phí shows cash_expense  ✓
--
-- Linked rows carry ref_table='daily_sales' / ref_id=<sale id> and
-- are managed only from the Sales entry (read-only in Chi phí UI).
-- ============================================================

-- 1. Link columns on variable_expenses (mirrors cash_movements pattern)
ALTER TABLE public.variable_expenses
  ADD COLUMN IF NOT EXISTS ref_table text,
  ADD COLUMN IF NOT EXISTS ref_id    uuid;

CREATE INDEX IF NOT EXISTS var_exp_ref_idx
  ON public.variable_expenses(ref_table, ref_id) WHERE ref_table IS NOT NULL;

-- 2. Rewrite daily_sales sync: gross cash-in + linked cash expense
CREATE OR REPLACE FUNCTION public.fn_sync_daily_sales()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('daily_sales', OLD.id);
    -- Remove the linked cash-expense row; its own trigger removes its cash OUT
    DELETE FROM public.variable_expenses
      WHERE ref_table = 'daily_sales' AND ref_id = OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Cash sales IN = counted cash + cash spent on goods (gross)
  IF (NEW.cash + NEW.cash_expense) > 0 THEN
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (NEW.sale_date, NEW.store_id, 'in', 'sales', NEW.cash + NEW.cash_expense,
       'Doanh thu tiền mặt', 'daily_sales', NEW.id);
  END IF;

  -- Bank transfer IN
  IF NEW.bank_transfer > 0 THEN
    INSERT INTO public.bank_transactions
      (tx_date, direction, category, payment_method, amount, store_id, note, ref_table, ref_id)
    VALUES
      (NEW.sale_date, 'in', 'deposit_from_store', 'bank_transfer', NEW.bank_transfer,
       NEW.store_id, 'Doanh thu chuyển khoản', 'daily_sales', NEW.id);
  END IF;

  -- Cash spent on goods → linked variable_expense (paid from cash).
  -- fn_sync_expense will create the matching cash OUT automatically.
  IF NEW.cash_expense > 0 THEN
    INSERT INTO public.variable_expenses
      (expense_date, store_id, category, amount, paid_from, note, created_by, ref_table, ref_id)
    VALUES
      (NEW.sale_date, NEW.store_id, 'Tiền mặt TT hàng hóa', NEW.cash_expense, 'cash',
       'Tự động từ doanh thu ' || NEW.sale_date, NEW.created_by, 'daily_sales', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Backfill: create linked expenses for any existing sales that
--    already have cash_expense > 0 but no linked row yet.
INSERT INTO public.variable_expenses
  (expense_date, store_id, category, amount, paid_from, note, created_by, ref_table, ref_id)
SELECT
  ds.sale_date, ds.store_id, 'Tiền mặt TT hàng hóa', ds.cash_expense, 'cash',
  'Tự động từ doanh thu ' || ds.sale_date, ds.created_by, 'daily_sales', ds.id
FROM public.daily_sales ds
WHERE ds.cash_expense > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.variable_expenses ve
    WHERE ve.ref_table = 'daily_sales' AND ve.ref_id = ds.id
  );
