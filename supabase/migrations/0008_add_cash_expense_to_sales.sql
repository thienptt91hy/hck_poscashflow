-- ============================================================
-- 0008: Add cash_expense (cash paid for goods) to daily_sales
--
-- Business rule: staff sometimes use cash from the register to pay
-- for goods/purchases during the day. That cash originated from
-- customer sales, so it must be added back into gross revenue.
--
--   total_revenue = cash + qr_card + bank_transfer + cash_expense
--
-- NOTE: the cash ledger (cash_movements) is NOT touched — the sync
-- trigger keeps using NEW.cash (the counted register cash), so the
-- cash pool balance stays correct and there is no double-counting.
-- Do NOT also record this amount in Chi phí (variable_expenses),
-- otherwise it would be deducted from the register twice.
-- ============================================================

-- 1. New column (safe to re-run)
ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS cash_expense int NOT NULL DEFAULT 0 CHECK (cash_expense >= 0);

COMMENT ON COLUMN public.daily_sales.cash_expense IS
  'Cash taken from the register to pay for goods during the day. Added into total_revenue (gross). Does not create a cash_movements entry.';

-- 2. Regenerate total_revenue to include cash_expense
ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS total_revenue;
ALTER TABLE public.daily_sales
  ADD COLUMN total_revenue int
  GENERATED ALWAYS AS (cash + qr_card + bank_transfer + cash_expense) STORED;

-- 3. Regenerate avg_per_customer to match the new total
ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS avg_per_customer;
ALTER TABLE public.daily_sales
  ADD COLUMN avg_per_customer int
  GENERATED ALWAYS AS (
    CASE WHEN customer_count > 0
      THEN (cash + qr_card + bank_transfer + cash_expense) / customer_count
      ELSE 0 END
  ) STORED;
