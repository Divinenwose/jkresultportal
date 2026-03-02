CREATE POLICY "Parent can browse unclaimed students"
ON public.students
FOR SELECT
TO authenticated
USING (
  parent_user_id IS NULL AND has_role(auth.uid(), 'parent'::app_role)
);