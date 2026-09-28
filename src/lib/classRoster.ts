import { supabase } from "@/integrations/supabase/client";

/**
 * Students in `cls`. Saved classes always match the active session
 * (the Reports page moves students when the session is switched),
 * so no display shifting is needed.
 */
export async function fetchClassRoster(cls: string, _session?: string) {
  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("class", cls as any)
    .eq("graduated", false)
    .order("full_name");
  return data || [];
}
