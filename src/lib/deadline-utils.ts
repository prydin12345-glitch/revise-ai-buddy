import { format, differenceInDays, isToday, isTomorrow, startOfDay, endOfDay, isBefore, isAfter } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Get the user's timezone, defaulting to Europe/London for UK support
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Europe/London";
  }
};

/**
 * Convert a UTC date to the user's local timezone
 */
export const toLocalTime = (date: Date | string, timezone?: string): Date => {
  const tz = timezone || getUserTimezone();
  const d = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(d, tz);
};

export interface DeadlineStatus {
  text: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  isOverdue: boolean;
  isUrgent: boolean;
}

/**
 * Calculate deadline status with proper timezone support
 */
export const getDeadlineStatus = (deadline: string | null, timezone?: string): DeadlineStatus => {
  if (!deadline) {
    return {
      text: "No deadline",
      variant: "secondary",
      className: "bg-muted/50 text-muted-foreground border-transparent",
      isOverdue: false,
      isUrgent: false,
    };
  }

  const tz = timezone || getUserTimezone();
  const deadlineDate = new Date(deadline);
  const now = new Date();
  
  // Get local versions for comparison
  const localDeadline = toLocalTime(deadlineDate, tz);
  const localNow = toLocalTime(now, tz);
  
  // Get start and end of today in local time
  const todayStart = startOfDay(localNow);
  const todayEnd = endOfDay(localNow);

  // Check if deadline is in the past
  if (isBefore(deadlineDate, now)) {
    const daysPast = Math.abs(differenceInDays(deadlineDate, now));
    return {
      text: daysPast === 0 ? "Overdue" : daysPast === 1 ? "Overdue by 1 day" : `Overdue by ${daysPast}d`,
      variant: "destructive",
      className: "bg-destructive/10 text-destructive border-destructive/20",
      isOverdue: true,
      isUrgent: true,
    };
  }

  // Check if deadline is today (using local time)
  const localDeadlineDay = startOfDay(localDeadline);
  if (localDeadlineDay.getTime() === todayStart.getTime()) {
    return {
      text: "Due today",
      variant: "default",
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      isOverdue: false,
      isUrgent: true,
    };
  }

  // Check if deadline is tomorrow
  const tomorrowStart = startOfDay(new Date(todayStart.getTime() + 24 * 60 * 60 * 1000));
  if (localDeadlineDay.getTime() === tomorrowStart.getTime()) {
    return {
      text: "Due tomorrow",
      variant: "default",
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      isOverdue: false,
      isUrgent: true,
    };
  }

  // Calculate days until deadline
  const daysUntil = differenceInDays(localDeadline, localNow);

  if (daysUntil <= 3) {
    return {
      text: `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      variant: "default",
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      isOverdue: false,
      isUrgent: true,
    };
  }

  if (daysUntil <= 7) {
    return {
      text: `Due in ${daysUntil} days`,
      variant: "secondary",
      className: "bg-muted/50 text-muted-foreground border-transparent",
      isOverdue: false,
      isUrgent: false,
    };
  }

  // More than 7 days away, show the date
  return {
    text: `Due ${format(localDeadline, "MMM d")}`,
    variant: "secondary",
    className: "bg-muted/50 text-muted-foreground border-transparent",
    isOverdue: false,
    isUrgent: false,
  };
};