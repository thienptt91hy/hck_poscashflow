-- =============================================================
-- POS CashFlow — Combined deploy script (migrations 0001-0010 + seed)
-- Paste toan bo file nay vao Supabase SQL Editor va bam Run 1 lan (chi cho DB moi/trong).
-- =============================================================

-- >>>>>>>>>>>>>>> supabase\migrations\0001_initial_schema.sql >>>>>>>>>>>>>>>
-- =============================================================
-- POS CashFlow — Initial Schema (Phase 1–3)
-- All money is stored in JPY as integer (yen has no subunit).
-- Timestamps: TIMESTAMPTZ (UTC in DB, display in Asia/Tokyo).
-- =============================================================

-- -------------------- ENUMS --------------------
create type public.user_role       as enum ('admin', 'manager', 'staff');
create type public.revenue_stream  as enum ('main', 'cafe_bakery');
create type public.cash_direction  as enum ('in', 'out');
create type public.cash_category   as enum (
  'sales', 'cod', 'purchase', 'staff_take', 'deposit_to_bank', 'adjust', 'other'
);
create type public.bank_direction  as enum ('in', 'out');
create type public.bank_category   as enum (
  'deposit_from_store', 'purchase', 'expense', 'salary', 'other'
);
create type public.payment_method  as enum ('cash', 'qr_card', 'bank_transfer', 'credit_card');
create type public.expense_paid_from as enum ('cash', 'bank');
create type public.expense_scope   as enum ('fixed', 'store', 'variable');

-- -------------------- STORES --------------------
create table public.stores (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null,
  name_vi           text not null,
  name_ja           text,
  name_en           text,
  has_cafe_bakery   boolean not null default false,
  active            boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);

comment on column public.stores.has_cafe_bakery is 'If true, daily_sales can use revenue_stream = cafe_bakery';

