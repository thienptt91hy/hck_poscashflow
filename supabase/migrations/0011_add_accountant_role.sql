-- ============================================================
-- 0011: Add 'accountant' (税理士) value to user_role enum
--
-- Read-only role for the tax accountant: sees every store's financial
-- data (including salary) but can never insert / update / delete.
--
-- ⚠️ Run this file ALONE and let it commit before running 0012.
-- Postgres refuses to USE a freshly-added enum value inside the same
-- transaction that added it ("unsafe use of new value").
-- ============================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'accountant';
