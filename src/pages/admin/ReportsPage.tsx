import { Fragment, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CLASSES, TERMS } from "@/lib/constants";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ReportsPage() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const [reports, setReports] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, any[]>>({});
  const [savingTerm, setSavingTerm] = useState(false);
  const [pendingTerm, setPendingTerm] = useState<string>("");
  const [pendingSession, setPendingSession] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!settingsLoading) {
      setPendingTerm(settings.active_term);
      setPendingSession(settings.active_session);
    }
  }, [settingsLoading, settings]);

  const [histClass, setHistClass] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settingsLoading) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('reports')
        .select('*, students(full_name, spin, class)')
        .eq('session', settings.active_session)
        .eq('term', settings.active_term as any)
        .order('created_at', { ascending: false });
      setReports(data || []);
      setScores({});

      // Derive the class each student was in during this session/term
      const { data: sc } = await supabase
        .from('scores')
        .select('student_id, subjects(class)')
        .eq('session', settings.active_session)
        .eq('term', settings.active_term as any);
      const map: Record<string, string> = {};
      (sc || []).forEach((row: any) => {
        const cls = row.subjects?.class;
        if (cls && !map[row.student_id]) map[row.student_id] = cls;
      });
      setHistClass(map);
    };
    fetch();
  }, [settings, settingsLoading]);

  const yearOf = (s: string) => parseInt(s?.split('/')[0] || '0', 10);
  const sessionChanged = pendingSession !== settings.active_session;
  const sessionAdvanced = yearOf(pendingSession) > yearOf(settings.active_session);

  const applySettings = async (promote: boolean) => {
    setSavingTerm(true);
    let promoMsg = "";
    if (promote) {
      const { data, error: rpcError } = await supabase.rpc('promote_students', { _new_session: pendingSession });
      if (rpcError) {
        setSavingTerm(false);
        toast.error(rpcError.message);
        return;
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      promoMsg = ` — ${row?.promoted ?? 0} moved up, ${row?.graduated ?? 0} graduated`;
    }
    const { error } = await updateSettings({ active_term: pendingTerm, active_session: pendingSession });
    setSavingTerm(false);
    if (error) {
      toast.error("Failed to update term settings");
    } else {
      toast.success(`Active term updated to ${pendingTerm} ${pendingSession}${promoMsg}`);
    }
  };

  const handleSaveSettings = async () => {
    if (sessionChanged) {
      setConfirmOpen(true);
      return;
    }
    await applySettings(false);
  };

  const fetchScores = async (reportId: string, studentId: string) => {
    if (scores[reportId]) return;
    const { data } = await supabase
      .from('scores')
      .select('*, subjects(name)')
      .eq('student_id', studentId)
      .eq('session', settings.active_session)
      .eq('term', settings.active_term as any)
      .order('subjects(name)');
    setScores(prev => ({ ...prev, [reportId]: data || [] }));
  };

  const toggleExpand = (report: any) => {
    if (expandedId === report.id) {
      setExpandedId(null);
    } else {
      setExpandedId(report.id);
      fetchScores(report.id, report.student_id);
    }
  };

  const filtered = filterClass === 'all' ? reports : reports.filter(r => r.students?.class === filterClass);

  return (
    <DashboardLayout title="Reports">
      {/* Term Settings Card */}
      <Card className="mb-5">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1 sm:mb-0">
              <Settings className="h-4 w-4" />
              <span>Active Term Settings</span>
            </div>
            <div className="flex flex-1 flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Term</Label>
                <Select value={pendingTerm} onValueChange={setPendingTerm}>
                  <SelectTrigger className="w-40 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Session</Label>
                <Select value={pendingSession} onValueChange={setPendingSession}>
                  <SelectTrigger className="w-36 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["2024/2025", "2025/2026", "2026/2027"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleSaveSettings} disabled={savingTerm}
                className="h-8">
                {savingTerm ? "Saving..." : "Save"}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Current: <span className="font-semibold text-foreground">{settings.active_term} — {settings.active_session}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start the {pendingSession} session?</AlertDialogTitle>
            <AlertDialogDescription>
              Every student moves up one class (JSS1 to JSS2, JSS2 to JSS3, JSS3 to SS1, SS1 to SS2, SS2 to SS3),
              and SS3 students are marked as graduated and moved to the Graduated list.
              All past results are kept, and this can safely be run only once for {pendingSession}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applySettings(false)}>
              Change session only
            </AlertDialogAction>
            <AlertDialogAction onClick={() => void applySettings(true)}>
              Promote students &amp; change session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-end mb-4">
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No reports for {settings.active_term} {settings.active_session}
                  </TableCell>
                </TableRow>
              ) : filtered.map(r => {
                const isJSS = ["JSS1", "JSS2", "JSS3"].includes(r.students?.class || "");
                return (
                <Fragment key={r.id}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(r)}>
                    <TableCell className="font-medium">{r.students?.full_name}</TableCell>
                    <TableCell>{r.students?.class}</TableCell>
                    <TableCell>{r.average?.toFixed(1) || '—'}</TableCell>
                    <TableCell className="font-bold text-primary">{isJSS ? '—' : (r.overall_grade || '—')}</TableCell>
                    <TableCell>
                      <Badge variant={r.approved ? "default" : "secondary"}>
                        {r.approved ? "Approved" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                  </TableRow>
                  {expandedId === r.id && (
                    <TableRow key={`${r.id}-scores`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-0">
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Scores Breakdown</p>
                          {!scores[r.id] ? (
                            <p className="text-xs text-muted-foreground">Loading...</p>
                          ) : scores[r.id].length === 0 ? (
                            <p className="text-xs text-muted-foreground">No scores recorded yet.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-left pb-1">Subject</th>
                                  <th className="text-center pb-1">1st Test (20)</th>
                                  <th className="text-center pb-1">2nd Test (20)</th>
                                  <th className="text-center pb-1">Exam (60)</th>
                                  <th className="text-center pb-1">Total</th>
                                  <th className="text-center pb-1">Grade</th>
                                </tr>
                              </thead>
                              <tbody>
                                {scores[r.id].map(s => (
                                  <tr key={s.id} className="border-b border-muted last:border-0">
                                    <td className="py-1 font-medium">{s.subjects?.name}</td>
                                    <td className="text-center py-1">{s.first_test ?? '—'}</td>
                                    <td className="text-center py-1">{s.second_test ?? '—'}</td>
                                    <td className="text-center py-1">{s.exam ?? '—'}</td>
                                    <td className="text-center py-1 font-bold">{s.total ?? '—'}</td>
                                    <td className="text-center py-1 font-bold text-primary">{isJSS ? '—' : (s.grade ?? '—')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )})}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
