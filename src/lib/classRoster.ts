import { supabase } from "@/integrations/supabase/client";
import { CLASSES } from "@/lib/constants";

const yearOf = (s: string) => parseInt(s?.split("/")[0] || "0", 10);

/** Newest session students have been promoted into (e.g. "2026/2027"), or "". */
export async function getLatestPromotedSession(): Promise<string> {
  const { data } = await supabase
    .from("students")
    .select("promoted_session")
    .not("promoted_session", "is", null);
  const list = Array.from(
    new Set((data || []).map((r: any) => r.promoted_session).filter(Boolean))
  ) as string[];
  return list.sort().slice(-1)[0] || "";
}

/**
 * Students who were in `cls` during `session`.
 * For the current session this is just the students now in `cls`.
 * For a previous session every student has since moved up, so we look one
 * class forward per session that has passed (JSS1 in 2025/2026 = JSS2 now).
 * Students who have since graduated are matched by graduated_session.
 */
export async function fetchClassRoster(cls: string, session: string) {
  const latest = await getLatestPromotedSession();
  const steps = latest ? Math.max(0, yearOf(latest) - yearOf(session)) : 0;
  const idx = CLASSES.indexOf(cls as any);
  if (idx < 0) return [];

  let query = supabase.from("students").select("*").order("full_name");

  if (steps === 0) {
    query = query.eq("class", cls as any).eq("graduated", false);
  } else {
    const target = idx + steps;
    if (target < CLASSES.length) {
      query = query.eq("class", CLASSES[target] as any).eq("graduated", false);
    } else if (target === CLASSES.length) {
      const y = yearOf(session) + (CLASSES.length - 1 - idx);
      query = query.eq("graduated", true).eq("graduated_session", `${y}/${y + 1}`);
    } else {
      return [];
    }
  }

  const { data } = await query;
  return data || [];
}
