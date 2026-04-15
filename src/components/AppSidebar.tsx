import {
  LayoutDashboard, Users, BookOpen, ClipboardCheck, FileText,
  UserPlus, Settings, LogOut, GraduationCap
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import schoolLogo from "@/assets/school-logo.jpeg";
import { SCHOOL_NAME } from "@/lib/constants";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const adminLinks = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Students", url: "/admin/students", icon: Users },
  { title: "Subjects", url: "/admin/subjects", icon: BookOpen },
  { title: "Teachers", url: "/admin/teachers", icon: UserPlus },
  { title: "Reports", url: "/admin/reports", icon: FileText },
  { title: "Approve Results", url: "/admin/approve", icon: ClipboardCheck },
];

const teacherLinks = [
  { title: "Dashboard", url: "/teacher", icon: LayoutDashboard },
  { title: "Enter Scores", url: "/teacher/scores", icon: ClipboardCheck },
];

const parentLinks = [
  { title: "Dashboard", url: "/parent", icon: LayoutDashboard },
  { title: "Report Card", url: "/parent/report", icon: FileText },
];

export function AppSidebar() {
  const { role, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    const detail: { promises: Promise<void>[] } = { promises: [] };
    window.dispatchEvent(new CustomEvent("app:before-signout", { detail }));
    await Promise.all(detail.promises);
    await signOut();
  };

  const links = role === 'admin' ? adminLinks : role === 'teacher' ? teacherLinks : parentLinks;

  return (
    <Sidebar className="border-r-0">
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <img src={schoolLogo} alt="School Logo" className="w-10 h-10 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-sidebar-foreground truncate">{SCHOOL_NAME}</p>
          <p className="text-[10px] text-sidebar-foreground/60 capitalize">{role} Portal</p>
        </div>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/admin' || item.url === '/teacher' || item.url === '/parent'}
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 mb-2 px-2">
          <GraduationCap className="h-4 w-4 text-sidebar-primary" />
          <span className="text-xs text-sidebar-foreground/80 truncate">{profile?.full_name}</span>
        </div>
        <button
          onClick={() => void handleSignOut()}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
