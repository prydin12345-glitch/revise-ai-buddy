// src/components/dashboard/mobile/MobileTabBar.tsx
import { LayoutGrid, FileText, ListChecks, Users, User, BookOpen, type LucideIcon } from "lucide-react";

export type TabKey = "home" | "exams" | "quizzes" | "subjects" | "classes" | "profile";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", icon: LayoutGrid },
  { key: "exams", label: "Exams", icon: FileText },
  { key: "quizzes", label: "Quizzes", icon: ListChecks },
  { key: "subjects", label: "Subjects", icon: BookOpen },
  { key: "classes", label: "Classes", icon: Users },
  { key: "profile", label: "Profile", icon: User },
];

interface MobileTabBarProps {
  active: TabKey;
  onNavigate?: (key: TabKey) => void;
}

export default function MobileTabBar({ active, onNavigate }: MobileTabBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[84px] border-t border-border bg-[hsl(var(--background)/0.92)] px-1.5 pb-[22px] pt-2 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'calc(22px + env(safe-area-inset-bottom, 0px))' }}>
      {TABS.map((t) => {
        const on = active === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onNavigate?.(t.key)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              on ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.1 : 1.8} />
            <span className="text-[10px] font-bold tracking-wide">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
