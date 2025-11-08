import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, LayoutDashboard, FileText, CheckSquare, Target, FolderOpen, MessageSquare, Settings, LogOut, User, Menu, Search, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FileText, label: "My Exams", path: "/my-exams" },
    { icon: CheckSquare, label: "My Quizzes", path: "/quizzes" },
    { icon: Target, label: "Revision Plan", path: "/revision-plan" },
    { icon: TrendingUp, label: "My Progress", path: "/stats" },
    { icon: MessageSquare, label: "AI Revision Coach", path: "/coach" },
  ];

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
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-sidebar-background border-r border-sidebar-border z-50 transition-all duration-300 shadow-xl ${
          sidebarCollapsed ? "w-16" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
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
              {navItems.slice(0, 3).map((item) => (
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
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Button>
              ))}
            </div>
            
            <Separator className="my-3 bg-border/20" />
            
            <div className="space-y-1">
              {navItems.slice(3).map((item) => (
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
        <header className="sticky top-0 z-30 h-16 bg-sidebar-background border-b border-sidebar-border shadow-lg">
          <div className="h-full flex items-center justify-between gap-4 px-4 lg:px-6">
            {/* Left: Mobile menu + Logo + Search */}
            <div className="flex items-center gap-6 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-white/10"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5 text-white" />
              </Button>
              
              <div className="hidden lg:flex items-center">
                <span className="text-xl font-bold text-white">Examly</span>
              </div>

              <div className="relative flex-1 max-w-md hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search exams, topics, or files..."
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/15 focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Right: Upgrade button + Profile */}
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg hover:shadow-xl transition-all"
                onClick={() => navigate("/pricing")}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden lg:inline">Upgrade</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 transition-colors">
                    <Avatar className="w-9 h-9 border-2 border-primary/40">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white">
                        <User className="w-4 h-4" />
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
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};
