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

function autoComment(total: number): string {
  if (total >= 75) return 'Excellent';
  if (total >= 70) return 'Very Good';
  if (total >= 65) return 'Good';
  if (total >= 50) return 'Credit';
  if (total >= 40) return 'Pass';
  if (total > 0) return 'Fail';
  return '';
}
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

  const clampValue = (value: string, max: number): string => {
    if (value === '') return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    return String(Math.min(Math.max(0, num), max));
  };

  const updateLocal = (studentId: string, field: string, value: string) => {
    const maxMap: Record<string, number> = { first_test: 20, second_test: 20, exam: 60 };
    const clamped = maxMap[field] ? clampValue(value, maxMap[field]) : value;

    setScoreMap(prev => {
      const updated = { ...prev, [studentId]: { ...prev[studentId], [field]: clamped } };
      // Auto-generate comment based on total
      const s = updated[studentId];
      const total = (Number(s.first_test) || 0) + (Number(s.second_test) || 0) + (Number(s.exam) || 0);
      updated[studentId] = { ...updated[studentId], subject_comment: autoComment(total) };
      return updated;
    });
  };

  const updatePrevTerm = (studentId: string, termKey: 'term1' | 'term2', value: string) => {
    const clamped = clampValue(value, 100);
    setPrevTermScores(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [termKey]: clamped === '' ? 0 : Number(clamped) }
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
  const currentClass = currentAssignment?.subjects?.class || currentAssignment?.class || '';
  const isJSS = ['JSS1', 'JSS2', 'JSS3'].includes(currentClass);

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
                  {!isJSS && <TableHead className="w-16">Grade</TableHead>}
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
                  const term1Val = prev.term1 ?? 0;
                  const term2Val = prev.term2 ?? 0;

                  let average = total;
                  if (isSecondTerm) {
                    average = (total + term1Val) / 2;
                  } else if (isThirdTerm) {
                    average = (total + term1Val + term2Val) / 3;
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
                          <TableCell className="bg-accent/10 p-1">
                            <Input type="number" min={0} max={100} className="h-8 text-sm w-20"
                              value={prev.term1 ?? ''} onChange={e => updatePrevTerm(student.id, 'term1', e.target.value)} />
                          </TableCell>
                          <TableCell className="bg-accent/10 text-center font-bold text-sm text-primary">
                            {average.toFixed(1)}
                          </TableCell>
                        </>
                      )}
                      {isThirdTerm && (
                        <>
                          <TableCell className="bg-accent/10 p-1">
                            <Input type="number" min={0} max={100} className="h-8 text-sm w-20"
                              value={prev.term1 ?? ''} onChange={e => updatePrevTerm(student.id, 'term1', e.target.value)} />
                          </TableCell>
                          <TableCell className="bg-accent/10 p-1">
                            <Input type="number" min={0} max={100} className="h-8 text-sm w-20"
                              value={prev.term2 ?? ''} onChange={e => updatePrevTerm(student.id, 'term2', e.target.value)} />
                          </TableCell>
                          <TableCell className="bg-accent/10 text-center font-bold text-sm text-primary">
                            {average.toFixed(1)}
                          </TableCell>
                        </>
                      )}

                      {!isJSS && (
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            displayGrade === 'A1' ? 'bg-success/20 text-success' :
                            displayGrade === 'F9' ? 'bg-destructive/20 text-destructive' :
                            'bg-secondary text-secondary-foreground'
                          }`}>{displayGrade}</span>
                        </TableCell>
                      )}
                      <TableCell className="text-xs font-medium">
                        {s.subject_comment || autoComment(total)}
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
