import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { CLASSES } from "@/lib/constants";

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', gender: 'Male', date_of_birth: '', class: 'JSS1' });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', gender: 'Male', date_of_birth: '', class: 'JSS1' });
  const [editLoading, setEditLoading] = useState(false);

  const fetchStudents = async () => {
    let query = supabase.from('students').select('*').order('full_name');
    if (filterClass && filterClass !== 'all') query = query.eq('class', filterClass as any);
    const { data } = await query;
    setStudents(data || []);
  };

  useEffect(() => { fetchStudents(); }, [filterClass]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error("Name is required"); return; }
    setLoading(true);

    const { data: spinData } = await supabase.rpc('generate_spin');
    const spin = spinData || `JKIC/${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`;

    const { error } = await supabase.from('students').insert({
      full_name: form.full_name.trim(),
      gender: form.gender,
      date_of_birth: form.date_of_birth || null,
      class: form.class as any,
      spin,
    });

    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Student added successfully!");
    setOpen(false);
    setForm({ full_name: '', gender: 'Male', date_of_birth: '', class: 'JSS1' });
    fetchStudents();
  };

  const openEdit = (student: any) => {
    setEditId(student.id);
    setEditForm({
      full_name: student.full_name,
      gender: student.gender,
      date_of_birth: student.date_of_birth || '',
      class: student.class,
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.full_name.trim()) { toast.error("Name is required"); return; }
    setEditLoading(true);

    const { error } = await supabase.from('students').update({
      full_name: editForm.full_name.trim(),
      gender: editForm.gender,
      date_of_birth: editForm.date_of_birth || null,
      class: editForm.class as any,
    }).eq('id', editId!);

    setEditLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Student updated successfully!");
    setEditOpen(false);
    fetchStudents();
  };

  const handleDelete = async (studentId: string) => {
    setDeleting(studentId);
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Student deleted successfully");
    fetchStudents();
  };

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Students">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Student</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add New Student</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={v => setForm({...form, gender: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Class</Label>
                  <Select value={form.class} onValueChange={v => setForm({...form, class: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Adding..." : "Add Student"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Edit Student</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div><Label>Full Name</Label><Input value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={v => setEditForm({...editForm, gender: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class</Label>
                <Select value={editForm.class} onValueChange={v => setEditForm({...editForm, class: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Date of Birth</Label><Input type="date" value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} /></div>
            <Button type="submit" className="w-full" disabled={editLoading}>{editLoading ? "Saving..." : "Save Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No students found</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.gender}</TableCell>
                  <TableCell><span className="px-2 py-0.5 bg-secondary rounded text-xs font-medium">{s.class}</span></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.date_of_birth || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={deleting === s.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Student</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete <strong>{s.full_name}</strong>? This will also remove all their scores and reports. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(s.id)}
                            >
                              Delete
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
    </DashboardLayout>
  );
}
