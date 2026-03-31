import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import {
  LayoutDashboard, FileText, BookOpen, CheckSquare,
  Users, TrendingUp, Settings, LogOut, X, Menu,
  MessageCircle, BarChart3, User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const STUDENT_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', route: '/dashboard' },
  { icon: FileText, label: 'My Exams', route: '/my-exams' },
  { icon: CheckSquare, label: 'Practice Quizzes', route: '/quizzes' },
  { icon: Users, label: 'My Classes', route: '/my-classes' },
  { icon: BookOpen, label: 'My Subjects', route: '/my-subjects' },
  { icon: TrendingUp, label: 'My Progress', route: '/stats' },
];

const TUTOR_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', route: '/dashboard' },
  { icon: FileText, label: 'Manage Exams', route: '/tutor/exams' },
  { icon: CheckSquare, label: 'Practice Sets', route: '/tutor/practice' },
  { icon: User, label: 'Students', route: '/tutor/students' },
  { icon: MessageCircle, label: 'Feedback', route: '/tutor/feedback' },
  { icon: BarChart3, label: 'Student Progress', route: '/tutor/progress' },
];

export const MobileNavFAB = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { primaryRole } = useUserRole();
  const isTutor = primaryRole === 'tutor';
  const navItems = isTutor ? TUTOR_NAV : STUDENT_NAV;

  // Hide on exam taking pages
  const hideOnRoutes = ['/in-progress', '/live', '/taking'];
  const shouldHide = hideOnRoutes.some(r => location.pathname.includes(r));

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on back gesture
  useEffect(() => {
    if (open) {
      const handler = () => setOpen(false);
      window.addEventListener('popstate', handler);
      return () => window.removeEventListener('popstate', handler);
    }
  }, [open]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (shouldHide) return null;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[98]"
          />
        )}
      </AnimatePresence>

      {/* Slide-up drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[99] rounded-t-2xl bg-card border-t border-border/50 shadow-2xl"
            style={{ maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Nav items */}
            <div className="px-4 pt-2 pb-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.route;
                return (
                  <button
                    key={item.route}
                    onClick={() => {
                      navigate(item.route);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl mb-0.5 text-[15px] text-left font-inherit transition-all duration-150 border-none ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'bg-transparent text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {item.label}
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-border/50" />

            {/* Bottom actions */}
            <div className="px-4 pt-2 pb-4">
              <button
                onClick={() => { navigate('/settings'); setOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl mb-0.5 text-[15px] text-left transition-all duration-150 border-none ${
                  location.pathname === '/settings'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] text-left text-destructive bg-transparent border-none hover:bg-destructive/10 transition-all duration-150"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(prev => !prev)}
        className={`fixed z-[100] xl:hidden flex items-center justify-center w-[52px] h-[52px] rounded-full border-none shadow-xl cursor-pointer transition-colors duration-200 ${
          open ? 'bg-foreground' : 'bg-primary'
        }`}
        style={{
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          right: 20,
        }}
        aria-label={open ? 'Close navigation' : 'Open navigation'}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5 text-background" />
            </motion.div>
          ) : (
            <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Menu className="w-5 h-5 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
};

export default MobileNavFAB;
