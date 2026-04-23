-- ============================================================
-- 0007: Restore cash expense → cash_movements sync
--
-- Migration 0003 removed the cash case from fn_sync_expense,
-- reasoning that daily_sales.cash is "net of expenses". That
-- assumption was wrong — daily_sales.cash is GROSS revenue from
-- customers; variable expenses are separate cash outflows.
-- Migration 0004 then deleted all existing cash expense entries.
--
-- Fix:
--   1. Restore fn_sync_expense with cash case (store_id from expense,
--      NULL = Quỹ chung). category = 'purchase' (enum); expense
--      category text stored in note field.
--   2. Backfill cash_movements for all cash expenses that have no entry
-- ============================================================

-- 1. Restore fn_sync_expense with cash case
CREATE OR REPLACE FUNCTION public.fn_sync_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('variable_expenses', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW.paid_from = 'cash' THEN
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (NEW.expense_date, NEW.store_id, 'out', 'purchase',
       NEW.amount,
       COALESCE(NEW.note, '') || CASE WHEN NEW.note IS NOT NULL AND NEW.category IS NOT NULL THEN ' · ' ELSE '' END || COALESCE(NEW.category, 'Chi phí phát sinh'),
       'variable_expenses', NEW.id);

  ELSIF NEW.paid_from = 'bank' THEN
    INSERT INTO public.bank_transactions
      (tx_date, direction, category, payment_method, amount, note, ref_table, ref_id)
    VALUES
      (NEW.expense_date, 'out', 'expense', 'bank_transfer', NEW.amount,
       COALESCE(NEW.note, NEW.category, 'Chi phí'), 'variable_expenses', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Backfill: cash expenses with no matching cash_movements entry
INSERT INTO public.cash_movements
  (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
SELECT
  ve.expense_date,
  ve.store_id,
  'out',
  'purchase'::public.cash_category,
  ve.amount,
  COALESCE(ve.note, '') || CASE WHEN ve.note IS NOT NULL AND ve.category IS NOT NULL THEN ' · ' ELSE '' END || COALESCE(ve.category, 'Chi phí phát sinh'),
  'variable_expenses',
  ve.id
FROM public.variable_expenses ve
WHERE ve.paid_from = 'cash'
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_movements cm
    WHERE cm.ref_table = 'variable_expenses' AND cm.ref_id = ve.id
  );
