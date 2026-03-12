import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { calculateGrade } from "@/lib/constants";
import { useSettings } from "@/hooks/useSettings";
import { Save } from "lucide-react";

export default function ScoreEntryPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [scoreMap, setScoreMap] = useState<Record<string, any>>({});
  // Maps: studentId -> { term1Total, term2Total }
  const [prevTermScores, setPrevTermScores] = useState<Record<string, { term1?: number; term2?: number }>>({});
  const [saving, setSaving] = useState(false);

  const activeTerm = settings.active_term;
  const isSecondTerm = activeTerm === "Second Term";
  const isThirdTerm = activeTerm === "Third Term";
  const showCumulative = isSecondTerm || isThirdTerm;

  useEffect(() => {
    if (!user) return;
    supabase.from('teacher_assignments').select('*, subjects(id, name, class)')
      .eq('teacher_user_id', user.id)
      .then(({ data }) => setAssignments(data || []));
  }, [user]);

  useEffect(() => {
    if (!selectedAssignment) return;
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    const fetch = async () => {
      const { data: studs } = await supabase.from('students')
        .select('*')
        .eq('class', assignment.class)
        .order('full_name');
      setStudents(studs || []);

      if (studs?.length) {
        const studentIds = studs.map(s => s.id);

        // Fetch current term scores
        const { data: existingScores } = await supabase.from('scores')
          .select('*')
          .eq('subject_id', assignment.subjects.id)
          .eq('term', settings.active_term as any)
          .eq('session', settings.active_session)
          .in('student_id', studentIds);

        const map: Record<string, any> = {};
        (existingScores || []).forEach(s => { map[s.student_id] = s; });
        setScoreMap(map);

        // Fetch previous term scores for cumulative display
        if (isSecondTerm || isThirdTerm) {
          const prevMap: Record<string, { term1?: number; term2?: number }> = {};

          const { data: t1Scores } = await supabase.from('scores')
            .select('student_id, total')
            .eq('subject_id', assignment.subjects.id)
            .eq('term', 'First Term' as any)
            .eq('session', settings.active_session)
            .in('student_id', studentIds);

          (t1Scores || []).forEach(s => {
            prevMap[s.student_id] = { ...prevMap[s.student_id], term1: Number(s.total) || 0 };
          });

          if (isThirdTerm) {
            const { data: t2Scores } = await supabase.from('scores')
              .select('student_id, total')
              .eq('subject_id', assignment.subjects.id)
              .eq('term', 'Second Term' as any)
              .eq('session', settings.active_session)
              .in('student_id', studentIds);

            (t2Scores || []).forEach(s => {
              prevMap[s.student_id] = { ...prevMap[s.student_id], term2: Number(s.total) || 0 };
            });
          }

          setPrevTermScores(prevMap);
        } else {
          setPrevTermScores({});
        }
      }
    };
    fetch();
  }, [selectedAssignment, assignments, settings, isSecondTerm, isThirdTerm]);

  const updateLocal = (studentId: string, field: string, value: string) => {
    setScoreMap(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }));
  };

  const handleSaveAll = async () => {
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;
    setSaving(true);

    for (const student of students) {
      const s = scoreMap[student.id];
      if (!s) continue;

      const first = Number(s.first_test) || 0;
      const second = Number(s.second_test) || 0;
      const exam = Number(s.exam) || 0;

      const upsertData = {
        student_id: student.id,
        subject_id: assignment.subjects.id,
        term: settings.active_term as any,
        session: settings.active_session,
        first_test: first,
        second_test: second,
        exam: exam,
        subject_comment: s.subject_comment || null,
        submitted: true,
      };

      if (s.id) {
        await supabase.from('scores').update({
          first_test: first,
          second_test: second,
          exam: exam,
          subject_comment: s.subject_comment || null,
          submitted: true,
        }).eq('id', s.id);
      } else {
        await supabase.from('scores').insert(upsertData);
      }
    }

    setSaving(false);
    toast.success("Scores saved and submitted!");

    // Refresh current term scores
    const { data: refreshed } = await supabase.from('scores')
      .select('*')
      .eq('subject_id', assignment.subjects.id)
      .eq('term', settings.active_term as any)
      .eq('session', settings.active_session)
      .in('student_id', students.map(s => s.id));
    const map: Record<string, any> = {};
    (refreshed || []).forEach(s => { map[s.student_id] = s; });
    setScoreMap(map);
  };

  const currentAssignment = assignments.find(a => a.id === selectedAssignment);

  return (
    <DashboardLayout title="Enter Scores">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Select Subject & Class" /></SelectTrigger>
          <SelectContent>
            {assignments.map(a => (
              <SelectItem key={a.id} value={a.id}>
                {a.subjects?.name} — {a.subjects?.class}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAssignment && (
          <Button onClick={handleSaveAll} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save All"}
          </Button>
        )}
      </div>

      {!selectedAssignment ? (
        <div className="text-center py-12 text-muted-foreground">Select a subject to start entering scores</div>
      ) : (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-display">
              {currentAssignment?.subjects?.name} — {currentAssignment?.subjects?.class} • {settings.active_term} {settings.active_session}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Student</TableHead>
                  <TableHead className="w-20">1st Test (20)</TableHead>
                  <TableHead className="w-20">2nd Test (20)</TableHead>
                  <TableHead className="w-20">Exam (60)</TableHead>
                  <TableHead className="w-16">Total (100)</TableHead>
                  {isSecondTerm && (
                    <>
                      <TableHead className="w-24 bg-accent/30 text-accent-foreground">1st Term (100)</TableHead>
                      <TableHead className="w-20 bg-accent/30 text-accent-foreground">Average</TableHead>
                    </>
                  )}
                  {isThirdTerm && (
                    <>
                      <TableHead className="w-24 bg-accent/30 text-accent-foreground">1st Term (100)</TableHead>
                      <TableHead className="w-24 bg-accent/30 text-accent-foreground">2nd Term (100)</TableHead>
                      <TableHead className="w-20 bg-accent/30 text-accent-foreground">Average</TableHead>
                    </>
                  )}
                  <TableHead className="w-16">Grade</TableHead>
                  <TableHead className="min-w-[120px]">Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => {
                  const s = scoreMap[student.id] || {};
                  const first = Number(s.first_test) || 0;
                  const second = Number(s.second_test) || 0;
                  const exam = Number(s.exam) || 0;
                  const total = first + second + exam;

                  const prev = prevTermScores[student.id] || {};
                  const term1 = prev.term1 ?? 0;
                  const term2 = prev.term2 ?? 0;

                  let average = total;
                  let termCount = 1;
                  if (isSecondTerm) {
                    average = (total + term1) / 2;
                    termCount = 2;
                  } else if (isThirdTerm) {
                    average = (total + term1 + term2) / 3;
                    termCount = 3;
                  }

                  const displayGrade = showCumulative ? calculateGrade(average) : calculateGrade(total);

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium text-sm">{student.full_name}</TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={20} className="h-8 text-sm w-16"
                          value={s.first_test ?? ''} onChange={e => updateLocal(student.id, 'first_test', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={20} className="h-8 text-sm w-16"
                          value={s.second_test ?? ''} onChange={e => updateLocal(student.id, 'second_test', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={60} className="h-8 text-sm w-16"
                          value={s.exam ?? ''} onChange={e => updateLocal(student.id, 'exam', e.target.value)} />
                      </TableCell>
                      <TableCell className="font-bold text-sm">{total}</TableCell>

                      {isSecondTerm && (
                        <>
                          <TableCell className="bg-amber-50/50 text-center text-sm font-medium text-amber-800">
                            {term1}
                          </TableCell>
                          <TableCell className="bg-amber-50/50 text-center font-bold text-sm text-amber-900">
                            {average.toFixed(1)}
                          </TableCell>
                        </>
                      )}
                      {isThirdTerm && (
                        <>
                          <TableCell className="bg-amber-50/50 text-center text-sm font-medium text-amber-800">
                            {term1}
                          </TableCell>
                          <TableCell className="bg-amber-50/50 text-center text-sm font-medium text-amber-800">
                            {term2}
                          </TableCell>
                          <TableCell className="bg-amber-50/50 text-center font-bold text-sm text-amber-900">
                            {average.toFixed(1)}
                          </TableCell>
                        </>
                      )}

                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          displayGrade === 'A1' ? 'bg-success/20 text-success' :
                          displayGrade === 'F9' ? 'bg-destructive/20 text-destructive' :
                          'bg-secondary text-secondary-foreground'
                        }`}>{displayGrade}</span>
                      </TableCell>
                      <TableCell>
                        <Textarea className="min-h-[32px] text-xs resize-none" rows={1}
                          value={s.subject_comment ?? ''} onChange={e => updateLocal(student.id, 'subject_comment', e.target.value)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
