import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, LayoutDashboard, FileText, CheckSquare, Target, FolderOpen, MessageSquare, Settings, LogOut, User, Menu, Search, Sparkles, TrendingUp, Calendar, BarChart3, Users, MessageCircle, Link2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NotificationDropdown } from "./NotificationDropdown";
import { MobileNavFAB } from "./MobileNavFAB";
import { useUserRole } from "@/hooks/useUserRole";
import { prefetchRoute, prefetchCommonRoutes } from "@/lib/prefetch-routes";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { primaryRole } = useUserRole();
  const [joinClassModalOpen, setJoinClassModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Prefetch common routes during browser idle time after mount
  useEffect(() => {
    prefetchCommonRoutes();
  }, []);

  const studentNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FileText, label: "My Exams", path: "/my-exams" },
    { icon: CheckSquare, label: "Practice Quizzes", path: "/quizzes" },
    { icon: Users, label: "My Classes", path: "/my-classes" },
    { icon: BookOpen, label: "My Subjects", path: "/my-subjects" },
    { icon: TrendingUp, label: "My Progress", path: "/stats" },
  ];

  const tutorNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FileText, label: "Manage Exams", path: "/tutor/exams" },
    { icon: CheckSquare, label: "Practice Sets", path: "/tutor/practice" },
    { icon: User, label: "Students", path: "/tutor/students" },
    { icon: MessageCircle, label: "Feedback", path: "/tutor/feedback" },
    
    { icon: BarChart3, label: "Student Progress", path: "/tutor/progress" },
  ];

  const navItems = primaryRole === 'tutor' ? tutorNavItems : studentNavItems;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logged out",
        description: "See you next time!",
      });
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar - Hidden on mobile */}
      <aside
        className={`hidden lg:block fixed left-0 top-0 h-screen bg-sidebar-background border-r border-sidebar-border z-50 transition-all duration-300 shadow-xl ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Hamburger Menu */}
          <div className="h-16 border-b border-border/50 flex items-center px-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-white/10 transition-colors"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Menu className="w-5 h-5 text-white" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 overflow-y-auto">
            <div className="space-y-1">
              {navItems.slice(0, 4).map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={`w-full transition-all duration-200 hover:bg-white/10 text-gray-300 hover:text-white ${
                    sidebarCollapsed ? "justify-center px-0" : "justify-start"
                  } ${
                    window.location.pathname === item.path ? "bg-primary/20 text-white border-l-2 border-primary" : ""
                  }`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  onMouseEnter={() => prefetchRoute(item.path)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Button>
              ))}
            </div>
            
            <Separator className="my-3 bg-border/20" />
            
            <div className="space-y-1">
              {navItems.slice(4).map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={`w-full transition-all duration-200 hover:bg-white/10 text-gray-300 hover:text-white ${
                    sidebarCollapsed ? "justify-center px-0" : "justify-start"
                  } ${
                    window.location.pathname === item.path ? "bg-primary/20 text-white border-l-2 border-primary" : ""
                  }`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  onMouseEnter={() => prefetchRoute(item.path)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Button>
              ))}
            </div>
            
            <Separator className="my-3 bg-border/20" />
          </nav>

          {/* Bottom section */}
          <div className="p-3 border-t border-border/30 space-y-1">
            <Button
              variant="ghost"
              className={`w-full transition-all duration-200 hover:bg-white/10 text-gray-300 hover:text-white ${
                sidebarCollapsed ? "justify-center px-0" : "justify-start"
              }`}
              onClick={() => navigate("/settings")}
              onMouseEnter={() => prefetchRoute('/settings')}
              title={sidebarCollapsed ? "Settings" : undefined}
            >
              <Settings className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"} flex-shrink-0`} />
              {!sidebarCollapsed && <span>Settings</span>}
            </Button>
            <Button
              variant="ghost"
              className={`w-full transition-all duration-200 hover:bg-red-500/20 text-red-400 hover:text-red-300 ${
                sidebarCollapsed ? "justify-center px-0" : "justify-start"
              }`}
              onClick={handleLogout}
              title={sidebarCollapsed ? "Log Out" : undefined}
            >
              <LogOut className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"} flex-shrink-0`} />
              {!sidebarCollapsed && <span>Log Out</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        {/* Top bar */}
        <header className={`sticky top-0 z-30 h-14 lg:h-16 border-b transition-all duration-200 ${
          scrolled
            ? 'bg-sidebar-background/95 backdrop-blur-md shadow-lg border-sidebar-border'
            : 'bg-sidebar-background border-transparent shadow-none'
        }`}>
          <div className="h-full flex items-center justify-between gap-4 px-4 lg:px-6">
            {/* Left: Logo */}
            <div className="flex items-center gap-6 flex-1">
              <div className="flex items-center">
                <span className="text-xl font-bold text-white">Exam</span>
                <span className="text-xl font-bold text-primary">ly</span>
              </div>
            </div>

            {/* Right: Join Class + Upgrade + Notifications + Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {primaryRole !== 'tutor' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex items-center gap-1.5 border-border/50 text-foreground hover:bg-muted/50 h-9"
                    onClick={() => setJoinClassModalOpen(true)}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Join Class</span>
                  </Button>
                  <JoinClassModal
                    open={joinClassModalOpen}
                    onOpenChange={setJoinClassModalOpen}
                    onSuccess={() => {
                      setJoinClassModalOpen(false);
                      // Refresh the page to reflect new class
                      window.location.reload();
                    }}
                  />
                </>
              )}

              <Button
                variant="default"
                size="sm"
                className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg hover:shadow-xl transition-all h-9"
                onClick={() => navigate("/pricing")}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Upgrade</span>
              </Button>

              <NotificationDropdown />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-full hover:bg-white/10 transition-colors px-1 gap-2 h-9">
                    <Avatar className="w-8 h-8 border-2 border-primary/40">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-xs">
                        <User className="w-3.5 h-3.5" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border/50">
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 pb-24 lg:p-6 lg:pb-6 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};
