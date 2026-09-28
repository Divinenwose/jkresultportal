-- One-off: unlink every student from their parent account.
-- Run manually in the Supabase SQL editor (not a migration, so it won't re-run on db push).
-- Preview first:
--   SELECT count(*) FROM public.students WHERE parent_user_id IS NOT NULL;

UPDATE public.students
   SET parent_user_id = NULL,
       updated_at = now()
 WHERE parent_user_id IS NOT NULL;
