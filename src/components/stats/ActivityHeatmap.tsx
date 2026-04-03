import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subWeeks, startOfWeek, addDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const WEEKS = 12;
const DAY_LABELS = ["M", "", "W", "", "F", "", ""];

const getColour = (hours: number): string => {
  if (hours === 0) return "hsl(var(--muted))";
  if (hours < 0.5) return "hsl(217 70% 25%)";
  if (hours < 1) return "hsl(217 70% 40%)";
  if (hours < 2) return "hsl(217 70% 55%)";
  return "hsl(217 70% 72%)";
};

export const ActivityHeatmap = () => {
  const [dailyData, setDailyData] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const since = subWeeks(new Date(), WEEKS).toISOString();

      const [{ data: submissions }, { data: practice }] = await Promise.all([
        supabase
          .from("exam_submissions")
          .select("submitted_at, time_taken_seconds")
          .eq("student_id", user.id)
          .eq("status", "graded")
          .gte("submitted_at", since),
        supabase
          .from("practice_set_progress")
          .select("completed_at, time_spent_seconds")
          .eq("user_id", user.id)
          .not("completed_at", "is", null)
          .gte("completed_at", since),
      ]);

      const map: Record<string, number> = {};

      submissions?.forEach((s) => {
        if (!s.submitted_at) return;
        const key = format(new Date(s.submitted_at), "yyyy-MM-dd");
        map[key] = (map[key] || 0) + (s.time_taken_seconds || 0) / 3600;
      });

      practice?.forEach((p) => {
        if (!p.completed_at) return;
        const key = format(new Date(p.completed_at), "yyyy-MM-dd");
        map[key] = (map[key] || 0) + (p.time_spent_seconds || 0) / 3600;
      });

      setDailyData(map);
    };
    fetch();
  }, []);

  // Build grid: 12 columns (weeks) × 7 rows (days)
  const today = new Date();
  const gridStart = startOfWeek(subWeeks(today, WEEKS - 1), { weekStartsOn: 1 });

  const columns: Array<Array<{ date: Date; key: string; hours: number }>> = [];
  for (let w = 0; w < WEEKS; w++) {
    const weekStart = addDays(gridStart, w * 7);
    const week: typeof columns[0] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const key = format(date, "yyyy-MM-dd");
      week.push({ date, key, hours: dailyData[key] || 0 });
    }
    columns.push(week);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex justify-between items-center">
        <div>
          <div className="text-sm font-semibold text-foreground">Study Activity</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Last 12 weeks</div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Less</span>
          {[0, 0.25, 0.75, 1.5, 2.5].map((h) => (
            <div
              key={h}
              className="w-[10px] h-[10px] rounded-[2px]"
              style={{ background: getColour(h) }}
            />
          ))}
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="px-5 py-4">
        <div className="flex gap-1">
          {/* Day labels column */}
          <div className="flex flex-col gap-[3px] mr-1 pt-0">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="text-[9px] text-muted-foreground leading-none flex items-center justify-end"
                style={{ height: 12, width: 12 }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <TooltipProvider delayDuration={100}>
            <div className="flex gap-[3px] flex-1">
              {columns.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px] flex-1">
                  {week.map((cell) => {
                    const isFuture = cell.date > today;
                    return (
                      <Tooltip key={cell.key}>
                        <TooltipTrigger asChild>
                          <div
                            className="rounded-[2px] transition-opacity hover:opacity-70"
                            style={{
                              aspectRatio: "1",
                              minHeight: 12,
                              background: isFuture
                                ? "hsl(var(--muted) / 0.3)"
                                : getColour(cell.hours),
                            }}
                          />
                        </TooltipTrigger>
                        {!isFuture && (
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">
                              {format(cell.date, "d MMM yyyy")}
                            </p>
                            <p className="text-muted-foreground">
                              {cell.hours > 0
                                ? `${cell.hours.toFixed(1)}h studied`
                                : "No activity"}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
