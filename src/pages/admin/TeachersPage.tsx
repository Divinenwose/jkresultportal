import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { CLASSES } from "@/lib/constants";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [assignForm, setAssignForm] = useState({ subject_id: '', class: 'JSS1' });
  const [assigning, setAssigning] = useState(false);

  const fetchAll = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
    if (!roles?.length) { setTeachers([]); return; }
    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
    const { data: assignments } = await supabase.from('teacher_assignments').select('*, subjects(name, class)').in('teacher_user_id', userIds);
    const teacherMap = (profiles || []).map(p => ({
      ...p,
      assignments: (assignments || []).filter((a: any) => a.teacher_user_id === p.user_id)
    }));
    setTeachers(teacherMap);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('class').order('name');
    setSubjects(data || []);
  };

  useEffect(() => { fetchAll(); fetchSubjects(); }, []);

  const openAssign = (teacher: any) => {
    setSelectedTeacher(teacher);
    setAssignForm({ subject_id: '', class: 'JSS1' });
    setAssignOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.subject_id) { toast.error("Please select a subject"); return; }
    setAssigning(true);

    // Check if already assigned
    const existing = selectedTeacher.assignments.find(
      (a: any) => a.subject_id === assignForm.subject_id && a.class === assignForm.class
    );
    if (existing) { toast.error("Already assigned"); setAssigning(false); return; }

    const { error } = await supabase.from('teacher_assignments').insert({
      teacher_user_id: selectedTeacher.user_id,
      subject_id: assignForm.subject_id,
      class: assignForm.class as any,
    });
    setAssigning(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Subject assigned!");
    setAssignOpen(false);
    fetchAll();
  };

  const handleRemove = async (assignmentId: string) => {
    const { error } = await supabase.from('teacher_assignments').delete().eq('id', assignmentId);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment removed");
    fetchAll();
  };

  const filteredSubjects = subjects.filter(s => s.class === assignForm.class);

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
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No teachers found. Teachers must sign up with the "Subject Teacher" role.</TableCell></TableRow>
              ) : teachers.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.assignments.map((a: any) => (
                        <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary rounded text-[10px] font-medium">
                          {a.subjects?.name} ({a.class})
                          <button onClick={() => handleRemove(a.id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                      {t.assignments.length === 0 && <span className="text-muted-foreground text-xs">None assigned</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openAssign(t)}>
                      <Plus className="h-3 w-3 mr-1" /> Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Assign Subject to {selectedTeacher?.full_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <Label>Class</Label>
              <Select value={assignForm.class} onValueChange={v => setAssignForm({ ...assignForm, class: v, subject_id: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={assignForm.subject_id} onValueChange={v => setAssignForm({ ...assignForm, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {filteredSubjects.length === 0
                    ? <SelectItem value="_none" disabled>No subjects for {assignForm.class}</SelectItem>
                    : filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={assigning}>{assigning ? "Assigning..." : "Assign Subject"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
