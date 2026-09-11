REVOKE EXECUTE ON FUNCTION public.promote_students(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_students(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_students(text) TO authenticated;