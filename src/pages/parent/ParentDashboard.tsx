import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [child, setChild] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('students').select('*').eq('parent_user_id', user.id).single()
      .then(({ data }) => setChild(data));
  }, [user]);

  return (
    <DashboardLayout title="Parent Dashboard">
      {!child ? (
        <div className="text-center py-12 text-muted-foreground">No child linked to your account yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Child Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{child.full_name}</p>
                  <p className="text-xs text-primary font-mono">{child.spin}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Class:</span> <strong>{child.class}</strong></div>
                <div><span className="text-muted-foreground">Gender:</span> <strong>{child.gender}</strong></div>
                {child.date_of_birth && <div><span className="text-muted-foreground">DOB:</span> <strong>{child.date_of_birth}</strong></div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Report Card
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">View and download your child's academic report card.</p>
              <Link to="/parent/report">
                <Button>View Report Card</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
