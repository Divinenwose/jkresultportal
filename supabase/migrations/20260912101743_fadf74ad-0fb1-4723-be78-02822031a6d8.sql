UPDATE public.students
SET class = CASE
      WHEN graduated THEN 'SS3'
      WHEN class = 'JSS2' THEN 'JSS1'
      WHEN class = 'JSS3' THEN 'JSS2'
      WHEN class = 'SS1' THEN 'JSS3'
      WHEN class = 'SS2' THEN 'SS1'
      WHEN class = 'SS3' THEN 'SS2'
      ELSE class
    END::school_class,
    graduated = false,
    graduated_session = NULL,
    promoted_session = NULL,
    updated_at = now();