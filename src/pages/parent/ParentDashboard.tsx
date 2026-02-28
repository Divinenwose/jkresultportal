import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, FileText, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('students').select('*').eq('parent_user_id', user.id).order('full_name')
      .then(({ data }) => setChildren(data || []));
  }, [user]);

  return (
    <DashboardLayout title="Parent Dashboard">
      {children.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No children linked to your account yet. Please contact the school admin.</div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {children.length === 1 ? "Your ward's profile is shown below." : `You have ${children.length} wards linked to your account.`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children.map(child => (
              <Card key={child.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> {child.full_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      {child.photo_url ? (
                        <img src={child.photo_url} alt={child.full_name} className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <User className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-primary font-mono font-semibold">{child.spin}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs">
                        <div><span className="text-muted-foreground">Class:</span> <strong>{child.class}</strong></div>
                        <div><span className="text-muted-foreground">Gender:</span> <strong>{child.gender}</strong></div>
                        {child.date_of_birth && (
                          <div className="col-span-2"><span className="text-muted-foreground">DOB:</span> <strong>{child.date_of_birth}</strong></div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Link to={`/parent/report?studentId=${child.id}`}>
                    <Button className="w-full" variant="outline">
                      <FileText className="h-4 w-4 mr-2" /> View Report Card
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
