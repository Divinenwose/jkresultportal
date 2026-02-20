import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Users, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeacherDashboard() {
  const { user } = useAuth();
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

  const uniqueClasses = [...new Set(assignments.map(a => a.class))];

  return (
    <DashboardLayout title="Teacher Dashboard">
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
                  <p className="text-xs text-muted-foreground mt-1">Class: {a.subjects?.class}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
