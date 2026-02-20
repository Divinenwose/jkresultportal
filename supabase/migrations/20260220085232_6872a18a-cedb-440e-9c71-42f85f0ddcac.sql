
-- Fix search_path for calculate_grade
CREATE OR REPLACE FUNCTION public.calculate_grade(score NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF score >= 75 THEN RETURN 'A1';
  ELSIF score >= 70 THEN RETURN 'B2';
  ELSIF score >= 65 THEN RETURN 'B3';
  ELSIF score >= 60 THEN RETURN 'C4';
  ELSIF score >= 55 THEN RETURN 'C5';
  ELSIF score >= 50 THEN RETURN 'C6';
  ELSIF score >= 45 THEN RETURN 'D7';
  ELSIF score >= 40 THEN RETURN 'E8';
  ELSE RETURN 'F9';
  END IF;
END;
$$;

-- Fix search_path for generate_spin
CREATE OR REPLACE FUNCTION public.generate_spin()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_spin TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_spin := 'JKIC/' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.students WHERE spin = new_spin) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_spin;
END;
$$;
