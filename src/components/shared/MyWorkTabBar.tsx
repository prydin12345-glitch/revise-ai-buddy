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
    <nav aria-label="Practice libraries" className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1 sm:max-w-sm">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.label}
            type="button"
            onClick={() => isActive ? scrollWorkspaceToTop() : navigate(tab.path)}
            aria-current={isActive ? 'page' : undefined}
            className={`min-h-11 rounded-lg px-4 py-2.5 text-sm transition-colors ${
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
