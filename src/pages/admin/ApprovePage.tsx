import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CLASSES, calculateGrade, GRADE_SCALE } from "@/lib/constants";
import { useSettings } from "@/hooks/useSettings";
import { CheckCircle, RefreshCw, Trash2 } from "lucide-react";

const teacherComments = [
  "is generally well-behaved and relates well with others.",
  "shows good conduct and responds positively to guidance.",
  "maintains a calm and friendly attitude in class.",
  "is respectful and cooperates well with classmates.",
  "demonstrates acceptable behavior and continues to improve.",
  "is polite and follows instructions most of the time.",
  "shows steady improvement in behavior—keep it up.",
  "has a pleasant attitude and interacts well with peers."
];

const principalComments = [
  "Good performance this term; keep it up.",
  "A commendable effort; aim for higher achievement.",
  "Fair performance; more effort is encouraged.",
  "Steady progress observed; keep working hard.",
  "Good result; strive for improvement next term.",
  "An encouraging performance; maintain consistency.",
  "Satisfactory performance; greater focus is needed.",
  "Shows potential; continued effort will improve results."
];

function getComment(average: number, isJSS: boolean): string {
  if (isJSS) {
    if (average >= 80) return "Excellent";
    if (average >= 70) return "Very Good";
    if (average >= 60) return "Good";
    if (average >= 50) return "Fair";
    if (average >= 40) return "Pass";
    return "Fail";
  }
  const grade = calculateGrade(average);
  return GRADE_SCALE.find((g) => g.grade === grade)?.remark ?? "Fail";
}

