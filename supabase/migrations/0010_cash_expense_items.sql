-- ============================================================
-- 0010: Itemized cash expenses (amount + note) on daily_sales
--
-- Replaces the single cash_expense value with a LIST of items so
-- staff can record several cash purchases in one day, each with its
-- own note (e.g. "mua gạo").
--
--   daily_sales.cash_expense_items = [{ "amount": int, "note": text }, ...]
--
-- daily_sales.cash_expense (int) is kept as the auto-summed total that
-- feeds total_revenue (migration 0008). Each item becomes its own
-- linked variable_expenses row (paid_from='cash') so the note shows
-- in Chi phí. Register still nets to the counted `cash`.
-- ============================================================

-- 1. New column holding the breakdown
ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS cash_expense_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. BEFORE trigger: keep cash_expense = SUM(items) so total_revenue stays correct
CREATE OR REPLACE FUNCTION public.fn_daily_sales_sum_cash_expense()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.cash_expense := COALESCE((
    SELECT SUM(GREATEST(COALESCE((elem->>'amount')::int, 0), 0))
    FROM jsonb_array_elements(COALESCE(NEW.cash_expense_items, '[]'::jsonb)) AS elem
  ), 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_sales_sum_cash_expense ON public.daily_sales;
CREATE TRIGGER trg_daily_sales_sum_cash_expense
  BEFORE INSERT OR UPDATE ON public.daily_sales
  FOR EACH ROW EXECUTE FUNCTION public.fn_daily_sales_sum_cash_expense();

-- 3. AFTER trigger: gross cash-in + expand each item into a linked expense
CREATE OR REPLACE FUNCTION public.fn_sync_daily_sales()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  elem     jsonb;
  v_amount int;
  v_note   text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('daily_sales', OLD.id);
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

  -- Each cash-expense item → its own variable_expense (note = staff's note)
  FOR elem IN
    SELECT value FROM jsonb_array_elements(COALESCE(NEW.cash_expense_items, '[]'::jsonb))
  LOOP
    v_amount := COALESCE((elem->>'amount')::int, 0);
    v_note   := NULLIF(btrim(COALESCE(elem->>'note', '')), '');
    IF v_amount > 0 THEN
      INSERT INTO public.variable_expenses
        (expense_date, store_id, category, amount, paid_from, note, created_by, ref_table, ref_id)
      VALUES
        (NEW.sale_date, NEW.store_id, 'Tiền mặt TT hàng hóa', v_amount, 'cash',
         v_note, NEW.created_by, 'daily_sales', NEW.id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4. Migrate existing single cash_expense values into the new items list.
--    The UPDATE re-fires the triggers above, re-creating the linked rows.
UPDATE public.daily_sales
SET cash_expense_items = jsonb_build_array(
      jsonb_build_object('amount', cash_expense, 'note', NULL)
    )
WHERE cash_expense > 0
  AND (cash_expense_items IS NULL OR cash_expense_items = '[]'::jsonb);
