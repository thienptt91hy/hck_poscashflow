-- ============================================================
-- 0003: General cash pool + fix double-counting
--
-- Changes:
--   1. cash_movements.store_id → nullable (NULL = Quỹ chung)
--   2. fn_sync_expense: remove cash case (daily_sales.cash already
--      reflects net-of-expense amount, so creating a cash_movement
--      would double-count)
--   3. fn_sync_salary: cash payment → NULL store_id (Quỹ chung)
--   4. fn_sync_wholesale: cash received → NULL store_id (Quỹ chung)
-- ============================================================

-- 1. Make store_id nullable — NULL represents the general cash pool
ALTER TABLE public.cash_movements
  ALTER COLUMN store_id DROP NOT NULL;

-- 2. Expense trigger: bank only (no cash case)
CREATE OR REPLACE FUNCTION public.fn_sync_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('variable_expenses', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Cash expenses are NOT synced to cash_movements.
  -- Reason: daily_sales.cash already reflects the net amount
  -- after cash expenses paid from the store register (case ①).
  -- For case ② (paid from pooled cash), the cash deduction is
  -- handled manually or tracked via salary/deposit flows.

  IF NEW.paid_from = 'bank' THEN
    INSERT INTO public.bank_transactions
      (tx_date, direction, category, payment_method, amount, note, ref_table, ref_id)
    VALUES
      (NEW.expense_date, 'out', 'expense', 'bank_transfer', NEW.amount,
       COALESCE(NEW.category, 'Chi phí'), 'variable_expenses', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Salary trigger: cash → Quỹ chung (store_id = NULL)
CREATE OR REPLACE FUNCTION public.fn_sync_salary()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_date date;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('salary_payments', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  v_date := COALESCE(
    (NEW.paid_at AT TIME ZONE 'Asia/Tokyo')::date,
    NEW.period_month
  );

  IF NEW.payment_method = 'cash' THEN
    -- Salary cash comes from the general pooled cash (NULL store_id)
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (v_date, NULL, 'out', 'salary', NEW.amount,
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

-- 4. Wholesale trigger: cash received → Quỹ chung (store_id = NULL)
CREATE OR REPLACE FUNCTION public.fn_sync_wholesale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.delete_auto_ledger('wholesale_sales', OLD.id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NOT NEW.paid THEN RETURN NEW; END IF;

  IF NEW.payment_method = 'cash' THEN
    -- Cash wholesale goes to general pool (NULL store_id)
    INSERT INTO public.cash_movements
      (move_date, store_id, direction, category, amount, note, ref_table, ref_id)
    VALUES
      (NEW.sale_date, NULL, 'in', 'sales', NEW.amount,
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
