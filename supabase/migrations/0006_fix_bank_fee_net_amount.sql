-- ============================================================
-- 0006: Fix manual bank "in" entries — store NET not GROSS
--
-- Before this fix, bank-form.tsx stored GROSS amount for "in"
-- direction transactions (fee was recorded separately but not
-- subtracted from amount). The trigger-generated entries already
-- stored NET, so manual entries were inconsistent.
--
-- Fix: subtract fee from amount for all manual "in" entries
-- where fee > 0 and amount has not yet been adjusted.
-- ============================================================

UPDATE public.bank_transactions
SET amount = GREATEST(1, amount - fee)
WHERE direction = 'in'
  AND fee > 0
  AND ref_table IS NULL;
