import { useNavigate, useLocation } from "react-router-dom";
import { scrollWorkspaceToTop } from '@/lib/workspace-navigation';

export const MyWorkTabBar = ({ tutor = false }: { tutor?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = [
    { label: 'Exams', path: tutor ? '/tutor/exams' : '/my-exams' },
    { label: 'Quizzes', path: tutor ? '/tutor/practice' : '/quizzes' },
  ];

  return (
    <nav aria-label="Practice libraries" className="library-view-switch mb-6 flex w-fit max-w-full gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.label}
            type="button"
            onClick={() => isActive ? scrollWorkspaceToTop() : navigate(tab.path)}
            aria-current={isActive ? 'page' : undefined}
            className={`min-h-11 min-w-28 rounded-md px-5 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};
