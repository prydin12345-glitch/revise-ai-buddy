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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-2 flex-wrap">
        {chips.map((chip) => (
          <Tooltip key={chip.label}>
            <TooltipTrigger asChild>
              <button
                onClick={() => chip.clickType && onCardClick?.(chip.clickType)}
                className="flex items-center gap-2 rounded-xl bg-card border border-border px-3.5 py-2.5 transition-all hover:border-primary/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                style={{ cursor: chip.clickType ? "pointer" : "default" }}
                tabIndex={chip.clickType ? 0 : -1}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${chip.colour}18` }}
                >
                  <chip.icon size={16} style={{ color: chip.colour }} strokeWidth={2} />
                </div>
                <span className="text-lg font-bold text-foreground tracking-tight whitespace-nowrap">
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
