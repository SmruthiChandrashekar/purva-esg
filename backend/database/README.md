# Database setup (Supabase)

Everything here runs in the Supabase **SQL Editor** (Dashboard → SQL Editor → New query).
Run the files once each, **in the order below**. They are written to be safe to re-run
on an existing database (`IF NOT EXISTS` / `DROP ... IF EXISTS`).

## Run order (this app: ESG department)

| # | File | What it does |
|---|------|--------------|
| 1 | `000_create_users.sql` | `users` profile table (one row per login) |
| 2 | `001_create_grievances.sql` | `grievances` table |
| 3 | `002_alter_grievances.sql` | Extra complaint fields |
| 4 | `003_analytics_rpc.sql` | Dashboard functions (`get_admin_metrics`, `get_admin_trends`, ...) |
| 5 | `004_alter_users_roles.sql` | Role rule, `is_active` |
| 6 | `005_audit_logs.sql` | `audit_logs` table |
| 7 | `006_super_admin_schema.sql` | Super admin support |
| 8 | `007_feedback.sql` | `feedback` table |
| 9 | `008_attachments.sql` | `attachments` storage bucket and its access rules |
| 10 | `009_chat_history.sql` | `chat_sessions`, `chat_messages` |
| 11 | `migration_grievance_states.sql` | `grievance_states` (needs `chat_sessions` from step 10) |
| 12 | `010_tier_sla_notifications.sql` | Tiers, SLA fields, `notifications`, final role rule |
| 13 | `011_add_admin_tier.sql` | `admin_tier` (L1 / L2 / L3 / HEAD) |
| 14 | `012_add_user_profile_fields.sql` | Profile fields |
| 15 | `013_add_rag_recommendations.sql` | AI policy suggestions on complaints |
| 16 | `014_add_resolution_fields.sql` | Resolution fields |
| 17 | `015_enable_rls.sql` | Row-level security for `users`, `grievances` and others |
| 18 | `016_performance_indexes.sql` | Indexes |
| 19 | `017_phone_verification.sql` | Phone verification columns |
| 20 | `018_projects_table.sql` | `projects` catalogue (project picker on the external form) |
| 21 | `019_fix_audit_logs.sql` | Audit log fixes |

There is no `020` in this app: `020_resolution_sla.sql` belongs to the all-departments app (`purva-main`).

## Row-level security for backend-only tables

These tables are used only by the backend (which connects with the service role key,
so these rules do not limit it). Turn on row-level security with **no** public policies,
so the public anon key in the website cannot read or change them:

```sql
ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback      ENABLE ROW LEVEL SECURITY;
```

(This is already applied on the current project; it is needed on a new one.)

Check the result at any time (read-only):

```sql
select c.relname as table_name, c.relrowsecurity as rls_on,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
```

Every table should show `rls_on = true`.

## Sharing one Supabase project with the all-departments app

The all-departments app (`purva-main`) can use the same Supabase project. In that case run
**both** apps' extra files: this app's `018_projects_table.sql` and purva-main's
`020_resolution_sla.sql` (which also needs `ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;`).
The other files are the same in both repos.

## Settings outside SQL

- **Storage:** the `attachments` bucket is created by `008_attachments.sql`. Check it
  exists under Storage after running it.
- **Auth → URL Configuration:** set **Site URL** to the website address, and add it
  (with `/**`) to **Redirect URLs**. Password-reset and invite emails link there.
- **Auth → Providers → Email:** email sign-up must be on.
- **First admin accounts:** with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in
  `backend/.env`, run `python backend/bootstrap_super_admin.py` once. It creates the
  super admin from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`, then one staff login per
  department and tier (L1, L2, L3, HEAD) using `SEED_ADMIN_PASSWORD`. Remove those three
  values afterwards and have each person change their password.
