-- 000_create_users.sql
-- Creates the public.users profile table. Run this FIRST: 001_create_grievances.sql
-- points at users(user_id).
--
-- The live project's table was first made in the Supabase dashboard. This file matches
-- its base columns (checked against the live table on 2026-11-16). The later files add
-- the rest:
--   004 / 006 / 010  role rule (final list is set by 010)
--   004 / 006        is_active
--   011              admin_tier (L1, L2, L3, HEAD)
--   012              profile fields (avatar_url, designation, location, employee_id, ...)
--   015              row-level security and policies
--   017              phone_verified, phone_verified_at
--
-- The old "password" column on the live table is not recreated: logins use Supabase
-- Auth, and no code reads or writes it.
--
-- Safe to run on an existing database: it does nothing if the table already exists.

CREATE TABLE IF NOT EXISTS public.users (
  -- Same id as the Supabase Auth account (auth.users.id); sign-up inserts it explicitly
  user_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  -- 'Internal', 'Contract' or 'External' (chosen at sign-up)
  user_type    TEXT NOT NULL,
  -- 'user' for stakeholders; staff roles are set by the super admin
  role         TEXT DEFAULT 'user',
  is_verified  BOOLEAN DEFAULT false,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  department   TEXT,
  phone        VARCHAR
);