-- -------------------- USER PROFILES --------------------
create table public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'staff',
  store_id    uuid references public.stores(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.user_profiles is 'Extends auth.users with app-specific profile';
comment on column public.user_profiles.store_id is 'For staff: the store they belong to. Null for admin/manager.';

-- -------------------- EMPLOYEES --------------------
create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  store_id    uuid not null references public.stores(id) on delete restrict,
  position    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index employees_store_id_idx on public.employees(store_id);

-- -------------------- DAILY SALES --------------------
create table public.daily_sales (
  id              uuid primary key default gen_random_uuid(),
  sale_date       date not null,
  store_id        uuid not null references public.stores(id),
  revenue_stream  public.revenue_stream not null default 'main',
  employee_id     uuid references public.employees(id),
  customer_count  int not null default 0 check (customer_count >= 0),
  cash            int not null default 0 check (cash >= 0),
  qr_card         int not null default 0 check (qr_card >= 0),
  bank_transfer   int not null default 0 check (bank_transfer >= 0),
  total_revenue   int generated always as (cash + qr_card + bank_transfer) stored,
  avg_per_customer int generated always as (
    case when customer_count > 0
      then (cash + qr_card + bank_transfer) / customer_count
      else 0 end
  ) stored,
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index daily_sales_store_date_idx on public.daily_sales(store_id, sale_date desc);
create index daily_sales_date_idx       on public.daily_sales(sale_date desc);

-- -------------------- CASH MOVEMENTS --------------------
create table public.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  move_date   date not null,
  store_id    uuid not null references public.stores(id),
  direction   public.cash_direction not null,
  category    public.cash_category not null,
  amount      int not null check (amount > 0),
  note        text,
  ref_table   text,
  ref_id      uuid,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index cash_movements_store_date_idx on public.cash_movements(store_id, move_date desc);

-- -------------------- BANK TRANSACTIONS --------------------
create table public.bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  tx_date         date not null,
  direction       public.bank_direction not null,
  category        public.bank_category not null,
  payment_method  public.payment_method not null default 'bank_transfer',
  amount          int not null check (amount > 0),
  fee             int not null default 0 check (fee >= 0),
  vendor          text,
  store_id        uuid references public.stores(id),
  note            text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index bank_tx_date_idx on public.bank_transactions(tx_date desc);

-- -------------------- EXPENSES --------------------
-- Fixed monthly expenses (company-wide, not per-store)
create table public.fixed_expenses (
  id            uuid primary key default gen_random_uuid(),
  name_vi       text not null,
  name_ja       text,
  amount        int not null check (amount >= 0),
  day_of_month  int check (day_of_month between 1 and 31),
  category      text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Per-store recurring expenses (rent, internet)
create table public.store_expenses (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  name            text not null,
  amount          int not null check (amount >= 0),
  recurring_day   int check (recurring_day between 1 and 31),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Variable / ad-hoc expenses
create table public.variable_expenses (
  id          uuid primary key default gen_random_uuid(),
  expense_date date not null,
  store_id    uuid references public.stores(id),
  category    text,
  amount      int not null check (amount > 0),
  paid_from   public.expense_paid_from not null default 'cash',
  note        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index variable_expenses_date_idx on public.variable_expenses(expense_date desc);

-- -------------------- WHOLESALE --------------------
create table public.wholesale_sales (
  id                uuid primary key default gen_random_uuid(),
  sale_date         date not null,
  customer_company  text not null,
  amount            int not null check (amount > 0),
  payment_method    public.payment_method not null,
  paid              boolean not null default false,
  due_date          date,
  note              text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now()
);

-- -------------------- SALARY --------------------
create table public.salary_payments (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id),
  store_id        uuid not null references public.stores(id),
  period_month    date not null,
  amount          int not null check (amount > 0),
  payment_method  public.payment_method not null,
  paid_at         timestamptz,
  note            text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- -------------------- AUDIT LOG --------------------
create table public.audit_log (
  id          bigserial primary key,
  table_name  text not null,
  record_id   uuid,
  action      text not null,
  before      jsonb,
  after       jsonb,
  user_id     uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index audit_log_table_record_idx on public.audit_log(table_name, record_id);

-- =============================================================
-- TRIGGERS
-- =============================================================

-- updated_at auto-touch
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();

create trigger daily_sales_touch_updated_at
  before update on public.daily_sales
  for each row execute function public.touch_updated_at();

-- Auto-create user_profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- HELPER FUNCTIONS (for RLS)
-- =============================================================

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer as $$
  select role from public.user_profiles where id = auth.uid()
$$;

create or replace function public.current_user_store_id()
returns uuid language sql stable security definer as $$
  select store_id from public.user_profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select role = 'admin' from public.user_profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin_or_manager()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select role in ('admin', 'manager') from public.user_profiles where id = auth.uid()),
    false
  )
$$;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
alter table public.stores              enable row level security;
alter table public.user_profiles       enable row level security;
alter table public.employees           enable row level security;
alter table public.daily_sales         enable row level security;
alter table public.cash_movements      enable row level security;
alter table public.bank_transactions   enable row level security;
alter table public.fixed_expenses      enable row level security;
alter table public.store_expenses      enable row level security;
alter table public.variable_expenses   enable row level security;
alter table public.wholesale_sales     enable row level security;
alter table public.salary_payments     enable row level security;
alter table public.audit_log           enable row level security;

-- stores: all authenticated can read; only admin can write
create policy stores_read  on public.stores for select to authenticated using (true);
create policy stores_write on public.stores for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_profiles: users read own + admin reads all; admin manages
create policy user_profiles_read_own on public.user_profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy user_profiles_admin_all on public.user_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- employees: all authenticated can read; admin/manager can write
create policy employees_read  on public.employees for select to authenticated using (true);
create policy employees_write on public.employees for all    to authenticated
  using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

-- daily_sales: staff see/insert own store; admin/manager full access
create policy daily_sales_read on public.daily_sales for select to authenticated using (
  public.is_admin_or_manager() or store_id = public.current_user_store_id()
);
create policy daily_sales_insert on public.daily_sales for insert to authenticated with check (
  public.is_admin_or_manager() or store_id = public.current_user_store_id()
);
create policy daily_sales_update on public.daily_sales for update to authenticated
  using (public.is_admin_or_manager() or store_id = public.current_user_store_id())
  with check (public.is_admin_or_manager() or store_id = public.current_user_store_id());
create policy daily_sales_delete on public.daily_sales for delete to authenticated
  using (public.is_admin());

-- cash_movements: same pattern as daily_sales
create policy cash_movements_read on public.cash_movements for select to authenticated using (
  public.is_admin_or_manager() or store_id = public.current_user_store_id()
);
create policy cash_movements_insert on public.cash_movements for insert to authenticated with check (
  public.is_admin_or_manager() or store_id = public.current_user_store_id()
);
create policy cash_movements_update on public.cash_movements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy cash_movements_delete on public.cash_movements for delete to authenticated using (public.is_admin());

-- bank_transactions: admin/manager only
create policy bank_tx_read  on public.bank_transactions for select to authenticated using (public.is_admin_or_manager());
create policy bank_tx_write on public.bank_transactions for all    to authenticated
  using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

-- expenses: admin/manager only
create policy fixed_exp_read  on public.fixed_expenses for select to authenticated using (public.is_admin_or_manager());
create policy fixed_exp_write on public.fixed_expenses for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy store_exp_read  on public.store_expenses for select to authenticated using (public.is_admin_or_manager());
create policy store_exp_write on public.store_expenses for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy var_exp_read on public.variable_expenses for select to authenticated using (
  public.is_admin_or_manager() or store_id = public.current_user_store_id()
);
create policy var_exp_insert on public.variable_expenses for insert to authenticated with check (
  public.is_admin_or_manager() or store_id = public.current_user_store_id()
);
create policy var_exp_update on public.variable_expenses for update to authenticated
  using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());
create policy var_exp_delete on public.variable_expenses for delete to authenticated using (public.is_admin());

-- wholesale: admin/manager only
create policy wholesale_read  on public.wholesale_sales for select to authenticated using (public.is_admin_or_manager());
create policy wholesale_write on public.wholesale_sales for all    to authenticated
  using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

-- salary: admin only (confidential)
create policy salary_admin on public.salary_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- audit_log: admin read-only
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

-- >>>>>>>>>>>>>>> supabase\migrations\0002_ledger_sync.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0003_general_cash.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0004_cleanup_cash_expenses.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0005_fix_rls_and_resync.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0006_fix_bank_fee_net_amount.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0007_restore_cash_expense_sync.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0008_add_cash_expense_to_sales.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0009_cash_expense_to_variable_expense.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\migrations\0010_cash_expense_items.sql >>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>> supabase\seed.sql >>>>>>>>>>>>>>>
-- =============================================================
-- Seed data — 4 stores
-- =============================================================
insert into public.stores (code, name_vi, name_ja, name_en, has_cafe_bakery, sort_order) values
  ('SETO',   'Seto',               '瀬戸店',            'Seto',           false, 1),
  ('KOMAKI', 'Komaki',             '小牧店',            'Komaki',         false, 2),
  ('KONAN',  'Konan',              '江南店',            'Konan',          true,  3),
  ('BANHMI', 'Quán Bánh mì',       'バインミー店',      'Banh Mi Shop',   false, 4)
on conflict (code) do nothing;

-- Sample fixed expenses (from requirements doc)
insert into public.fixed_expenses (name_vi, name_ja, amount, category) values
  ('Máy POS (card machine)', 'カード機',          4950,   'equipment'),
  ('Web hosting',             'Web',               5000,   'service'),
  ('Bảo hiểm + lương hưu',   '保険・年金',        871672, 'insurance'),
  ('Xe Hiace',                'ハイエース',         51400,  'vehicle'),
  ('Bảo hiểm xe',             '自動車保険',         14860,  'insurance'),
  ('Thuế',                    '税金',               33000,  'tax')
on conflict do nothing;
