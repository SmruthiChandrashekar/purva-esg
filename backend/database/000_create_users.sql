-- 000_create_users.sql
-- Creates the public.users profile table. Run this FIRST: 001_create_grievances.sql
-- points at users(user_id).
--
-- The live project's table was first made in the Supabase dashboard, so this file
-- rebuilds the base columns that the app and the later SQL files expect. The later
-- files add the rest:
--   004 / 006 / 010  role rule (final list is set by 010)
--   004 / 006        is_active
--   011              admin_tier (L1, L2, L3, HEAD)
--   012              profile fields (phone, avatar_url, designation, location, ...)
--   015              row-level security and policies
--   017              phone_verified, phone_verified_at
--
-- Safe to run on an existing database: it does nothing if the table already exists.

CREATE TABLE IF NOT EXISTS public.users (
  -- Same id as the Supabase Auth account (auth.users.id)
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  -- 'user' for stakeholders; staff roles are set by the super admin
  role        TEXT NOT NULL DEFAULT 'user',
  -- 'Internal', 'Contract' or 'External' (chosen at sign-up)
  user_type   TEXT,
  department  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