export default function ApprovePage() {
  const { settings, loading: settingsLoading } = useSettings();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, any>>({});
  const [scores, setScores] = useState<Record<string, any[]>>({});
  const [prevScores, setPrevScores] = useState<Record<string, Record<string, { term1?: number; term2?: number }>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isJSS = ["JSS1", "JSS2", "JSS3"].includes(selectedClass);
  const isSecondTerm = settings.active_term === "Second Term";
  const isThirdTerm = settings.active_term === "Third Term";
  const showCumulative = isSecondTerm || isThirdTerm;

  const fetchData = async () => {
    if (!selectedClass || settingsLoading) return;
    const term = settings.active_term;
    const session = settings.active_session;

    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 300));
    const { data: studs } = await supabase.from('students').select('*').eq('class', selectedClass as any).order('full_name');
    setStudents(studs || []);

    if (studs?.length) {
      const ids = studs.map(s => s.id);
      const [reportsRes, scoresRes] = await Promise.all([
        supabase.from('reports').select('*').in('student_id', ids).eq('session', session).eq('term', term as any),
        supabase
          .from('scores')
          .select('*, subjects!scores_subject_id_fkey(id, name)')
          .in('student_id', ids)
          .eq('session', session)
          .eq('term', term as any)
          .eq('submitted', true),
      ]);

      if (scoresRes.error) {
        console.error(scoresRes.error);
        toast.error(scoresRes.error.message || 'Failed to load submitted scores');
      }

      const rMap: Record<string, any> = {};
      (reportsRes.data || []).forEach(r => { rMap[r.student_id] = r; });
      setReports(rMap);

      const sMap: Record<string, any[]> = {};
      (scoresRes.data || []).forEach(s => {
        if (!sMap[s.student_id]) sMap[s.student_id] = [];
        sMap[s.student_id].push(s);
      });
      setScores(sMap);

      // Fetch previous term scores for cumulative display
      if (showCumulative) {
        const prevMap: Record<string, Record<string, { term1?: number; term2?: number }>> = {};

        const { data: t1 } = await supabase.from('scores')
          .select('student_id, subject_id, total')
          .in('student_id', ids)
          .eq('session', session)
          .eq('term', 'First Term' as any);

        (t1 || []).forEach(s => {
          if (!prevMap[s.student_id]) prevMap[s.student_id] = {};
          prevMap[s.student_id][s.subject_id] = {
            ...prevMap[s.student_id][s.subject_id],
            term1: Number(s.total) || 0,
          };
        });

        if (isThirdTerm) {
          const { data: t2 } = await supabase.from('scores')
            .select('student_id, subject_id, total')
            .in('student_id', ids)
            .eq('session', session)
            .eq('term', 'Second Term' as any);

          (t2 || []).forEach(s => {
            if (!prevMap[s.student_id]) prevMap[s.student_id] = {};
            prevMap[s.student_id][s.subject_id] = {
              ...prevMap[s.student_id][s.subject_id],
              term2: Number(s.total) || 0,
            };
          });
        }

        setPrevScores(prevMap);
      } else {
        setPrevScores({});
      }
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass, settings.active_term, settings.active_session, settingsLoading]);

  const handleCreateOrUpdateReport = async (studentId: string, field: string, value: any) => {
    const existing = reports[studentId];
    if (existing) {
      await supabase.from('reports').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', existing.id);
      setReports(prev => ({ ...prev, [studentId]: { ...existing, [field]: value } }));
    } else {
      const studentScores = scores[studentId] || [];
      const totalMarks = studentScores.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      const avg = studentScores.length ? totalMarks / studentScores.length : 0;

      const { data } = await supabase.from('reports').insert({
        student_id: studentId,
        term: settings.active_term as "First Term" | "Second Term" | "Third Term",
        session: settings.active_session,
        total_marks: totalMarks,
        average: Math.round(avg * 100) / 100,
        [field]: value,
      }).select().single();

      if (data) setReports(prev => ({ ...prev, [studentId]: data }));
    }
  };

  const handleApprove = async (studentId: string) => {
    const report = reports[studentId];
    if (!report) {
      toast.error("Please add comments first");
      return;
    }
    setSaving(studentId);

    const studentScores = scores[studentId] || [];
    const totalMarks = studentScores.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const avg = studentScores.length ? totalMarks / studentScores.length : 0;
    const grade = calculateGrade(avg);

    await supabase.from('reports').update({
      approved: true,
      total_marks: totalMarks,
      average: Math.round(avg * 100) / 100,
      overall_grade: grade,
      updated_at: new Date().toISOString(),
    }).eq('id', report.id);

    setReports(prev => ({ ...prev, [studentId]: { ...report, approved: true, total_marks: totalMarks, average: avg, overall_grade: grade } }));
    setSaving(null);
    toast.success("Report approved!");
  };

  const handleDeleteScore = async (studentId: string, score: any) => {
    const confirmed = window.confirm("Delete this submitted score?");
    if (!confirmed) return;

    // Remove instantly from UI, then persist deletion in DB.
    const previousStudentScores = scores[studentId] || [];
    setScores((prev) => ({
      ...prev,
      [studentId]: (prev[studentId] || []).filter((item) => item.id !== score.id),
    }));

    const { data, error } = await supabase
      .from("scores")
      .delete()
      .eq("id", score.id)
      .eq("submitted", true)
      .select("id");

    if (error) {
      setScores((prev) => ({ ...prev, [studentId]: previousStudentScores }));
      toast.error(error.message || "Failed to delete score");
      return;
    }

    if (!data || data.length === 0) {
      setScores((prev) => ({ ...prev, [studentId]: previousStudentScores }));
      toast.error("Delete permission is missing. Apply latest migration and retry.");
      return;
    }

    // Re-fetch from DB so refresh state stays consistent.
    await fetchData();
    toast.success("Score deleted");
  };

  return (
    <DashboardLayout title="Approve Results">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        {selectedClass && (
          <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
        {!settingsLoading && (
          <span className="text-xs text-muted-foreground">
            Term: <span className="font-semibold text-foreground">{settings.active_term} — {settings.active_session}</span>
          </span>
        )}
      </div>

      {!selectedClass ? (
        <div className="text-center py-12 text-muted-foreground">Select a class to view students</div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No students in this class</div>
      ) : (
        <div className="space-y-4">
          {students.map(student => {
            const report = reports[student.id];
            const studentScores = scores[student.id] || [];
            const studentPrev = prevScores[student.id] || {};
            const submittedCount = studentScores.length;
            const isApproved = report?.approved;

            return (
              <Card key={student.id} className={isApproved ? "border-success/30 bg-success/5" : ""}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-display">
                      {student.full_name}
                      <span className="ml-2 font-mono text-xs text-primary">{student.spin}</span>
                    </CardTitle>
                    {isApproved && <CheckCircle className="h-5 w-5 text-success" />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {submittedCount} subjects submitted •
                    Total: {studentScores.reduce((s, sc) => s + (Number(sc.total) || 0), 0)} •
                    Avg: {studentScores.length
                      ? (studentScores.reduce((s, sc) => s + (Number(sc.total) || 0), 0) / studentScores.length).toFixed(1)
                      : '0'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Attendance - Days Opened</Label>
                      <Input type="number" min={0} value={report?.days_opened || ''} onChange={e => handleCreateOrUpdateReport(student.id, 'days_opened', parseInt(e.target.value) || 0)} disabled={isApproved} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Days Present</Label>
                      <Input type="number" min={0} value={report?.days_present || ''} onChange={e => handleCreateOrUpdateReport(student.id, 'days_present', parseInt(e.target.value) || 0)} disabled={isApproved} className="h-8 text-sm" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Class Teacher Comment</Label>
                    <Select
                      value={report?.teacher_comment || ""}
                      onValueChange={(value) => {
                        const pronoun = student.gender?.toLowerCase() === "female" ? "She" : "He";
                        handleCreateOrUpdateReport(student.id, "teacher_comment", `${pronoun} ${value}`);
                      }}
                      disabled={isApproved}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select Teacher Comment" />
                      </SelectTrigger>
                      <SelectContent>
                        {teacherComments.map((comment, index) => (
                          <SelectItem key={index} value={comment}>
                            {student.gender?.toLowerCase() === "female" ? "She" : "He"} {comment}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Principal Comment</Label>
                    <Select
                      value={report?.principal_comment || ""}
                      onValueChange={(value) =>
                        handleCreateOrUpdateReport(student.id, "principal_comment", value)
                      }
                      disabled={isApproved}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select Principal Comment" />
                      </SelectTrigger>
                      <SelectContent>
                        {principalComments.map((comment, index) => (
                          <SelectItem key={index} value={comment}>
                            {comment}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Next Term Begins</Label>
                    <Input type="date" value={report?.next_term_begins || ''} onChange={e => handleCreateOrUpdateReport(student.id, 'next_term_begins', e.target.value)} disabled={isApproved} className="h-8 text-sm" />
                  </div>

                  {/* Report Card Preview */}
                  <div className="border rounded p-3 bg-muted/30">
                    <p className="text-xs font-semibold mb-2">📋 Report Card Preview</p>
                    {studentScores.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No submitted scores yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px] py-1">Subject</TableHead>
                              <TableHead className="text-[10px] py-1 text-center">1st Test</TableHead>
                              <TableHead className="text-[10px] py-1 text-center">2nd Test</TableHead>
                              <TableHead className="text-[10px] py-1 text-center">Exam</TableHead>
                              <TableHead className="text-[10px] py-1 text-center">Total</TableHead>
                              {isSecondTerm && (
                                <>
                                  <TableHead className="text-[10px] py-1 text-center">1st Term</TableHead>
                                  <TableHead className="text-[10px] py-1 text-center">Average</TableHead>
                                </>
                              )}
                              {isThirdTerm && (
                                <>
                                  <TableHead className="text-[10px] py-1 text-center">1st Term</TableHead>
                                  <TableHead className="text-[10px] py-1 text-center">2nd Term</TableHead>
                                  <TableHead className="text-[10px] py-1 text-center">Average</TableHead>
                                </>
                              )}
                              {!isJSS && <TableHead className="text-[10px] py-1 text-center">Grade</TableHead>}
                              <TableHead className="text-[10px] py-1">Comment</TableHead>
                              <TableHead className="text-[10px] py-1 text-center w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentScores.map((s) => {
                              const currentTotal = Number(s.total) || 0;
                              const subjectId = s.subjects?.id || s.subject_id;
                              const prev = studentPrev[subjectId] || {};
                              const term1 = prev.term1 ?? 0;
                              const term2 = prev.term2 ?? 0;

                              let rowAvg = currentTotal;
                              if (isSecondTerm) {
                                const terms = [currentTotal, term1];
                                const nonZero = terms.filter(t => t > 0).length || 1;
                                rowAvg = terms.reduce((a, b) => a + b, 0) / nonZero;
                              } else if (isThirdTerm) {
                                const terms = [currentTotal, term1, term2];
                                const nonZero = terms.filter(t => t > 0).length || 1;
                                rowAvg = terms.reduce((a, b) => a + b, 0) / nonZero;
                              }

                              const grade = calculateGrade(showCumulative ? rowAvg : currentTotal);
                              const comment = getComment(showCumulative ? rowAvg : currentTotal, isJSS);

                              return (
                                <TableRow key={s.id}>
                                  <TableCell className="text-[11px] py-1">{s.subjects?.name}</TableCell>
                                  <TableCell className="text-[11px] py-1 text-center">{s.first_test ?? '-'}</TableCell>
                                  <TableCell className="text-[11px] py-1 text-center">{s.second_test ?? '-'}</TableCell>
                                  <TableCell className="text-[11px] py-1 text-center">{s.exam ?? '-'}</TableCell>
                                  <TableCell className="text-[11px] py-1 text-center font-bold">{currentTotal}</TableCell>
                                  {isSecondTerm && (
                                    <>
                                      <TableCell className="text-[11px] py-1 text-center">{term1}</TableCell>
                                      <TableCell className="text-[11px] py-1 text-center font-bold">{rowAvg.toFixed(1)}</TableCell>
                                    </>
                                  )}
                                  {isThirdTerm && (
                                    <>
                                      <TableCell className="text-[11px] py-1 text-center">{term1}</TableCell>
                                      <TableCell className="text-[11px] py-1 text-center">{term2}</TableCell>
                                      <TableCell className="text-[11px] py-1 text-center font-bold">{rowAvg.toFixed(1)}</TableCell>
                                    </>
                                  )}
                                  {!isJSS && (
                                    <TableCell className="text-[11px] py-1 text-center">
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${grade === 'A1' ? 'bg-success/20 text-success' : grade === 'F9' ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-secondary-foreground'}`}>
                                        {grade}
                                      </span>
                                    </TableCell>
                                  )}
                                  <TableCell className="text-[10px] py-1">{comment}</TableCell>
                                  <TableCell className="text-center py-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteScore(student.id, s)}
                                      disabled={isApproved}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {!isApproved && (
                    <Button onClick={() => handleApprove(student.id)} disabled={saving === student.id} size="sm">
                      {saving === student.id ? "Approving..." : "Approve Report"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
