import { Progress } from "@/components/ui/progress";

interface SubjectProgress {
  name: string;
  color: string;
  completed: number;
  total: number;
}

interface SubjectProgressBreakdownProps {
  subjects: SubjectProgress[];
}

export const SubjectProgressBreakdown = ({ subjects }: SubjectProgressBreakdownProps) => {
  if (subjects.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Subject Breakdown</h4>
      <div className="space-y-2">
        {subjects.map((subject) => {
          const percentage = subject.total > 0 
            ? Math.round((subject.completed / subject.total) * 100) 
            : 0;
          
          return (
            <div key={subject.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground font-medium flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: subject.color }}
                  />
                  {subject.name}
                </span>
                <span className="text-muted-foreground">
                  {subject.completed}/{subject.total} • {percentage}%
                </span>
              </div>
              <Progress 
                value={percentage} 
                className="h-1.5"
                style={{ 
                  '--progress-color': subject.color 
                } as React.CSSProperties}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
