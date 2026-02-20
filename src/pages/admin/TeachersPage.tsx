import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
      if (!roles?.length) return;
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);

      // Get assignments
      const { data: assignments } = await supabase.from('teacher_assignments').select('*, subjects(name, class)').in('teacher_user_id', userIds);

      const teacherMap = (profiles || []).map(p => ({
        ...p,
        assignments: (assignments || []).filter((a: any) => a.teacher_user_id === p.user_id)
      }));
      setTeachers(teacherMap);
    };
    fetch();
  }, []);

  return (
    <DashboardLayout title="Teachers">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Assigned Subjects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No teachers found</TableCell></TableRow>
              ) : teachers.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.assignments.map((a: any) => (
                        <span key={a.id} className="px-2 py-0.5 bg-secondary rounded text-[10px] font-medium">
                          {a.subjects?.name} ({a.subjects?.class})
                        </span>
                      ))}
                      {t.assignments.length === 0 && <span className="text-muted-foreground text-xs">None assigned</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
