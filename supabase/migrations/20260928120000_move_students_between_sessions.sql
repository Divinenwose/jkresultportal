-- Reversible session-based class movement.
-- Each student keeps a fixed anchor (enrolled_class @ enrolled_session); their saved
-- class for any session is derived from it, so moving back and forth never drifts.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS enrolled_class public.school_class,
  ADD COLUMN IF NOT EXISTS enrolled_session text;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS class_session text;

-- Backfill: saved classes currently represent the newest promoted session (or the active one).
DO $$
DECLARE r text;
BEGIN
  SELECT max(promoted_session) INTO r FROM public.students WHERE promoted_session IS NOT NULL;
  IF r IS NULL THEN
    SELECT active_session INTO r FROM public.settings WHERE id = 'school_settings';
  END IF;
  r := COALESCE(r, '2025/2026');

  UPDATE public.settings SET class_session = r WHERE id = 'school_settings';

  UPDATE public.students
     SET enrolled_class = 'SS3',
         enrolled_session = COALESCE(graduated_session, r)
   WHERE graduated = true AND enrolled_class IS NULL;

  UPDATE public.students
     SET enrolled_class = class,
         enrolled_session = r
   WHERE graduated = false AND enrolled_class IS NULL;
END $$;

-- Re-anchor when a class is edited by hand or a student is added (not when the mover runs).
CREATE OR REPLACE FUNCTION public.students_anchor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cs text;
BEGIN
  IF current_setting('app.moving_students', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT'
     OR NEW.class IS DISTINCT FROM OLD.class
     OR NEW.graduated IS DISTINCT FROM OLD.graduated THEN
    SELECT COALESCE(s.class_session, s.active_session) INTO cs
      FROM public.settings s WHERE s.id = 'school_settings';
    IF NEW.graduated THEN
      NEW.enrolled_class := 'SS3';
      NEW.enrolled_session := COALESCE(NEW.graduated_session, cs);
    ELSE
      NEW.enrolled_class := NEW.class;
      NEW.enrolled_session := cs;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_anchor_trg ON public.students;
CREATE TRIGGER students_anchor_trg
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_anchor();

CREATE OR REPLACE FUNCTION public.move_students_to_session(_target_session text)
RETURNS TABLE(moved_count integer, graduated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yt integer;
  m integer := 0;
  g integer := 0;
  classes text[] := ARRAY['JSS1','JSS2','JSS3','SS1','SS2','SS3'];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can move students between sessions';
  END IF;
  IF _target_session IS NULL OR _target_session !~ '^\d{4}/\d{4}$' THEN
    RAISE EXCEPTION 'Invalid session (expected format 2025/2026)';
  END IF;

  yt := split_part(_target_session, '/', 1)::integer;
  PERFORM set_config('app.moving_students', 'on', true);

  WITH calc AS (
    SELECT st.id,
           (array_position(classes, st.enrolled_class::text) - 1)
             + (yt - split_part(st.enrolled_session, '/', 1)::integer) AS idx,
           split_part(st.enrolled_session, '/', 1)::integer
             + (5 - (array_position(classes, st.enrolled_class::text) - 1)) AS grad_year
      FROM public.students st
     WHERE st.enrolled_class IS NOT NULL AND st.enrolled_session IS NOT NULL
  ), upd AS (
    UPDATE public.students s
       SET class = classes[LEAST(GREATEST(c.idx, 0), 5) + 1]::school_class,
           graduated = (c.idx > 5),
           graduated_session = CASE WHEN c.idx > 5
                                    THEN c.grad_year || '/' || (c.grad_year + 1) END,
           promoted_session = NULL,
           updated_at = now()
      FROM calc c
     WHERE s.id = c.id
       AND (s.class::text IS DISTINCT FROM classes[LEAST(GREATEST(c.idx, 0), 5) + 1]
            OR s.graduated IS DISTINCT FROM (c.idx > 5))
    RETURNING s.graduated AS is_grad
  )
  SELECT count(*)::integer, (count(*) FILTER (WHERE is_grad))::integer INTO m, g FROM upd;

  UPDATE public.settings SET class_session = _target_session WHERE id = 'school_settings';

  RETURN QUERY SELECT m, g;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_students_to_session(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_students_to_session(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.move_students_to_session(text) TO authenticated;

-- Replaced by move_students_to_session (forward-only, one-shot).
DROP FUNCTION IF EXISTS public.promote_students(text);
