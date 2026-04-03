import { FileText, TrendingUp, Clock, Flame, Star, LucideIcon } from "lucide-react";

interface TopStatsCardsProps {
  totalExams: number;
  completedExams: number;
  inProgressExams: number;
  currentStreak: number;
  longestStreak: number;
  avgScore?: number;
  totalStudyHours?: number;
  bestSubject?: { name: string; avgScore: number; color: string } | null;
  onCardClick?: (type: "exams" | "scores" | "study-hours" | "streak") => void;
}

interface ChipDef {
  label: string;
  value: string;
  icon: LucideIcon;
  colour: string;
  trend?: string | null;
  clickType?: "exams" | "scores" | "study-hours" | "streak";
}

export const TopStatsCards = ({
  totalExams,
  avgScore = 0,
  totalStudyHours = 0,
  currentStreak,
  bestSubject,
  onCardClick,
}: TopStatsCardsProps) => {
  const scoreColour =
    avgScore >= 70 ? "#22c55e" : avgScore >= 50 ? "#f97316" : "#ef4444";

  const chips: ChipDef[] = [
    {
      label: "Exams Taken",
      value: String(totalExams),
      icon: FileText,
      colour: "#3b82f6",
      clickType: "exams",
    },
    {
      label: "Avg Score",
      value: avgScore > 0 ? `${avgScore}%` : "—",
      icon: TrendingUp,
      colour: avgScore > 0 ? scoreColour : "#6b7280",
      clickType: "scores",
    },
    {
      label: "Study Hours",
      value: totalStudyHours > 0 ? `${totalStudyHours.toFixed(1)}h` : "0h",
      icon: Clock,
      colour: "#8b5cf6",
      clickType: "study-hours",
    },
    {
      label: "Streak",
      value: `${currentStreak}d`,
      icon: Flame,
      colour: "#f59e0b",
      clickType: "streak",
    },
    {
      label: "Best Subject",
      value: bestSubject?.name ?? "—",
      icon: Star,
      colour: bestSubject?.color ?? "#22c55e",
      trend: bestSubject ? `${Math.round(bestSubject.avgScore)}%` : null,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2.5">
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={() => chip.clickType && onCardClick?.(chip.clickType)}
          className="flex items-center gap-2.5 rounded-[10px] bg-card border border-border text-left transition-all hover:border-primary/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary flex-1 min-w-[140px]"
          style={{
            padding: "12px 16px",
            borderLeftWidth: 3,
            borderLeftColor: chip.colour,
            cursor: chip.clickType ? "pointer" : "default",
          }}
          tabIndex={chip.clickType ? 0 : -1}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: chip.colour + "18" }}
          >
            <chip.icon size={16} color={chip.colour} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">
              {chip.label}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-foreground tracking-tight truncate max-w-[100px]">
                {chip.value}
              </span>
              {chip.trend && (
                <span
                  className="text-[11px] font-medium"
                  style={{ color: chip.colour }}
                >
                  {chip.trend}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
