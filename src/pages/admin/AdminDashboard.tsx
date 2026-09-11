import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Users, BookOpen, UserPlus, ClipboardCheck, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CLASSES } from "@/lib/constants";

interface SubjectRecord {
  name: string;
  classes: string[];
  teacherName: string | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, subjects: 0, pendingReports: 0 });
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [assignedSubjects, setAssignedSubjects] = useState<SubjectRecord[]>([]);
  const [unassignedSubjects, setUnassignedSubjects] = useState<SubjectRecord[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [studentsRes, teachersRes, subjectsRes, reportsRes] = await Promise.all([
        supabase.from('students').select('id, class').eq('graduated', false),
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

    const fetchSubjectAssignments = async () => {
      // Get all subjects
      const { data: subjects } = await supabase.from('subjects').select('id, name, class');
      if (!subjects) return;

      // Get all teacher assignments with teacher profiles
      const { data: assignments } = await supabase.from('teacher_assignments').select('subject_id, teacher_user_id, class');
      const teacherIds = [...new Set((assignments || []).map(a => a.teacher_user_id))];
      
      let profilesMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', teacherIds);
        (profiles || []).forEach(p => { profilesMap[p.user_id] = p.full_name; });
      }

      // Group subjects by name and determine assignment status
      const subjectMap: Record<string, { classes: string[]; teacherIds: Set<string> }> = {};
      subjects.forEach(s => {
        if (!subjectMap[s.name]) subjectMap[s.name] = { classes: [], teacherIds: new Set() };
        subjectMap[s.name].classes.push(s.class);
        
        const subjectAssignments = (assignments || []).filter(a => a.subject_id === s.id);
        subjectAssignments.forEach(a => subjectMap[s.name].teacherIds.add(a.teacher_user_id));
      });

      const assigned: SubjectRecord[] = [];
      const unassigned: SubjectRecord[] = [];

      Object.entries(subjectMap).forEach(([name, data]) => {
        const uniqueClasses = [...new Set(data.classes)].sort();
        const teacherNames = [...data.teacherIds].map(id => profilesMap[id] || 'Unknown').join(', ');
        
        const record: SubjectRecord = {
          name,
          classes: uniqueClasses,
          teacherName: teacherNames || null,
        };

        if (data.teacherIds.size > 0) {
          assigned.push(record);
        } else {
          unassigned.push(record);
        }
      });

      setAssignedSubjects(assigned.sort((a, b) => a.name.localeCompare(b.name)));
      setUnassignedSubjects(unassigned.sort((a, b) => a.name.localeCompare(b.name)));
    };

    fetchStats();
    fetchSubjectAssignments();
  }, []);

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Students" value={stats.students} icon={<Users className="h-5 w-5" />} variant="primary" />
        <StatCard title="Total Teachers" value={stats.teachers} icon={<UserPlus className="h-5 w-5" />} variant="accent" />
        <StatCard title="Subjects" value={stats.subjects} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard title="Pending Approvals" value={stats.pendingReports} icon={<ClipboardCheck className="h-5 w-5" />} variant="success" />
      </div>

      <Card className="mb-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Subject Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="assigned">
            <TabsList className="mb-4">
              <TabsTrigger value="assigned" className="gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Assigned ({assignedSubjects.length})
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Unassigned ({unassignedSubjects.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assigned">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Assigned Teacher(s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedSubjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No assigned subjects yet.</TableCell>
                    </TableRow>
                  ) : assignedSubjects.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.classes.map(c => (
                            <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.teacherName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="unassigned">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedSubjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">All subjects are assigned!</TableCell>
                    </TableRow>
                  ) : unassignedSubjects.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.classes.map(c => (
                            <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                          No teacher assigned
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
