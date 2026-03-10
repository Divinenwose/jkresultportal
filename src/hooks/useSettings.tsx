import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SchoolSettings {
  active_term: string;
  active_session: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<SchoolSettings>({
    active_term: "First Term",
    active_session: "2025/2026",
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("settings" as any)
      .select("active_term, active_session")
      .eq("id", "school_settings")
      .single();
    if (data) {
      setSettings({ active_term: (data as any).active_term, active_session: (data as any).active_session });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (updates: Partial<SchoolSettings>) => {
    const { error } = await supabase
      .from("settings" as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", "school_settings");
    if (!error) {
      setSettings(prev => ({ ...prev, ...updates }));
    }
    return { error };
  };

  return { settings, loading, updateSettings, refetch: fetchSettings };
}
