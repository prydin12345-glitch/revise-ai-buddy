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
}

const viewVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

export const ViewContainer = ({ viewMode, currentDate, tasks, nearestExam, onTaskAction }: ViewContainerProps) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewMode}
        variants={viewVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.2 }}
      >
        {viewMode === 'day' && (
          <DayView
            currentDate={currentDate}
            tasks={tasks}
            nearestExam={nearestExam}
            onTaskAction={onTaskAction}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            tasks={tasks}
            onTaskAction={onTaskAction}
          />
        )}
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            tasks={tasks}
            onTaskAction={onTaskAction}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
