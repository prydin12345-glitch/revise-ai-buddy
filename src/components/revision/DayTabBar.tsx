import { Button } from "@/components/ui/button";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface DayTabBarProps {
  currentWeekStart: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  viewMode: "week" | "day";
}

export function DayTabBar({ currentWeekStart, selectedDate, onDateSelect, viewMode }: DayTabBarProps) {
  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  
  // For week view, show Mon-Fri (5 days), for day view show all 7 days
  const daysToShow = viewMode === "week" ? 5 : 7;
  const weekDays = Array.from({ length: daysToShow }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex items-center gap-1 border-b">
      {weekDays.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const dayNumber = format(date, 'd');
        const dayName = format(date, 'EEE');
        
        return (
          <Button
            key={date.toISOString()}
            variant="ghost"
            onClick={() => onDateSelect(date)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 rounded-none relative",
              "hover:bg-muted/50 transition-colors",
              isSelected && "text-primary font-semibold"
            )}
          >
            <span className="text-lg">{dayNumber}</span>
            <span className="text-xs">{dayName}</span>
            
            {/* Blue underline for selected day */}
            {isSelected && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </Button>
        );
      })}
    </div>
  );
}
