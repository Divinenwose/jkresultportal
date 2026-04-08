import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const JUNIOR_CLASSES = ['JSS1', 'JSS2', 'JSS3'] as const;
const SENIOR_CLASSES = ['SS1', 'SS2', 'SS3'] as const;

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', level: 'Junior' as 'Junior' | 'Senior' });
  const [loading, setLoading] = useState(false);

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('class').order('name');
    setSubjects(data || []);
  };

  useEffect(() => { fetchSubjects(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Subject name is required"); return; }
    setLoading(true);

    const classes = form.level === 'Junior' ? JUNIOR_CLASSES : SENIOR_CLASSES;
    const rows = classes.map(c => ({ name: form.name.trim(), class: c as any }));

    const { error } = await supabase.from('subjects').insert(rows);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Subject added for all ${form.level} classes!`);
    setOpen(false);
    setForm({ name: '', level: 'Junior' });
    fetchSubjects();
  };

  // Group subjects by name for display
  const grouped = subjects.reduce((acc: Record<string, any[]>, s: any) => {
    if (!acc[s.name]) acc[s.name] = [];
    acc[s.name].push(s);
    return acc;
  }, {} as Record<string, any[]>);
  

  return (
    <DashboardLayout title="Subjects">
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Subject</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add Subject</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><Label>Subject Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div>
                <Label>Level</Label>
                <Select value={form.level} onValueChange={(v: 'Junior' | 'Senior') => setForm({...form, level: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Junior">Junior (JSS1–JSS3)</SelectItem>
                    <SelectItem value="Senior">Senior (SS1–SS3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Adding..." : "Add Subject"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Classes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(grouped).length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No subjects yet</TableCell></TableRow>
              ) : Object.entries(grouped).map(([name, items]) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(items as any[]).map((s: any) => (
                        <span key={s.id} className="px-2 py-0.5 bg-secondary rounded text-xs font-medium">{s.class}</span>
                      ))}
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
