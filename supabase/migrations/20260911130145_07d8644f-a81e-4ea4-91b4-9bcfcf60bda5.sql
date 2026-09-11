ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS graduated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS graduated_session text,
  ADD COLUMN IF NOT EXISTS promoted_session text;

CREATE OR REPLACE FUNCTION public.promote_students(_new_session text)
RETURNS TABLE(promoted integer, graduated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p integer := 0;
  g integer := 0;
  old_session text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can promote students';
  END IF;

  IF _new_session IS NULL OR _new_session = '' THEN
    RAISE EXCEPTION 'A target session is required';
  END IF;

  SELECT s.active_session INTO old_session FROM public.settings s WHERE s.id = 'school_settings';

  WITH grad AS (
    UPDATE public.students
       SET graduated = true,
           graduated_session = COALESCE(old_session, _new_session),
           promoted_session = _new_session,
           updated_at = now()
     WHERE class = 'SS3'
       AND graduated = false
       AND COALESCE(promoted_session, '') IS DISTINCT FROM _new_session
    RETURNING 1
  )
  SELECT count(*) INTO g FROM grad;

  WITH prom AS (
    UPDATE public.students
       SET class = (CASE class
                      WHEN 'JSS1' THEN 'JSS2'
                      WHEN 'JSS2' THEN 'JSS3'
                      WHEN 'JSS3' THEN 'SS1'
                      WHEN 'SS1' THEN 'SS2'
                      WHEN 'SS2' THEN 'SS3'
                    END)::school_class,
           promoted_session = _new_session,
           updated_at = now()
     WHERE graduated = false
       AND class <> 'SS3'
       AND COALESCE(promoted_session, '') IS DISTINCT FROM _new_session
    RETURNING 1
  )
  SELECT count(*) INTO p FROM prom;

  RETURN QUERY SELECT p, g;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_students(text) TO authenticated;