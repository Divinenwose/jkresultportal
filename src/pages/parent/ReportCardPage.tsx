import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SCHOOL_NAME, SCHOOL_MOTTO, CURRENT_SESSION, CURRENT_TERM, GRADE_SCALE, calculateGrade } from "@/lib/constants";
import schoolLogo from "@/assets/school-logo.jpeg";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function ReportCardPage() {
  const { user } = useAuth();
  const [child, setChild] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: student } = await supabase.from('students').select('*').eq('parent_user_id', user.id).single();
      if (!student) return;
      setChild(student);

      const [reportRes, scoresRes] = await Promise.all([
        supabase.from('reports').select('*').eq('student_id', student.id).eq('session', CURRENT_SESSION).eq('term', CURRENT_TERM).single(),
        supabase.from('scores').select('*, subjects(name)').eq('student_id', student.id).eq('session', CURRENT_SESSION).eq('term', CURRENT_TERM),
      ]);
      setReport(reportRes.data);
      setScores(scoresRes.data || []);
    };
    fetch();
  }, [user]);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Report_${child?.spin}_${CURRENT_TERM}_${CURRENT_SESSION}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setDownloading(false);
  };

  const totalMarks = scores.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const average = scores.length ? totalMarks / scores.length : 0;

  if (!child) {
    return <DashboardLayout title="Report Card"><div className="text-center py-12 text-muted-foreground">No child linked to your account.</div></DashboardLayout>;
  }

  if (!report?.approved) {
    return <DashboardLayout title="Report Card"><div className="text-center py-12 text-muted-foreground">Report card not yet available. Please check back later.</div></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Report Card">
      <div className="flex justify-end mb-4">
        <Button onClick={handleDownload} disabled={downloading}>
          <Download className="h-4 w-4 mr-1" /> {downloading ? "Generating..." : "Download PDF"}
        </Button>
      </div>

      <Card className="max-w-3xl mx-auto">
        <CardContent className="p-0">
          <div ref={reportRef} className="p-6 bg-white text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div className="text-center border-b-2 border-blue-600 pb-4 mb-4">
              <img src={schoolLogo} alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-2 object-cover" />
              <h1 className="text-lg font-bold text-blue-800 uppercase">{SCHOOL_NAME}</h1>
              <p className="text-[10px] italic text-gray-500">"{SCHOOL_MOTTO}"</p>
              <p className="text-xs font-semibold mt-2 text-blue-700">STUDENT ACADEMIC REPORT — {CURRENT_TERM.toUpperCase()} {CURRENT_SESSION}</p>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-3 gap-2 text-xs mb-4 border rounded p-3 bg-blue-50">
              <div><span className="text-gray-500">Name:</span> <strong>{child.full_name}</strong></div>
              <div><span className="text-gray-500">Class:</span> <strong>{child.class}</strong></div>
              <div><span className="text-gray-500">SPIN:</span> <strong className="text-blue-700">{child.spin}</strong></div>
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
                  <th className="border p-1.5 text-center">Grade</th>
                  <th className="border p-1.5 text-left">Remark</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                    <td className="border p-1.5 font-medium">{s.subjects?.name}</td>
                    <td className="border p-1.5 text-center">{s.first_test}</td>
                    <td className="border p-1.5 text-center">{s.second_test}</td>
                    <td className="border p-1.5 text-center">{s.exam}</td>
                    <td className="border p-1.5 text-center font-bold">{s.total}</td>
                    <td className="border p-1.5 text-center font-bold">{s.grade}</td>
                    <td className="border p-1.5">{s.subject_comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="flex gap-4 text-xs font-semibold mb-4 p-3 rounded bg-blue-50 border">
              <div>Total Marks: <span className="text-blue-700">{totalMarks}</span></div>
              <div>Average: <span className="text-blue-700">{average.toFixed(1)}</span></div>
              <div>Overall Grade: <span className="text-blue-700">{report.overall_grade || calculateGrade(average)}</span></div>
            </div>

            {/* Comments */}
            <div className="space-y-2 text-xs mb-4">
              <div className="p-2 border rounded">
                <span className="text-gray-500">Class Teacher's Comment:</span>
                <p className="font-medium mt-0.5">{report.teacher_comment || '—'}</p>
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

            {/* Grade Key */}
            <div className="border rounded p-3">
              <p className="text-[10px] font-bold mb-1 text-gray-600">GRADING KEY</p>
              <div className="grid grid-cols-3 gap-1 text-[9px]">
                {GRADE_SCALE.map(g => (
                  <div key={g.grade}>
                    <strong>{g.grade}</strong>: {g.min}–{g.max} ({g.remark})
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
