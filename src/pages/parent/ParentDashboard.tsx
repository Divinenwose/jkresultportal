import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { User, FileText, ChevronRight, Search, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, class, gender, date_of_birth, parent_user_id')
      .ilike('full_name', `%${searchQuery.trim()}%`)
      .is('parent_user_id', null)
      .order('full_name')
      .limit(10);
    setSearching(false);
    if (error) { toast.error(error.message); return; }
    setSearchResults(data || []);
  };

  const handleClaim = async (studentId: string, studentName: string) => {
    if (!user) return;
    setClaiming(studentId);
    const { error } = await supabase
      .from('students')
      .update({ parent_user_id: user.id })
      .eq('id', studentId)
      .is('parent_user_id', null);
    setClaiming(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${studentName} has been linked to your account!`);
    setSearchResults(prev => prev.filter(s => s.id !== studentId));
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

  return (
    <DashboardLayout title="Parent Dashboard">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-muted-foreground">
          {children.length === 0
            ? "No children linked yet. Search and claim your child below."
            : children.length === 1
            ? "Your ward's profile is shown below."
            : `You have ${children.length} wards linked to your account.`}
        </p>
        <Dialog open={claimOpen} onOpenChange={(o) => { setClaimOpen(o); if (!o) { setSearchQuery(""); setSearchResults([]); } }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" /> Claim a Child
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Find & Claim Your Child</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Search for your child by name. Only students without a linked parent will appear.
            </p>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Enter student's full name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length === 0 && !searching && searchQuery && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No unclaimed students found for "{searchQuery}".
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto mt-2">
                {searchResults.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.class} · {s.gender}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleClaim(s.id, s.full_name)}
                      disabled={claiming === s.id}
                    >
                      {claiming === s.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
                      Claim
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {children.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium text-muted-foreground">No children linked to your account</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Claim a Child" above to search and link your child.</p>
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
