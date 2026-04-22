-- ============================================================
-- 0002: Automatic ledger synchronisation
-- When daily_sales / variable_expenses / salary_payments /
-- wholesale_sales are inserted, updated or deleted, the
-- corresponding cash_movements and bank_transactions are
-- maintained automatically via AFTER triggers.
-- ============================================================

-- 1. Add 'salary' to cash_category so trigger can write salary entries
ALTER TYPE public.cash_category ADD VALUE IF NOT EXISTS 'salary';

-- 2. deposit_fee column on cash_movements (used by deposit_to_bank)
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS deposit_fee int NOT NULL DEFAULT 0 CHECK (deposit_fee >= 0);

-- 3. Source-tracking columns on bank_transactions (mirrors ref_table/ref_id that cash_movements already has)
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS ref_table text,
  ADD COLUMN IF NOT EXISTS ref_id    uuid;

CREATE INDEX IF NOT EXISTS bank_tx_ref_idx   ON public.bank_transactions(ref_table, ref_id) WHERE ref_table IS NOT NULL;
CREATE INDEX IF NOT EXISTS cash_mov_ref_idx  ON public.cash_movements(ref_table, ref_id)    WHERE ref_table IS NOT NULL;

-- 4. store_id on wholesale_sales (needed to know which cash box gets credited)
ALTER TABLE public.wholesale_sales
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

-- ============================================================
-- HELPER: delete auto-generated entries for a given source
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_auto_ledger(p_ref_table text, p_ref_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.cash_movements   WHERE ref_table = p_ref_table AND ref_id = p_ref_id;
  DELETE FROM public.bank_transactions WHERE ref_table = p_ref_table AND ref_id = p_ref_id;
END;
$$;

-- ============================================================
-- TRIGGER 1: daily_sales → cash_movements + bank_transactions
--   cash        → cash_movements (in, sales)
--   bank_transfer → bank_transactions (in, deposit_from_store)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_daily_sales()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('daily_sales', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW.cash > 0 THEN
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (NEW.sale_date, NEW.store_id, 'in', 'sales', NEW.cash,
       'Doanh thu tiền mặt', 'daily_sales', NEW.id);
  END IF;

  IF NEW.bank_transfer > 0 THEN
    INSERT INTO public.bank_transactions
      (tx_date, direction, category, payment_method, amount, store_id, note, ref_table, ref_id)
    VALUES
      (NEW.sale_date, 'in', 'deposit_from_store', 'bank_transfer', NEW.bank_transfer,
       NEW.store_id, 'Doanh thu chuyển khoản', 'daily_sales', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_sales_sync ON public.daily_sales;
CREATE TRIGGER trg_daily_sales_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_sales
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_daily_sales();

-- ============================================================
-- TRIGGER 2: variable_expenses → cash_movements or bank_transactions
--   paid_from=cash → cash_movements (out, purchase)
--   paid_from=bank → bank_transactions (out, expense)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('variable_expenses', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW.paid_from = 'cash' AND NEW.store_id IS NOT NULL THEN
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (NEW.expense_date, NEW.store_id, 'out', 'purchase', NEW.amount,
       COALESCE(NEW.category, 'Chi phí'), 'variable_expenses', NEW.id);

  ELSIF NEW.paid_from = 'bank' THEN
    INSERT INTO public.bank_transactions
      (tx_date, direction, category, payment_method, amount, note, ref_table, ref_id)
    VALUES
      (NEW.expense_date, 'out', 'expense', 'bank_transfer', NEW.amount,
       COALESCE(NEW.category, 'Chi phí'), 'variable_expenses', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_sync ON public.variable_expenses;
CREATE TRIGGER trg_expense_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.variable_expenses
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_expense();

-- ============================================================
-- TRIGGER 3: salary_payments → cash_movements or bank_transactions
--   payment_method=cash         → cash_movements (out, salary) from employee's store
--   payment_method=bank_transfer/qr_card/credit_card → bank_transactions (out, salary)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_salary()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_date date;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('salary_payments', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Use paid_at (JST) or period_month as the ledger date
  v_date := COALESCE(
    (NEW.paid_at AT TIME ZONE 'Asia/Tokyo')::date,
    NEW.period_month
  );

  IF NEW.payment_method = 'cash' THEN
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (v_date, NEW.store_id, 'out', 'salary', NEW.amount,
       'Lương nhân viên', 'salary_payments', NEW.id);
  ELSE
    INSERT INTO public.bank_transactions
      (tx_date, direction, category, payment_method, amount, note, ref_table, ref_id)
    VALUES
      (v_date, 'out', 'salary', NEW.payment_method, NEW.amount,
       'Lương nhân viên', 'salary_payments', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_salary_sync ON public.salary_payments;
CREATE TRIGGER trg_salary_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_salary();

-- ============================================================
-- TRIGGER 4: wholesale_sales → cash_movements or bank_transactions
--   Only fires when paid = true.
--   payment_method=cash + store_id set → cash_movements (in, sales)
--   payment_method=bank_transfer/qr_card/credit_card → bank_transactions (in, other)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_wholesale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('wholesale_sales', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Only sync when the order is marked paid
  IF NOT NEW.paid THEN RETURN NEW; END IF;

  IF NEW.payment_method = 'cash' AND NEW.store_id IS NOT NULL THEN
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (NEW.sale_date, NEW.store_id, 'in', 'sales', NEW.amount,
       'Bán sỉ: ' || NEW.customer_company, 'wholesale_sales', NEW.id);

  ELSIF NEW.payment_method IN ('bank_transfer', 'qr_card', 'credit_card') THEN
    INSERT INTO public.bank_transactions
      (tx_date, direction, category, payment_method, amount, note, ref_table, ref_id)
    VALUES
      (NEW.sale_date, 'in', 'other', NEW.payment_method, NEW.amount,
       'Bán sỉ: ' || NEW.customer_company, 'wholesale_sales', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wholesale_sync ON public.wholesale_sales;
CREATE TRIGGER trg_wholesale_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.wholesale_sales
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_wholesale();

-- ============================================================
-- TRIGGER 5: cash_movements (deposit_to_bank) → bank_transactions
--   When a manual cash_movement is direction=out, category=deposit_to_bank,
--   automatically create the matching bank IN entry (net of deposit_fee).
--   Auto-generated movements (ref_table IS NOT NULL) are skipped to avoid loops.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_cash_deposit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_net int;
BEGIN
  -- Skip auto-generated rows to prevent infinite loops
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.ref_table IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.ref_table IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Remove any previously linked bank entry
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    DELETE FROM public.bank_transactions
    WHERE ref_table = 'cash_movements' AND ref_id = OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Create bank IN entry when depositing cash to bank
  IF NEW.direction = 'out' AND NEW.category = 'deposit_to_bank' THEN
    v_net := NEW.amount - COALESCE(NEW.deposit_fee, 0);
    IF v_net > 0 THEN
      INSERT INTO public.bank_transactions
        (tx_date, direction, category, payment_method, amount, fee, note, ref_table, ref_id)
      VALUES
        (NEW.move_date, 'in', 'deposit_from_store', 'cash', v_net,
         COALESCE(NEW.deposit_fee, 0),
         'Nộp tiền mặt vào ngân hàng', 'cash_movements', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_deposit_sync ON public.cash_movements;
CREATE TRIGGER trg_cash_deposit_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cash_deposit();
