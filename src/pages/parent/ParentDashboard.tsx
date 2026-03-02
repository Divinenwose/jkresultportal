import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, FileText, ChevronRight, UserPlus, UserMinus, Loader2, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";

const ALL_CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;
const MAX_CHILDREN = 3;

export default function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [classBrowse, setClassBrowse] = useState<Record<string, any[]>>({});
  const [loadingClass, setLoadingClass] = useState<string | null>(null);
  const [loadedClasses, setLoadedClasses] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("JSS1");

  const fetchChildren = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('parent_user_id', user.id)
      .order('full_name');
    setChildren(data || []);
  };

  useEffect(() => { fetchChildren(); }, [user]);

  const fetchClassStudents = async (cls: string) => {
    if (loadedClasses.has(cls)) return;
    setLoadingClass(cls);
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, class, gender, spin')
      .eq('class', cls as "JSS1" | "JSS2" | "JSS3" | "SS1" | "SS2" | "SS3")
      .is('parent_user_id', null)
      .order('full_name');
    setLoadingClass(null);
    if (error) { toast.error(error.message); return; }
    setClassBrowse(prev => ({ ...prev, [cls]: data || [] }));
    setLoadedClasses(prev => new Set([...prev, cls]));
  };

  const handleTabChange = (cls: string) => {
    setActiveTab(cls);
    fetchClassStudents(cls);
  };

  const handleOpenDialog = (open: boolean) => {
    setClaimOpen(open);
    if (open) {
      setActiveTab("JSS1");
      setClassBrowse({});
      setLoadedClasses(new Set());
      fetchClassStudents("JSS1");
    }
  };

  const handleClaim = async (studentId: string, studentName: string) => {
    if (!user) return;
    if (children.length >= MAX_CHILDREN) {
      toast.error(`You can only claim up to ${MAX_CHILDREN} children.`);
      return;
    }
    setClaiming(studentId);
    const { error } = await supabase
      .from('students')
      .update({ parent_user_id: user.id })
      .eq('id', studentId)
      .is('parent_user_id', null);
    setClaiming(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${studentName} has been linked to your account!`);
    // Remove from browse list
    setClassBrowse(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(s => s.id !== studentId),
    }));
    fetchChildren();
  };

  const handleUnclaim = async (studentId: string, studentName: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('students')
      .update({ parent_user_id: null })
      .eq('id', studentId)
      .eq('parent_user_id', user.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${studentName} has been unlinked from your account.`);
    fetchChildren();
  };

  const atLimit = children.length >= MAX_CHILDREN;

  return (
    <DashboardLayout title="Parent Dashboard">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-muted-foreground">
          {children.length === 0
            ? "No children linked yet. Browse by class and claim your child below."
            : children.length === 1
            ? "Your ward's profile is shown below."
            : `You have ${children.length} ward${children.length > 1 ? "s" : ""} linked to your account.`}
        </p>
        <Dialog open={claimOpen} onOpenChange={handleOpenDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={atLimit}>
              <UserPlus className="h-4 w-4 mr-2" />
              {atLimit ? "Limit Reached (3/3)" : "Claim a Child"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> Browse & Claim Your Child
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Browse students by class. Only unclaimed students are shown.
              {children.length > 0 && (
                <span className="ml-1 font-medium text-foreground">
                  ({children.length}/{MAX_CHILDREN} claimed)
                </span>
              )}
            </p>

            {atLimit ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <UserPlus className="h-10 w-10 text-muted-foreground opacity-40 mb-3" />
                <p className="font-medium">Maximum limit reached</p>
                <p className="text-sm text-muted-foreground mt-1">You have claimed the maximum of {MAX_CHILDREN} children.</p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 mt-2">
                <TabsList className="grid grid-cols-6 w-full shrink-0">
                  {ALL_CLASSES.map(cls => (
                    <TabsTrigger key={cls} value={cls} className="text-xs">{cls}</TabsTrigger>
                  ))}
                </TabsList>

                {ALL_CLASSES.map(cls => (
                  <TabsContent key={cls} value={cls} className="flex-1 overflow-y-auto mt-3 min-h-0">
                    {loadingClass === cls ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : !loadedClasses.has(cls) ? null : (classBrowse[cls] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">
                        No unclaimed students in {cls}.
                      </p>
                    ) : (
                      <div className="space-y-2 pr-1">
                        {(classBrowse[cls] || []).map(s => (
                          <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{s.full_name}</p>
                                <p className="text-xs text-muted-foreground">{s.gender} · {s.spin}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleClaim(s.id, s.full_name)}
                              disabled={claiming === s.id || atLimit}
                            >
                              {claiming === s.id
                                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                : <UserPlus className="h-3 w-3 mr-1" />}
                              Claim
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {children.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium text-muted-foreground">No children linked to your account</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Claim a Child" above to browse by class and link your child.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {children.map(child => (
            <Card key={child.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> {child.full_name}
                  </CardTitle>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unlink {child.full_name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {child.full_name} from your account. You will no longer be able to view their reports. You can re-claim them later if needed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleUnclaim(child.id, child.full_name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Unlink
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <Badge variant="secondary" className="w-fit text-xs">{child.class}</Badge>
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
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Class:</span> <strong>{child.class}</strong></div>
                    <div><span className="text-muted-foreground">Gender:</span> <strong>{child.gender}</strong></div>
                    {child.date_of_birth && (
                      <div className="col-span-2"><span className="text-muted-foreground">DOB:</span> <strong>{child.date_of_birth}</strong></div>
                    )}
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
      )}
    </DashboardLayout>
  );
}
