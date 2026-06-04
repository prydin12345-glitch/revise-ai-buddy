import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, LayoutDashboard, FileText, CheckSquare, Target, FolderOpen, MessageSquare, Settings, LogOut, User, Menu, Search, Sparkles, TrendingUp, Calendar, BarChart3, Users, MessageCircle, Link2, BookOpen, Sun, Moon, Plus, ChevronDown, ListChecks, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NotificationDropdown } from "./NotificationDropdown";
import { MobileNavFAB } from "./MobileNavFAB";
import MobileBottomNav from "./mobile/MobileBottomNav";
import MobileSpeedDial from "./mobile/MobileSpeedDial";
import { useUserRole } from "@/hooks/useUserRole";
import { prefetchRoute, prefetchCommonRoutes } from "@/lib/prefetch-routes";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { useTheme } from "@/hooks/useTheme";
import { AiTutorChat } from "@/components/ai-tutor/AiTutorChat";

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
  const location = useLocation();
  const { toast } = useToast();
  const { primaryRole } = useUserRole();
  const [joinClassModalOpen, setJoinClassModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatInitialMode, setAiChatInitialMode] = useState<'review' | null>(null);
  const [aiUnread, setAiUnread] = useState(0);
  const { theme, toggleTheme } = useTheme();

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

  const renderNavItem = (item: typeof navItems[0]) => {
    const isActive = location.pathname === item.path;
    return (
      <Button
        key={item.path}
        variant="ghost"
        className={`w-full transition-all duration-200 rounded-lg ${
          sidebarCollapsed ? "justify-center px-2" : "justify-start px-3"
        } ${
          isActive
            ? "bg-primary/10 dark:bg-primary/20 text-primary font-medium"
            : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground"
        }`}
        style={{
          borderLeft: isActive ? '2px solid hsl(var(--primary))' : '2px solid transparent',
        }}
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
    );
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar - visible from lg (iPad horizontal) and up */}
      <aside
        className={`hidden lg:block fixed left-0 top-0 h-screen bg-sidebar-background border-r border-sidebar-border z-50 transition-all duration-300 shadow-sm ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header — Logo + Collapse */}
          <div className="h-16 border-b border-sidebar-border flex items-center px-3 gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Menu className="w-5 h-5 text-foreground" />
            </Button>
            {!sidebarCollapsed && (
              <div className="flex items-center">
                <span className="text-lg font-bold text-foreground">Exam</span>
                <span className="text-lg font-bold text-primary">ly</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 overflow-y-auto">
            {/* Section label */}
            {!sidebarCollapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
                Main
              </p>
            )}
            <div className="space-y-1">
              {navItems.slice(0, 4).map(renderNavItem)}
            </div>

            <Separator className="my-3 bg-border" />

            {!sidebarCollapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
                Learning
              </p>
            )}
            <div className="space-y-1">
              {navItems.slice(4).map(renderNavItem)}
            </div>
          </nav>

          {/* Bottom section */}
          <div className="p-3 border-t border-border space-y-1">
            {/* Settings */}
            <Button
              variant="ghost"
              className={`w-full transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground ${
                sidebarCollapsed ? "justify-center px-0" : "justify-start"
              }`}
              onClick={() => navigate("/settings")}
              onMouseEnter={() => prefetchRoute('/settings')}
              title={sidebarCollapsed ? "Settings" : undefined}
            >
              <Settings className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"} flex-shrink-0`} />
              {!sidebarCollapsed && <span>Settings</span>}
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              className={`w-full transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground ${
                sidebarCollapsed ? "justify-center px-0" : "justify-start"
              }`}
              onClick={toggleTheme}
              title={sidebarCollapsed ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}
            >
              <div className="relative w-5 h-5 flex-shrink-0">
                <Sun className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'}`} />
                <Moon className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`} />
              </div>
              {!sidebarCollapsed && (
                <span className="ml-3">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
              )}
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              className={`w-full transition-all duration-200 hover:bg-red-500/10 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 ${
                sidebarCollapsed ? "justify-center px-0" : "justify-start"
              }`}
              onClick={handleLogout}
              title={sidebarCollapsed ? "Log Out" : undefined}
            >
              <LogOut className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"} flex-shrink-0`} />
              {!sidebarCollapsed && <span>Log Out</span>}
            </Button>

            {/* Legal footer links */}
            {!sidebarCollapsed && (
              <div className="pt-3 mt-1 border-t border-border/60 flex flex-wrap items-center gap-x-3 gap-y-1 px-3">
                <button
                  onClick={() => navigate("/privacy")}
                  className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
                >
                  Privacy
                </button>
                <button
                  onClick={() => navigate("/terms")}
                  className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
                >
                  Terms
                </button>
                <span className="text-[11px] text-muted-foreground/50 ml-auto">
                  © {new Date().getFullYear()} Examly
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        {/* Top bar */}
        <header className={`sticky top-0 z-30 h-14 lg:h-16 border-b transition-all duration-200 ${
          scrolled
            ? 'bg-background/95 backdrop-blur-md shadow-lg border-border'
            : 'bg-background border-transparent shadow-none'
        }`}>
          <div className="h-full flex items-center justify-between gap-4 px-4 lg:px-6">
            {/* Left: Logo */}
            <div className="flex items-center gap-6 flex-1">
              <div className="flex items-center">
                <span className="text-xl font-bold text-foreground">Exam</span>
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

              {/* Create dropdown — hidden on mobile (speed-dial FAB handles it there) */}
              {primaryRole !== 'tutor' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="hidden md:flex items-center gap-1.5 h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                      <Plus className="w-3.5 h-3.5" /> Create
                      <ChevronDown className="w-3 h-3 opacity-80" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-card border-border/50">
                    <DropdownMenuItem onClick={() => navigate("/upload")} className="cursor-pointer gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Mock Exam</span>
                        <span className="text-xs text-muted-foreground">Full timed paper</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/create-practice-questions")} className="cursor-pointer gap-2">
                      <ListChecks className="w-4 h-4 text-success" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Practice Quiz</span>
                        <span className="text-xs text-muted-foreground">Quick drill or quiz</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setJoinClassModalOpen(true)} className="cursor-pointer gap-2">
                      <Users className="w-4 h-4 text-[#a78bfa]" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Join Class</span>
                        <span className="text-xs text-muted-foreground">Enter an invite code</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <NotificationDropdown />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors px-1 gap-2 h-9">
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

        {/* Page content — extra bottom padding on mobile to clear the tab bar */}
        <main className="p-4 pb-24 md:pb-6 xl:p-6 xl:pb-6 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>

      {/* Mobile bottom tab bar (students, < md) + Create speed-dial FAB (all sizes) */}
      {primaryRole !== 'tutor' && (
        <>
          <MobileBottomNav />
          <MobileSpeedDial
            onCreateExam={() => navigate('/upload')}
            onCreateQuiz={() => navigate('/create-practice-questions')}
            onAskAI={() => setAiChatOpen(true)}
            aiUnreadCount={aiUnread}
          />
        </>
      )}

      {/* Tablet / tutor nav drawer FAB (md–lg only after edit) */}
      <MobileNavFAB />

      {/* AI Tutor Chat — appears on every authenticated page */}
      <AiTutorChat
        open={aiChatOpen}
        onOpenChange={setAiChatOpen}
        onUnreadChange={setAiUnread}
      />
    </div>
  );
};
