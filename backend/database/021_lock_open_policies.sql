-- 021_lock_open_policies.sql
-- Closes policies that let anyone with the public anon key (it is built into the
-- website) read or change data. Run after all earlier files.
--
-- notifications and grievance_states are used only by the backend, which connects
-- with the service role key; that key is not limited by row-level security, so these
-- tables need NO policies. The website never reads them directly.
--
-- Attachment uploads are limited to logged-in users (the site only uploads while
-- logged in). Reading attachments stays public because the site shows them through
-- public links; anyone who has a file's link can open it.
--
-- Safe to re-run.

-- notifications: was "read / insert / update anything" for everyone
DROP POLICY IF EXISTS "Users can read own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Service can insert notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- grievance_states: was "read / write / delete anything" for everyone
DROP POLICY IF EXISTS "Allow all for service role" ON public.grievance_states;
ALTER TABLE public.grievance_states ENABLE ROW LEVEL SECURITY;

-- attachments bucket: uploads only when logged in
DROP POLICY IF EXISTS "Public Upload to Attachments"     ON storage.objects;
DROP POLICY IF EXISTS "Logged-in upload to attachments" ON storage.objects;
CREATE POLICY "Logged-in upload to attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');
