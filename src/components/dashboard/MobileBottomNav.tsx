import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, CheckSquare, Target, TrendingUp, Settings, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";

interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
}

const studentNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'exams', label: 'Exams', icon: FileText, path: '/my-exams' },
  { id: 'quizzes', label: 'Quizzes', icon: CheckSquare, path: '/quizzes' },
  { id: 'plan', label: 'Plan', icon: Target, path: '/revision-plan' },
  { id: 'stats', label: 'Stats', icon: TrendingUp, path: '/stats' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

const tutorNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'exams', label: 'Exams', icon: FileText, path: '/tutor/exams' },
  { id: 'practice', label: 'Practice', icon: CheckSquare, path: '/tutor/practice' },
  { id: 'planner', label: 'Planner', icon: Calendar, path: '/tutor/planner' },
  { id: 'progress', label: 'Progress', icon: BarChart3, path: '/tutor/progress' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { primaryRole } = useUserRole();

  const navItems = primaryRole === 'tutor' ? tutorNavItems : studentNavItems;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-sidebar-background/95 backdrop-blur-lg border-t border-sidebar-border/50 shadow-2xl pb-safe animate-slide-in-bottom"
    >
      <div className="grid grid-cols-6 h-18 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 h-full rounded-none hover:bg-white/10 transition-all duration-200 ${
                active ? 'scale-105' : 'scale-100'
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon 
                className={`h-5 w-5 transition-colors ${
                  active ? 'text-primary' : 'text-gray-400'
                }`}
              />
              <span 
                className={`text-[10px] font-medium transition-colors ${
                  active ? 'text-primary font-semibold' : 'text-gray-500'
                }`}
              >
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
};
