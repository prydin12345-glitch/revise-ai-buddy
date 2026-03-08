import { useNavigate, useLocation } from "react-router-dom";

const TABS = [
  { label: "Exams", path: "/my-exams" },
  { label: "Practice Quizzes", path: "/quizzes" },
] as const;

export const MyWorkTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex gap-0 border-b border-border mb-6">
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`px-6 py-2.5 text-sm border-b-2 transition-all bg-transparent border-none cursor-pointer ${
              isActive
                ? "border-b-primary text-foreground font-semibold"
                : "border-b-transparent text-muted-foreground font-normal hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
