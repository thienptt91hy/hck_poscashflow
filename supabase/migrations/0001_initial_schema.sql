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
