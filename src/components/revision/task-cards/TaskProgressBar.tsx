import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TaskProgressBarProps {
  progress: number;
  color: string;
  className?: string;
}

export const TaskProgressBar = ({ progress, color, className }: TaskProgressBarProps) => {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <Progress 
        value={progress} 
        className="h-1.5"
        style={{
          backgroundColor: `${color}20`
        }}
      />
    </div>
  );
};
