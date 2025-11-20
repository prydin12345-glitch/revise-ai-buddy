import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";

interface ViewContainerProps {
  viewMode: 'day' | 'week' | 'month';
  currentDate: Date;
  tasks: any[];
  onTaskAction: (action: string, taskId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  highlightedTaskId: string | null;
}

export const ViewContainer = ({
  viewMode,
  currentDate,
  tasks,
  onTaskAction,
  isExpanded,
  onToggleExpand,
  highlightedTaskId
}: ViewContainerProps) => {
  return (
    <>
      {viewMode === 'day' && (
        <DayView 
          currentDate={currentDate}
          tasks={tasks}
          onTaskAction={onTaskAction}
          highlightedTaskId={highlightedTaskId}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
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
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
        />
      )}
    </>
  );
};
