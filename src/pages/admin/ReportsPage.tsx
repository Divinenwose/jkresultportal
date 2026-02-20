import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASSES, CURRENT_SESSION, CURRENT_TERM } from "@/lib/constants";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState<string>("all");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('reports')
        .select('*, students(full_name, spin, class)')
        .eq('session', CURRENT_SESSION)
        .eq('term', CURRENT_TERM)
        .order('created_at', { ascending: false });
      setReports(data || []);
    };
    fetch();
  }, []);

  const filtered = filterClass === 'all' ? reports : reports.filter(r => r.students?.class === filterClass);

  return (
    <DashboardLayout title="Reports">
      <div className="flex justify-end mb-4">
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All Classes" /></SelectTrigger>
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
                <TableHead>SPIN</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No reports yet</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.students?.full_name}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{r.students?.spin}</TableCell>
                  <TableCell>{r.students?.class}</TableCell>
                  <TableCell>{r.average?.toFixed(1) || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={r.approved ? "default" : "secondary"}>
                      {r.approved ? "Approved" : "Pending"}
                    </Badge>
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
