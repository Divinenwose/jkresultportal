import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCHOOL_NAME, SCHOOL_MOTTO, GRADE_SCALE, calculateGrade } from "@/lib/constants";
import { useSettings } from "@/hooks/useSettings";
import schoolLogo from "@/assets/school-logo.jpeg";
import { Download, ArrowLeft } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useSearchParams, Link } from "react-router-dom";

export default function ReportCardPage() {
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const [searchParams] = useSearchParams();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [child, setChild] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  // previous term cumulative scores: subjectId -> { term1Total, term2Total }
  const [prevScoreMap, setPrevScoreMap] = useState<Record<string, { term1?: number; term2?: number }>>({});
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const activeTerm = settings.active_term;
  const isSecondTerm = activeTerm === "Second Term";
  const isThirdTerm = activeTerm === "Third Term";
  const showCumulative = isSecondTerm || isThirdTerm;
  const isJSS = ["JSS1", "JSS2", "JSS3"].includes(child?.class || "");

  useEffect(() => {
    if (!user) return;
    supabase.from('students').select('*').eq('parent_user_id', user.id).order('full_name')
      .then(({ data }) => {
        const kids = data || [];
        setChildren(kids);
        const paramId = searchParams.get("studentId");
        const initialId = paramId && kids.find(k => k.id === paramId) ? paramId : (kids[0]?.id || "");
        setSelectedChildId(initialId);
      });
  }, [user]);

  useEffect(() => {
    if (!selectedChildId || settingsLoading) { setChild(null); setReport(null); setScores([]); setPrevScoreMap({}); return; }
    const selected = children.find(c => c.id === selectedChildId);
    setChild(selected || null);
    if (!selected) return;

    const fetchReport = async () => {
      const [reportRes, scoresRes] = await Promise.all([
        supabase.from('reports').select('*')
          .eq('student_id', selected.id)
          .eq('session', settings.active_session)
          .eq('term', settings.active_term as any)
          .single(),
        supabase.from('scores').select('*, subjects(name, id)')
          .eq('student_id', selected.id)
          .eq('session', settings.active_session)
          .eq('term', settings.active_term as any)
          .order('subjects(name)'),
      ]);
      setReport(reportRes.data);
      setScores(scoresRes.data || []);

      // Fetch previous term totals for cumulative display
      if (isSecondTerm || isThirdTerm) {
        const pMap: Record<string, { term1?: number; term2?: number }> = {};

        const { data: t1 } = await supabase.from('scores')
          .select('subject_id, total')
          .eq('student_id', selected.id)
          .eq('session', settings.active_session)
          .eq('term', 'First Term' as any);

        (t1 || []).forEach(s => {
          pMap[s.subject_id] = { ...pMap[s.subject_id], term1: Number(s.total) || 0 };
        });

        if (isThirdTerm) {
          const { data: t2 } = await supabase.from('scores')
            .select('subject_id, total')
            .eq('student_id', selected.id)
            .eq('session', settings.active_session)
            .eq('term', 'Second Term' as any);

          (t2 || []).forEach(s => {
            pMap[s.subject_id] = { ...pMap[s.subject_id], term2: Number(s.total) || 0 };
          });
        }

        setPrevScoreMap(pMap);
      } else {
        setPrevScoreMap({});
      }
    };
    fetchReport();
  }, [selectedChildId, children, settings, settingsLoading, isSecondTerm, isThirdTerm]);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // A4 dimensions in mm
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Calculate image dimensions to fit the PDF page
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If image height exceeds PDF height, scale it down
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      
      if (imgHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = (canvas.width * pdfHeight) / canvas.height;
      }
      
      // Center the image on the page
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
      pdf.save(`Report_${child?.full_name}_${settings.active_term}_${settings.active_session}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setDownloading(false);
  };

  const totalMarks = scores.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const subjectCount = scores.length || 1;
  const average = scores.length ? totalMarks / subjectCount : 0;

  if (children.length === 0) {
    return (
      <DashboardLayout title="Report Card">
        <div className="text-center py-12 text-muted-foreground">No children linked to your account.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Report Card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Link to="/parent">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          {children.length > 1 && (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.class})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {report?.approved && (
          <Button onClick={handleDownload} disabled={downloading}>
            <Download className="h-4 w-4 mr-1" /> {downloading ? "Generating..." : "Download PDF"}
          </Button>
        )}
      </div>

      {!child ? (
        <div className="text-center py-12 text-muted-foreground">Select a child to view their report.</div>
      ) : !report?.approved ? (
        <Card className="max-w-3xl mx-auto">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="font-medium">Report card for <strong>{child.full_name}</strong> is not yet available.</p>
            <p className="text-sm mt-1">Please check back after the admin approves the results.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-0">
            <div ref={reportRef} className="p-6 bg-white text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
              {/* Header */}
              <div className="text-center border-b-2 border-blue-600 pb-4 mb-4">
                <img src={schoolLogo} alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-2 object-cover" />
                <h1 className="text-lg font-bold text-blue-800 uppercase">{SCHOOL_NAME}</h1>
                <p className="text-[10px] italic text-gray-500">"{SCHOOL_MOTTO}"</p>
                <p className="text-xs font-semibold mt-2 text-blue-700">
                  STUDENT ACADEMIC REPORT — {settings.active_term.toUpperCase()} {settings.active_session}
                </p>
              </div>

              {/* Student Info */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-4 border rounded p-3 bg-blue-50">
                <div><span className="text-gray-500">Name:</span> <strong>{child.full_name}</strong></div>
                <div><span className="text-gray-500">Class:</span> <strong>{child.class}</strong></div>
                <div><span className="text-gray-500">Gender:</span> <strong>{child.gender}</strong></div>
                {child.date_of_birth && <div><span className="text-gray-500">DOB:</span> <strong>{child.date_of_birth}</strong></div>}
              </div>

              {/* Attendance */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-4 border rounded p-3">
                <div><span className="text-gray-500">Days Opened:</span> <strong>{report.days_opened || 0}</strong></div>
                <div><span className="text-gray-500">Days Present:</span> <strong>{report.days_present || 0}</strong></div>
                <div><span className="text-gray-500">Days Absent:</span> <strong>{(report.days_opened || 0) - (report.days_present || 0)}</strong></div>
              </div>

              {/* Scores Table */}
              <table className="w-full text-xs border-collapse border mb-4">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border p-1.5 text-left">Subject</th>
                    <th className="border p-1.5 text-center">1st Test (20)</th>
                    <th className="border p-1.5 text-center">2nd Test (20)</th>
                    <th className="border p-1.5 text-center">Exam (60)</th>
                    <th className="border p-1.5 text-center">Total (100)</th>
                    {isSecondTerm && (
                      <>
                        <th className="border p-1.5 text-center bg-blue-700">1st Term (100)</th>
                        <th className="border p-1.5 text-center bg-blue-700">Average</th>
                      </>
                    )}
                    {isThirdTerm && (
                      <>
                        <th className="border p-1.5 text-center bg-blue-700">1st Term (100)</th>
                        <th className="border p-1.5 text-center bg-blue-700">2nd Term (100)</th>
                        <th className="border p-1.5 text-center bg-blue-700">Average</th>
                      </>
                    )}
                    {!isJSS && <th className="border p-1.5 text-center">Grade</th>}
                    <th className="border p-1.5 text-left">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, i) => {
                    const prev = prevScoreMap[s.subjects?.id] || {};
                    const term1 = prev.term1 ?? 0;
                    const term2 = prev.term2 ?? 0;
                    const currentTotal = Number(s.total) || 0;

                    // Average only over terms that actually have a score (matches the admin Approve page)
                    let rowAvg = currentTotal;
                    if (showCumulative) {
                      const terms = isThirdTerm ? [currentTotal, term1, term2] : [currentTotal, term1];
                      const counted = terms.filter(t => t > 0).length || 1;
                      rowAvg = terms.reduce((a, b) => a + b, 0) / counted;
                    }

                    const rowGrade = calculateGrade(showCumulative ? rowAvg : currentTotal);
                    const rowRemark = (() => {
      const grade = calculateGrade(showCumulative ? rowAvg : currentTotal);
      return GRADE_SCALE.find((g) => g.grade === grade)?.remark || "—";
    })();

                    return (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        <td className="border p-1.5 font-medium">{s.subjects?.name}</td>
                        <td className="border p-1.5 text-center">{s.first_test ?? '—'}</td>
                        <td className="border p-1.5 text-center">{s.second_test ?? '—'}</td>
                        <td className="border p-1.5 text-center">{s.exam ?? '—'}</td>
                        <td className="border p-1.5 text-center font-bold">{s.total ?? '—'}</td>
                        {isSecondTerm && (
                          <>
                            <td className="border p-1.5 text-center bg-blue-100">{term1}</td>
                            <td className="border p-1.5 text-center font-bold bg-blue-100">{rowAvg.toFixed(1)}</td>
                          </>
                        )}
                        {isThirdTerm && (
                          <>
                            <td className="border p-1.5 text-center bg-blue-100">{term1}</td>
                            <td className="border p-1.5 text-center bg-blue-100">{term2}</td>
                            <td className="border p-1.5 text-center font-bold bg-blue-100">{rowAvg.toFixed(1)}</td>
                          </>
                        )}
                        {!isJSS && <td className="border p-1.5 text-center font-bold text-blue-700">{rowGrade}</td>}
                        <td className="border p-1.5 text-gray-600">{rowRemark}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Summary */}
              <div className="flex gap-4 text-xs font-semibold mb-4 p-3 rounded bg-blue-50 border">
                <div>Total Marks: <span className="text-blue-700">{totalMarks}</span></div>
                <div>Average: <span className="text-blue-700">{average.toFixed(1)}</span></div>
                {!isJSS && <div>Overall Grade: <span className="text-blue-700">{report.overall_grade || calculateGrade(average)}</span></div>}
              </div>

              {/* Comments */}
              <div className="space-y-2 text-xs mb-4">
                <div className="p-2 border rounded">
                  <span className="text-gray-500">Class Teacher's Comment:</span>
                  <p className="font-medium mt-0.5">
                    {report.teacher_comment ? 
                      `${child.gender?.toLowerCase() === "female" ? "She" : "He"} ${report.teacher_comment}` : 
                      '—'
                    }
                  </p>
                </div>
                <div className="p-2 border rounded">
                  <span className="text-gray-500">Principal's Comment:</span>
                  <p className="font-medium mt-0.5">{report.principal_comment || '—'}</p>
                </div>
                {report.next_term_begins && (
                  <div className="p-2 border rounded">
                    <span className="text-gray-500">Next Term Begins:</span> <strong>{report.next_term_begins}</strong>
                  </div>
                )}
              </div>

              {!isJSS && (
                <div className="border rounded p-3">
                  <p className="text-[10px] font-bold mb-1 text-gray-600">GRADING KEY</p>
                  <div className="grid grid-cols-3 gap-1 text-[9px]">
                    {GRADE_SCALE.map(g => (
                      <div key={g.grade}><strong>{g.grade}</strong>: {g.min}–{g.max} ({g.remark})</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
