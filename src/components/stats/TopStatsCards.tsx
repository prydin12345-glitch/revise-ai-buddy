import { FileText, TrendingUp, Clock, Flame, Star, LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  /**
   * `wrap` (default) — desktop chip row, flex-wrap.
   * `grid` — mobile 2-column scoreboard grid with consistent cell heights.
   * `grid-no-score` — same as `grid` but excludes "Average Score" (used when a hero card already shows it).
   */
  variant?: "wrap" | "grid" | "grid-no-score";
}

interface ChipDef {
  label: string;
  value: string;
  icon: LucideIcon;
  colour: string;
  clickType?: "exams" | "scores" | "study-hours" | "streak";
}

export const TopStatsCards = ({
  totalExams,
  avgScore = 0,
  totalStudyHours = 0,
  currentStreak,
  bestSubject,
  onCardClick,
  variant = "wrap",
}: TopStatsCardsProps) => {
  const scoreColour =
    avgScore >= 70 ? "hsl(142 71% 45%)" : avgScore >= 50 ? "hsl(25 95% 53%)" : "hsl(0 84% 60%)";

  const chips: ChipDef[] = [
    {
      label: "Exams Taken",
      value: String(totalExams),
      icon: FileText,
      colour: "hsl(217 91% 60%)",
      clickType: "exams",
    },
    {
      label: "Average Score",
      value: avgScore > 0 ? `${avgScore}%` : "—",
      icon: TrendingUp,
      colour: avgScore > 0 ? scoreColour : "hsl(var(--muted-foreground))",
      clickType: "scores",
    },
    {
      label: "Study Hours",
      value: totalStudyHours > 0 ? `${totalStudyHours.toFixed(1)}h` : "0h",
      icon: Clock,
      colour: "hsl(263 70% 50%)",
      clickType: "study-hours",
    },
    {
      label: `Streak · ${currentStreak} days`,
      value: `${currentStreak}`,
      icon: Flame,
      colour: "hsl(38 92% 50%)",
      clickType: "streak",
    },
    {
      label: bestSubject ? `Best: ${bestSubject.name} · ${Math.round(bestSubject.avgScore)}%` : "Best Subject",
      value: bestSubject ? `${Math.round(bestSubject.avgScore)}%` : "—",
      icon: Star,
      colour: bestSubject?.color ?? "hsl(142 71% 45%)",
    },
  ];

  // Visible chips depending on variant
  const visibleChips =
    variant === "grid-no-score"
      ? chips.filter((c) => c.clickType !== "scores")
      : chips;

  // Mobile grid: 2-col scoreboard with consistent cell heights
  if (variant === "grid" || variant === "grid-no-score") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {visibleChips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => chip.clickType && onCardClick?.(chip.clickType)}
            className="flex flex-col items-start justify-between gap-1.5 rounded-xl bg-card border border-border p-3 text-left transition-all hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              cursor: chip.clickType ? "pointer" : "default",
              borderLeft: `3px solid ${chip.colour}`,
              minHeight: 84,
            }}
            tabIndex={chip.clickType ? 0 : -1}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${chip.colour}18` }}
            >
              <chip.icon size={15} style={{ color: chip.colour }} strokeWidth={2} />
            </div>
            <div className="w-full">
              <div
                className="font-extrabold tracking-tight"
                style={{ fontSize: 22, lineHeight: 1, color: chip.colour, letterSpacing: "-0.5px" }}
              >
                {chip.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 truncate">
                {chip.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Desktop wrap variant (unchanged)
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-2.5 flex-wrap">
        {visibleChips.map((chip) => (
          <Tooltip key={chip.label}>
            <TooltipTrigger asChild>
              <button
                onClick={() => chip.clickType && onCardClick?.(chip.clickType)}
                className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-3.5 transition-all hover:border-primary/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  cursor: chip.clickType ? "pointer" : "default",
                  borderLeft: `3px solid ${chip.colour}`,
                }}
                tabIndex={chip.clickType ? 0 : -1}
              >
                <div
                  className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ background: `${chip.colour}18` }}
                >
                  <chip.icon size={18} style={{ color: chip.colour }} strokeWidth={2} />
                </div>
                <span
                  className="font-extrabold tracking-tight whitespace-nowrap"
                  style={{ fontSize: 24, lineHeight: 1, color: chip.colour, letterSpacing: "-0.5px" }}
                >
                  {chip.value}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-medium">
              {chip.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};