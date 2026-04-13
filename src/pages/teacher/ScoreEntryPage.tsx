import { useEffect, useState, useRef, useCallback } from "react";
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
import { Save, Check } from "lucide-react";

export default function ScoreEntryPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [scoreMap, setScoreMap] = useState<Record<string, any>>({});
  // Maps: studentId -> { term1Total, term2Total }
  const [prevTermScores, setPrevTermScores] = useState<Record<string, { term1?: number; term2?: number }>>({});
  const [prevTermIds, setPrevTermIds] = useState<Record<string, { term1Id?: string; term2Id?: string }>>({});
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<Record<string, 'saving' | 'saved' | ''>>({});
  const autoSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});

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
          const idMap: Record<string, { term1Id?: string; term2Id?: string }> = {};

          const { data: t1Scores } = await supabase.from('scores')
            .select('id, student_id, total')
            .eq('subject_id', assignment.subjects.id)
            .eq('term', 'First Term' as any)
            .eq('session', settings.active_session)
            .in('student_id', studentIds);

          (t1Scores || []).forEach(s => {
            prevMap[s.student_id] = { ...prevMap[s.student_id], term1: Number(s.total) || 0 };
            idMap[s.student_id] = { ...idMap[s.student_id], term1Id: s.id };
          });

          if (isThirdTerm) {
            const { data: t2Scores } = await supabase.from('scores')
              .select('id, student_id, total')
              .eq('subject_id', assignment.subjects.id)
              .eq('term', 'Second Term' as any)
              .eq('session', settings.active_session)
              .in('student_id', studentIds);

            (t2Scores || []).forEach(s => {
              prevMap[s.student_id] = { ...prevMap[s.student_id], term2: Number(s.total) || 0 };
              idMap[s.student_id] = { ...idMap[s.student_id], term2Id: s.id };
            });
          }

          setPrevTermScores(prevMap);
          setPrevTermIds(idMap);
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

  const computeCommentScore = (studentId: string, scoreData: any) => {
    const total = (Number(scoreData.first_test) || 0) + (Number(scoreData.second_test) || 0) + (Number(scoreData.exam) || 0);
    const prev = prevTermScores[studentId] || {};
    const term1Val = Number(prev.term1 ?? 0);
    const term2Val = Number(prev.term2 ?? 0);
    if (isThirdTerm) {
      const terms = [total, term1Val, term2Val];
      const nonZeroCount = terms.filter(t => t > 0).length || 1;
      return terms.reduce((a, b) => a + b, 0) / nonZeroCount;
    }
    if (isSecondTerm) {
      const terms = [total, term1Val];
      const nonZeroCount = terms.filter(t => t > 0).length || 1;
      return terms.reduce((a, b) => a + b, 0) / nonZeroCount;
    }
    return total;
  };

  const autoSaveStudent = useCallback(async (studentId: string, scoreData: any) => {
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    const first = Number(scoreData.first_test) || 0;
    const second = Number(scoreData.second_test) || 0;
    const exam = Number(scoreData.exam) || 0;

    setAutoSaveStatus(prev => ({ ...prev, [studentId]: 'saving' }));

    const saveData = {
      first_test: first,
      second_test: second,
      exam: exam,
      subject_comment: scoreData.subject_comment || null,
      submitted: false,
    };

    if (scoreData.id) {
      await supabase.from('scores').update(saveData).eq('id', scoreData.id);
    } else {
      const { data } = await supabase.from('scores').insert({
        ...saveData,
        student_id: studentId,
        subject_id: assignment.subjects.id,
        term: settings.active_term as any,
        session: settings.active_session,
      }).select().single();
      if (data) {
        setScoreMap(prev => ({ ...prev, [studentId]: { ...prev[studentId], id: data.id } }));
      }
    }

    setAutoSaveStatus(prev => ({ ...prev, [studentId]: 'saved' }));
    setTimeout(() => setAutoSaveStatus(prev => ({ ...prev, [studentId]: '' })), 2000);
  }, [assignments, selectedAssignment, settings]);

  const scheduleAutoSave = useCallback((studentId: string, scoreData: any) => {
    if (autoSaveTimers.current[studentId]) {
      clearTimeout(autoSaveTimers.current[studentId]);
    }
    autoSaveTimers.current[studentId] = setTimeout(() => {
      autoSaveStudent(studentId, scoreData);
    }, 1500);
  }, [autoSaveStudent]);

  const updateLocal = (studentId: string, field: string, value: string) => {
    const maxMap: Record<string, number> = { first_test: 20, second_test: 20, exam: 60 };
    const clamped = maxMap[field] ? clampValue(value, maxMap[field]) : value;

    setScoreMap(prev => {
      const updated = { ...prev, [studentId]: { ...prev[studentId], [field]: clamped } };
      const s = updated[studentId];
      const avg = computeCommentScore(studentId, s);
      updated[studentId] = { ...updated[studentId], subject_comment: autoComment(avg) };
      scheduleAutoSave(studentId, updated[studentId]);
      return updated;
    });
  };

  const autoSavePrevTerm = useCallback(async (studentId: string, termKey: 'term1' | 'term2', totalValue: number) => {
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    const termName = termKey === 'term1' ? 'First Term' : 'Second Term';
    const ids = prevTermIds[studentId] || {};
    const existingId = termKey === 'term1' ? ids.term1Id : ids.term2Id;

    if (existingId) {
      await supabase.from('scores').update({ total: totalValue }).eq('id', existingId);
    } else {
      const { data } = await supabase.from('scores').insert({
        student_id: studentId,
        subject_id: assignment.subjects.id,
        term: termName as any,
        session: settings.active_session,
        total: totalValue,
        submitted: true,
      }).select().single();
      if (data) {
        setPrevTermIds(prev => ({
          ...prev,
          [studentId]: { ...prev[studentId], [termKey === 'term1' ? 'term1Id' : 'term2Id']: data.id }
        }));
      }
    }
  }, [assignments, selectedAssignment, settings, prevTermIds]);

  const prevTermTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const updatePrevTerm = (studentId: string, termKey: 'term1' | 'term2', value: string) => {
    const clamped = clampValue(value, 100);
    const numValue = clamped === '' ? 0 : Number(clamped);

    setPrevTermScores(prev => {
      const updatedPrev = {
        ...prev,
        [studentId]: { ...prev[studentId], [termKey]: numValue }
      };
      // Recompute comment with new prev term values
      const s = scoreMap[studentId] || {};
      const total = (Number(s.first_test) || 0) + (Number(s.second_test) || 0) + (Number(s.exam) || 0);
      const p = updatedPrev[studentId] || {};
      let avg = total;
      if (isThirdTerm) {
        const terms = [total, Number(p.term1 ?? 0), Number(p.term2 ?? 0)];
        const nonZeroCount = terms.filter(t => t > 0).length || 1;
        avg = terms.reduce((a, b) => a + b, 0) / nonZeroCount;
      } else if (isSecondTerm) {
        const terms = [total, Number(p.term1 ?? 0)];
        const nonZeroCount = terms.filter(t => t > 0).length || 1;
        avg = terms.reduce((a, b) => a + b, 0) / nonZeroCount;
      }
      setScoreMap(sm => ({
        ...sm,
        [studentId]: { ...sm[studentId], subject_comment: autoComment(avg) }
      }));

      // Auto-save prev term with debounce
      const timerKey = `${studentId}_${termKey}`;
      if (prevTermTimers.current[timerKey]) clearTimeout(prevTermTimers.current[timerKey]);
      prevTermTimers.current[timerKey] = setTimeout(() => {
        autoSavePrevTerm(studentId, termKey, numValue);
      }, 1500);

      return updatedPrev;
    });
  };

  const handleSaveAll = async () => {
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;
    setSaving(true);

    // Clear any pending auto-save timers
    Object.values(autoSaveTimers.current).forEach(clearTimeout);
    autoSaveTimers.current = {};

    for (const student of students) {
      const s = scoreMap[student.id];
      if (!s) continue;

      const first = Number(s.first_test) || 0;
      const second = Number(s.second_test) || 0;
      const exam = Number(s.exam) || 0;

      const saveData = {
        first_test: first,
        second_test: second,
        exam: exam,
        subject_comment: s.subject_comment || null,
        submitted: true,
      };

      if (s.id) {
        await supabase.from('scores').update(saveData).eq('id', s.id);
      } else {
        await supabase.from('scores').insert({
          ...saveData,
          student_id: student.id,
          subject_id: assignment.subjects.id,
          term: settings.active_term as any,
          session: settings.active_session,
        });
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Scores auto-save as you type</span>
            <Button onClick={handleSaveAll} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Submitting..." : "Submit All"}
            </Button>
          </div>
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
                    const terms = [total, term1Val];
                    const nonZeroCount = terms.filter(t => t > 0).length || 1;
                    average = terms.reduce((a, b) => a + b, 0) / nonZeroCount;
                  } else if (isThirdTerm) {
                    const terms = [total, term1Val, term2Val];
                    const nonZeroCount = terms.filter(t => t > 0).length || 1;
                    average = terms.reduce((a, b) => a + b, 0) / nonZeroCount;
                  }

                  const displayGrade = calculateGrade(average);

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1">
                          {student.full_name}
                          {autoSaveStatus[student.id] === 'saving' && <span className="text-[10px] text-muted-foreground animate-pulse">saving...</span>}
                          {autoSaveStatus[student.id] === 'saved' && <Check className="h-3 w-3 text-green-500" />}
                        </div>
                      </TableCell>
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
