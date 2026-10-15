-- ============================================================
-- 0012: RLS for the read-only 'accountant' (税理士) role
--
-- Requires 0011 to be committed first.
--
-- What changes:
--   * New helper can_read_all() = role in (admin, manager, accountant).
--   * Every READ (select) policy that used is_admin_or_manager() now
--     uses can_read_all(). Existing admin / manager / staff access is a
--     strict subset of the new condition, so nothing is lost.
--   * salary_payments gets a separate SELECT policy for accountant only
--     (manager still cannot read salary; the existing salary_admin
--     FOR ALL policy stays as-is for admin).
--
-- What does NOT change:
--   * All WRITE policies (insert / update / delete) keep using
--     is_admin() / is_admin_or_manager() / current_user_store_id().
--     accountant has store_id = NULL, so "store_id = NULL" is never true
--     => accountant cannot write anywhere.
--   * No data rows are touched. No triggers are touched.
-- ============================================================

-- 1. Helper ---------------------------------------------------------------
create or replace function public.can_read_all()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select role in ('admin', 'manager', 'accountant')
       from public.user_profiles where id = auth.uid()),
    false
  )
$$;

-- 2. Store-scoped tables: admin/manager/accountant see all, staff see own store
drop policy if exists daily_sales_read on public.daily_sales;
create policy daily_sales_read on public.daily_sales for select to authenticated using (
  public.can_read_all() or store_id = public.current_user_store_id()
);

drop policy if exists cash_movements_read on public.cash_movements;
create policy cash_movements_read on public.cash_movements for select to authenticated using (
  public.can_read_all() or store_id = public.current_user_store_id()
);

drop policy if exists var_exp_read on public.variable_expenses;
create policy var_exp_read on public.variable_expenses for select to authenticated using (
  public.can_read_all() or store_id = public.current_user_store_id()
);

-- 3. Chain-wide tables: admin/manager/accountant only
drop policy if exists bank_tx_read on public.bank_transactions;
create policy bank_tx_read on public.bank_transactions for select to authenticated
  using (public.can_read_all());

drop policy if exists fixed_exp_read on public.fixed_expenses;
create policy fixed_exp_read on public.fixed_expenses for select to authenticated
  using (public.can_read_all());

drop policy if exists store_exp_read on public.store_expenses;
create policy store_exp_read on public.store_expenses for select to authenticated
  using (public.can_read_all());

drop policy if exists wholesale_read on public.wholesale_sales;
create policy wholesale_read on public.wholesale_sales for select to authenticated
  using (public.can_read_all());

-- 4. Salary: add read access for accountant ONLY (manager must still not see
--    salary). Admin keeps full access via the existing salary_admin policy.
drop policy if exists salary_read on public.salary_payments;
create policy salary_read on public.salary_payments for select to authenticated
  using (public.current_user_role() = 'accountant');

-- ============================================================
-- Verification (run manually after both migrations, as a sanity check):
--
--   select set_config('request.jwt.claims',
--     json_build_object('sub','<ACCOUNTANT_UUID>','role','authenticated')::text, true);
--   set local role authenticated;
--   select count(*) from public.salary_payments;              -- readable
--   insert into public.cash_movements
--     (move_date, store_id, direction, category, amount)
--     values (current_date, (select id from public.stores limit 1), 'in', 'other', 1);
--   -- expected: ERROR  new row violates row-level security policy
-- ============================================================
