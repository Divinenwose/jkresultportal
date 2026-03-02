-- Allow parents to claim a student (set parent_user_id to their own auth.uid)
-- Only allowed if the student has no parent yet (parent_user_id IS NULL)
CREATE POLICY "Parent can claim unclaimed student"
  ON public.students
  FOR UPDATE
  USING (parent_user_id IS NULL)
  WITH CHECK (parent_user_id = auth.uid());

-- Allow parent to unclaim (set parent_user_id back to NULL) only for their own child
CREATE POLICY "Parent can unclaim own child"
  ON public.students
  FOR UPDATE
  USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id IS NULL OR parent_user_id = auth.uid());
