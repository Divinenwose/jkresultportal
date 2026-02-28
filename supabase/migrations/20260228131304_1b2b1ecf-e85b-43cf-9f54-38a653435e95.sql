
-- Update handle_new_user to also assign role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  -- Assign role from metadata if provided
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    BEGIN
      user_role := (NEW.raw_user_meta_data->>'role')::app_role;
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, user_role);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Skip invalid roles
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
