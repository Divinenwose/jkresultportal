import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Users, BookOpen, UserPlus, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASSES } from "@/lib/constants";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, subjects: 0, pendingReports: 0 });
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchStats = async () => {
      const [studentsRes, teachersRes, subjectsRes, reportsRes] = await Promise.all([
        supabase.from('students').select('id, class'),
        supabase.from('user_roles').select('id').eq('role', 'teacher'),
        supabase.from('subjects').select('id'),
        supabase.from('reports').select('id').eq('approved', false),
      ]);

      const students = studentsRes.data || [];
      setStats({
        students: students.length,
        teachers: teachersRes.data?.length || 0,
        subjects: subjectsRes.data?.length || 0,
        pendingReports: reportsRes.data?.length || 0,
      });

      const counts: Record<string, number> = {};
      for (const cls of CLASSES) counts[cls] = 0;
      students.forEach((s: any) => { if (counts[s.class] !== undefined) counts[s.class]++; });
      setClassCounts(counts);
    };
    fetchStats();
  }, []);

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Students" value={stats.students} icon={<Users className="h-5 w-5" />} variant="primary" />
        <StatCard title="Total Teachers" value={stats.teachers} icon={<UserPlus className="h-5 w-5" />} variant="accent" />
        <StatCard title="Subjects" value={stats.subjects} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard title="Pending Approvals" value={stats.pendingReports} icon={<ClipboardCheck className="h-5 w-5" />} variant="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Class Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CLASSES.map((cls) => (
              <div key={cls} className="text-center p-3 rounded-lg bg-secondary">
                <p className="text-sm font-bold text-secondary-foreground">{cls}</p>
                <p className="text-2xl font-display font-bold text-primary mt-1">{classCounts[cls] || 0}</p>
                <p className="text-[10px] text-muted-foreground">students</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
