-- Allow admins to delete score rows.
CREATE POLICY "Admin deletes scores" ON public.scores
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

