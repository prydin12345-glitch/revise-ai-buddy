import { useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, isSameMonth, isValid, startOfMonth } from "date-fns";
import type { DayContentProps } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import type { GroupAssignment, StudentGroup } from "@/pages/MyClasses";
import "@/styles/class-deadlines.css";

interface ClassDeadlineCalendarProps {
  assignments: GroupAssignment[];
  groups: StudentGroup[];
  getSubjectColor: (name: string) => string;
  month: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
}

/** A view of the already-authorized assignment deadlines, never a lesson timetable. */
export function ClassDeadlineCalendar({
  assignments,
  groups,
  getSubjectColor,
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
}: ClassDeadlineCalendarProps) {
  const deadlines = useMemo(() => {
    const days = new Map<string, { colours: string[]; count: number }>();
    const groupById = new Map(groups.map(group => [group.id, group]));

    assignments.forEach(assignment => {
      if (!assignment.deadline) return;
      const date = new Date(assignment.deadline);
      if (!isValid(date)) return;
      const key = format(date, "yyyy-MM-dd");
      const subject = groupById.get(assignment.group_id)?.subjects_covered?.[0];
      const colour = subject?.color || (subject ? getSubjectColor(subject.name) : "hsl(var(--primary))");
      const day = days.get(key) || { colours: [], count: 0 };
      if (!day.colours.includes(colour)) day.colours.push(colour);
      day.count += 1;
      days.set(key, day);
    });

    return days;
  }, [assignments, groups, getSubjectColor]);

  const monthHasDeadlines = assignments.some(assignment => {
    if (!assignment.deadline) return false;
    const deadline = new Date(assignment.deadline);
    return isValid(deadline) && isSameMonth(deadline, month);
  });

  const dayLabel = (date: Date) => {
    const count = deadlines.get(format(date, "yyyy-MM-dd"))?.count || 0;
    return `${format(date, "EEEE, d MMMM yyyy")}${count ? `, ${count} ${count === 1 ? "assignment" : "assignments"} due` : ""}`;
  };

  const DayContent = ({ date }: DayContentProps) => {
    const day = deadlines.get(format(date, "yyyy-MM-dd"));
    return (
      <>
        {/* DayPicker 8 does not apply labelDay to its native gridcell button.
            Keep its keyboard implementation and supply the accessible name here. */}
        <span className="sr-only">{dayLabel(date)}</span>
        <span aria-hidden="true" className={day ? "class-deadline-day-number has-deadline" : "class-deadline-day-number"}>
          {format(date, "d")}
        </span>
        {day && (
          <span className="class-deadline-dots" aria-hidden="true">
            {day.colours.slice(0, 3).map(colour => (
              <span key={colour} style={{ backgroundColor: colour }} />
            ))}
          </span>
        )}
      </>
    );
  };

  return (
    <section className="class-deadline-calendar" aria-label="Assignment deadline calendar">
      <Calendar
        mode="single"
        month={month}
        onMonthChange={onMonthChange}
        selected={selectedDate}
        onSelect={date => {
          if (date && !isSameMonth(date, month)) onMonthChange(startOfMonth(date));
          onSelectDate(date);
        }}
        weekStartsOn={1}
        fixedWeeks
        className="class-deadline-month"
        classNames={{
          months: "class-deadline-months",
          month: "class-deadline-month-body",
          caption: "class-deadline-caption",
          caption_label: "class-deadline-caption-label",
          nav: "class-deadline-nav",
          nav_button: "class-deadline-nav-button",
          nav_button_previous: "class-deadline-nav-previous",
          nav_button_next: "class-deadline-nav-next",
          table: "class-deadline-table",
          head_row: "class-deadline-weekdays",
          head_cell: "class-deadline-weekday",
          row: "class-deadline-week",
          cell: "class-deadline-cell",
          day: "class-deadline-day",
          day_selected: "class-deadline-day-selected",
          day_today: "class-deadline-day-today",
          day_outside: "class-deadline-day-outside",
          day_disabled: "class-deadline-day-disabled",
          day_hidden: "class-deadline-day-hidden",
        }}
        labels={{
          labelDay: dayLabel,
          labelPrevious: () => "Previous month",
          labelNext: () => "Next month",
        }}
        components={{
          DayContent,
          IconLeft: () => <ChevronLeft aria-hidden="true" />,
          IconRight: () => <ChevronRight aria-hidden="true" />,
        }}
      />
      <div className="class-deadline-calendar-footer">
        <span className="class-deadline-legend">
          <span aria-hidden="true" /> Assignment due
        </span>
        {selectedDate && (
          <button type="button" className="class-deadline-clear" onClick={() => onSelectDate(undefined)}>
            Show whole month <X aria-hidden="true" />
          </button>
        )}
      </div>
      {!monthHasDeadlines && <p className="class-deadline-calendar-empty">No deadlines this month.</p>}
      <p className="class-deadline-timezone">Dates and times use your device’s local time.</p>
    </section>
  );
}
