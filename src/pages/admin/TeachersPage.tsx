import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw } from "lucide-react";


export default function TeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [assignForm, setAssignForm] = useState({ subject_id: '', level: 'Junior' });
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState<string | null>(null);

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
    setAssignForm({ subject_id: '', level: 'Junior' });
    setAssignOpen(true);
  };

  const JUNIOR_CLASSES = ['JSS1', 'JSS2', 'JSS3'];
  const SENIOR_CLASSES = ['SS1', 'SS2', 'SS3'];

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.subject_id) { toast.error("Please select a subject"); return; }
    setAssigning(true);

    const classesForLevel = assignForm.level === 'Junior' ? JUNIOR_CLASSES : SENIOR_CLASSES;

    // Find the subject name to create assignments for all classes in the level
    const selectedSubject = subjects.find(s => s.id === assignForm.subject_id);
    if (!selectedSubject) { toast.error("Subject not found"); setAssigning(false); return; }

    // Get all subject IDs with this name across the level's classes
    const subjectIds = subjects
      .filter(s => s.name === selectedSubject.name && classesForLevel.includes(s.class))
      .map(s => ({ subject_id: s.id, class: s.class }));

    // Filter out already assigned
    const toInsert = subjectIds.filter(
      s => !selectedTeacher.assignments.find((a: any) => a.subject_id === s.subject_id && a.class === s.class)
    );

    if (toInsert.length === 0) { toast.error("Already assigned to all classes"); setAssigning(false); return; }

    const rows = toInsert.map(s => ({
      teacher_user_id: selectedTeacher.user_id,
      subject_id: s.subject_id,
      class: s.class as any,
    }));

    const { error } = await supabase.from('teacher_assignments').insert(rows);
    setAssigning(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Subject assigned to ${classesForLevel.join(', ')}!`);
    setAssignOpen(false);
    fetchAll();
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const { error } = await supabase.from('teacher_assignments').delete().eq('id', assignmentId);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment removed");
    fetchAll();
  };

  // Reassign: clear all assignments then open assign dialog
  const handleReassign = async (teacher: any) => {
    setReassigning(teacher.user_id);
    if (teacher.assignments.length > 0) {
      const ids = teacher.assignments.map((a: any) => a.id);
      for (const id of ids) {
        await supabase.from('teacher_assignments').delete().eq('id', id);
      }
    }
    setReassigning(null);
    toast.success("Previous assignments cleared");
    await fetchAll();
    // Re-fetch teacher with cleared assignments then open dialog
    setSelectedTeacher({ ...teacher, assignments: [] });
    setAssignForm({ subject_id: '', level: 'Junior' });
    setAssignOpen(true);
  };

  // Delete teacher role (removes from user_roles, doesn't delete user account)
  const handleDeleteTeacher = async (teacher: any) => {
    setDeleting(teacher.user_id);
    // Remove all assignments first
    if (teacher.assignments.length > 0) {
      for (const a of teacher.assignments) {
        await supabase.from('teacher_assignments').delete().eq('id', a.id);
      }
    }
    // Remove teacher role
    const { error } = await supabase.from('user_roles').delete().eq('user_id', teacher.user_id).eq('role', 'teacher');
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${teacher.full_name} removed as teacher`);
    fetchAll();
  };

  // Show unique subject names for the selected level
  const levelClasses = assignForm.level === 'Junior' ? ['JSS1', 'JSS2', 'JSS3'] : ['SS1', 'SS2', 'SS3'];
  const filteredSubjects = subjects.filter(s => levelClasses.includes(s.class));
  const uniqueSubjects = filteredSubjects.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);

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
                <TableHead className="w-36 text-right pr-4">Actions</TableHead>
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
                          <button onClick={() => handleRemoveAssignment(a.id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                      {t.assignments.length === 0 && <span className="text-muted-foreground text-xs">None assigned</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Add subject assignment */}
                      <Button size="sm" variant="outline" onClick={() => openAssign(t)} title="Add assignment">
                        <Plus className="h-3 w-3 mr-1" /> Assign
                      </Button>

                      {/* Reassign (clear all + open assign) */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Reassign teacher" disabled={reassigning === t.user_id}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reassign Teacher</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove all current subject assignments for <strong>{t.full_name}</strong> and open the assignment form so you can assign new subjects. Continue?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleReassign(t)}>Reassign</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Delete teacher */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Remove teacher" disabled={deleting === t.user_id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Teacher</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove <strong>{t.full_name}</strong> as a teacher? All their subject assignments will also be removed. Their account will still exist.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteTeacher(t)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Level</Label>
                <Select value={assignForm.level} onValueChange={v => setAssignForm({ ...assignForm, level: v, subject_id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Junior">Junior (JSS1-3)</SelectItem>
                    <SelectItem value="Senior">Senior (SS1-3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={assignForm.subject_id} onValueChange={v => setAssignForm({ ...assignForm, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {uniqueSubjects.length === 0
                      ? <SelectItem value="_none" disabled>No subjects for {assignForm.level}</SelectItem>
                      : uniqueSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={assigning}>{assigning ? "Assigning..." : "Assign Subject"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
