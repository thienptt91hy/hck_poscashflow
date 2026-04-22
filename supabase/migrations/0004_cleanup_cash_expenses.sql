-- ============================================================
-- 0004: Clean up double-counted cash expense entries
--
-- Migration 0002 created cash_movements entries for cash expenses
-- (paid_from = 'cash') which was wrong — daily_sales.cash already
-- reflects the net-of-expense amount.
-- Migration 0003 fixed the trigger, but any entries already in
-- cash_movements from the 0002 period must be removed manually.
-- ============================================================

DELETE FROM public.cash_movements
WHERE ref_table = 'variable_expenses'
  AND ref_id IN (
    SELECT id FROM public.variable_expenses WHERE paid_from = 'cash'
  );
