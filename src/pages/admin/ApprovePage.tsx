import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CLASSES } from "@/lib/constants";
import { useSettings } from "@/hooks/useSettings";
import { CheckCircle } from "lucide-react";

export default function ApprovePage() {
  const { settings, loading: settingsLoading } = useSettings();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, any>>({});
  const [scores, setScores] = useState<Record<string, any[]>>({});
  const [saving, setSaving] = useState<string | null>(null);


  useEffect(() => {
    if (!selectedClass || settingsLoading) return;
    const fetch = async () => {
      const { data: studs } = await supabase.from('students').select('*').eq('class', selectedClass as any).order('full_name');
      setStudents(studs || []);

      if (studs?.length) {
        const ids = studs.map(s => s.id);
        const [reportsRes, scoresRes] = await Promise.all([
          supabase.from('reports').select('*').in('student_id', ids).eq('session', settings.active_session).eq('term', settings.active_term as any),
          supabase.from('scores').select('*, subjects(name)').in('student_id', ids).eq('session', settings.active_session).eq('term', settings.active_term as any).eq('submitted', true),
        ]);

        const rMap: Record<string, any> = {};
        (reportsRes.data || []).forEach(r => { rMap[r.student_id] = r; });
        setReports(rMap);

        const sMap: Record<string, any[]> = {};
        (scoresRes.data || []).forEach(s => {
          if (!sMap[s.student_id]) sMap[s.student_id] = [];
          sMap[s.student_id].push(s);
        });
        setScores(sMap);
      }
    };
    fetch();
  }, [selectedClass, settings, settingsLoading]);

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
        term: settings.active_term as any,
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
    const grade = avg >= 75 ? 'A1' : avg >= 70 ? 'B2' : avg >= 65 ? 'B3' : avg >= 60 ? 'C4' : avg >= 55 ? 'C5' : avg >= 50 ? 'C6' : avg >= 45 ? 'D7' : avg >= 40 ? 'E8' : 'F9';

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

  return (
    <DashboardLayout title="Approve Results">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
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
            const submittedCount = studentScores.filter(s => s.submitted).length;
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
                      <Input
                        type="number" min={0}
                        value={report?.days_opened || ''}
                        onChange={e => handleCreateOrUpdateReport(student.id, 'days_opened', parseInt(e.target.value) || 0)}
                        disabled={isApproved}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Days Present</Label>
                      <Input
                        type="number" min={0}
                        value={report?.days_present || ''}
                        onChange={e => handleCreateOrUpdateReport(student.id, 'days_present', parseInt(e.target.value) || 0)}
                        disabled={isApproved}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Class Teacher Comment</Label>
                    <Textarea
                      value={report?.teacher_comment || ''}
                      onChange={e => handleCreateOrUpdateReport(student.id, 'teacher_comment', e.target.value)}
                      disabled={isApproved}
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Principal Comment</Label>
                    <Textarea
                      value={report?.principal_comment || ''}
                      onChange={e => handleCreateOrUpdateReport(student.id, 'principal_comment', e.target.value)}
                      disabled={isApproved}
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Next Term Begins</Label>
                    <Input
                      type="date"
                      value={report?.next_term_begins || ''}
                      onChange={e => handleCreateOrUpdateReport(student.id, 'next_term_begins', e.target.value)}
                      disabled={isApproved}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="border rounded p-2 bg-muted/30">
                    <p className="text-xs font-semibold mb-2">Report Preview</p>

                    {studentScores.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No submitted scores</p>
                    ) : (
                      <div className="space-y-1">
                        {studentScores.map((s) => {
                          const total = Number(s.total) || 0;

                          const grade =
                            total >= 75 ? 'A1' :
                              total >= 70 ? 'B2' :
                                total >= 65 ? 'B3' :
                                  total >= 60 ? 'C4' :
                                    total >= 55 ? 'C5' :
                                      total >= 50 ? 'C6' :
                                        total >= 45 ? 'D7' :
                                          total >= 40 ? 'E8' : 'F9';

                          return (
                            <div key={s.id} className="flex justify-between text-xs border-b pb-1">
                              <span>{s.subjects?.name}</span>
                              <span>{total}</span>
                              <span className="font-semibold">{grade}</span>
                            </div>
                          );
                        })}
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
