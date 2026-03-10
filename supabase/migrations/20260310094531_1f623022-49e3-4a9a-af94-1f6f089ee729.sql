CREATE TABLE public.settings (
  id TEXT PRIMARY KEY DEFAULT 'school_settings',
  active_term TEXT NOT NULL DEFAULT 'First Term',
  active_session TEXT NOT NULL DEFAULT '2025/2026',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
ON public.settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin can update settings"
ON public.settings FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can insert settings"
ON public.settings FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.settings (id, active_term, active_session)
VALUES ('school_settings', 'First Term', '2025/2026')
ON CONFLICT (id) DO NOTHING;