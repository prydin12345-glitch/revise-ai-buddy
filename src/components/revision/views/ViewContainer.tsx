import { motion, AnimatePresence } from "framer-motion";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";

interface ViewContainerProps {
  viewMode: 'day' | 'week' | 'month';
  currentDate: Date;
  tasks: any[];
  nearestExam?: any;
  onTaskAction: (action: string, taskId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const viewVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

export const ViewContainer = ({ 
  viewMode, 
  currentDate, 
  tasks, 
  nearestExam, 
  onTaskAction,
  isExpanded,
  onToggleExpand
}: ViewContainerProps) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${viewMode}-${isExpanded}`}
        variants={viewVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {viewMode === 'day' && (
          <DayView
            currentDate={currentDate}
            tasks={tasks}
            nearestExam={nearestExam}
            onTaskAction={onTaskAction}
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
          />
        )}
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            tasks={tasks}
            onTaskAction={onTaskAction}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
