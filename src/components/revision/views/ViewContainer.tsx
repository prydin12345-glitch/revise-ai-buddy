import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { TopBar } from "../TopBar";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewContainerProps {
  viewMode: 'day' | 'week' | 'month';
  currentDate: Date;
  tasks: any[];
  nearestExam?: {
    title: string;
    daysUntil: number;
  };
  onTaskAction: (action: string, taskId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  subjects: string[];
  selectedSubjects: string[];
  onSubjectsChange: (subjects: string[]) => void;
  dateRange: { from: Date | null; to: Date | null };
  onDateRangeChange: (range: { from: Date | null; to: Date | null }) => void;
  completionStatus: 'all' | 'completed' | 'pending';
  onCompletionStatusChange: (status: 'all' | 'completed' | 'pending') => void;
  linkedContent: 'all' | 'exam' | 'practice' | 'none';
  onLinkedContentChange: (filter: 'all' | 'exam' | 'practice' | 'none') => void;
  activeFilterCount: number;
  highlightedTaskId: string | null;
}

export const ViewContainer = ({
  viewMode,
  currentDate,
  tasks,
  nearestExam,
  onTaskAction,
  isExpanded,
  onToggleExpand,
  searchQuery,
  onSearchChange,
  showCompleted,
  onToggleCompleted,
  subjects,
  selectedSubjects,
  onSubjectsChange,
  dateRange,
  onDateRangeChange,
  completionStatus,
  onCompletionStatusChange,
  linkedContent,
  onLinkedContentChange,
  activeFilterCount,
  highlightedTaskId
}: ViewContainerProps) => {
  return (
    <div className="space-y-4">
      <TopBar
        currentDate={currentDate}
        onDateChange={() => {}}
        nearestExam={nearestExam}
        onQuickAdd={() => {}}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        showCompleted={showCompleted}
        onToggleCompleted={onToggleCompleted}
        subjects={subjects}
        selectedSubjects={selectedSubjects}
        onSubjectsChange={onSubjectsChange}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        completionStatus={completionStatus}
        onCompletionStatusChange={onCompletionStatusChange}
        linkedContent={linkedContent}
        onLinkedContentChange={onLinkedContentChange}
        activeFilterCount={activeFilterCount}
      />

      {/* Expand/Collapse Button */}
      <div className="flex justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onToggleExpand}
          className="gap-2"
        >
          {isExpanded ? (
            <>
              <Minimize2 className="h-4 w-4" />
              Collapse
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              Expand
            </>
          )}
        </Button>
      </div>

      {viewMode === 'day' && (
        <DayView 
          currentDate={currentDate}
          tasks={tasks}
          onTaskAction={onTaskAction}
          highlightedTaskId={highlightedTaskId}
        />
      )}
      {viewMode === 'week' && (
        <WeekView 
          currentDate={currentDate}
          tasks={tasks}
          onTaskAction={onTaskAction}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          highlightedTaskId={highlightedTaskId}
        />
      )}
      {viewMode === 'month' && (
        <MonthView 
          currentDate={currentDate}
          tasks={tasks}
          onTaskAction={onTaskAction}
          highlightedTaskId={highlightedTaskId}
        />
      )}
    </div>
  );
};
