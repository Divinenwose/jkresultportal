import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";
import { BookOpen, Users, ClipboardCheck, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select('*, subjects(name, class)')
        .eq('teacher_user_id', user.id);
      setAssignments(data || []);
    };
    fetch();
  }, [user]);

  const uniqueClasses = [...new Set(assignments.map(a => a.subjects?.class).filter(Boolean))];

  return (
    <DashboardLayout title="Teacher Dashboard">
      {/* Active Term Banner */}
      <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20">
        <CalendarDays className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-primary">
          Active Term: <strong>{settings.active_term}</strong>
        </span>
        <span className="text-muted-foreground text-sm">•</span>
        <span className="text-sm text-muted-foreground">Session: <strong className="text-foreground">{settings.active_session}</strong></span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Assigned Subjects" value={assignments.length} icon={<BookOpen className="h-5 w-5" />} variant="primary" />
        <StatCard title="Classes" value={uniqueClasses.length} icon={<Users className="h-5 w-5" />} variant="accent" />
        <StatCard title="Pending" value={0} icon={<ClipboardCheck className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base font-display">My Assignments</CardTitle></CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No subjects assigned yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {assignments.map(a => (
                <div key={a.id} className="p-4 rounded-lg bg-secondary">
                  <p className="font-semibold text-sm">{a.subjects?.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">Class: {a.subjects?.class}</p>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{settings.active_term}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
