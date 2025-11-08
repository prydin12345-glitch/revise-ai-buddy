interface GoalPieChartProps {
  progress: number;
  target: number;
  color: string;
  size?: number;
}

export const GoalPieChart = ({ progress, target, color, size = 120 }: GoalPieChartProps) => {
  const percentage = Math.min((progress / target) * 100, 100);
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="12"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{Math.round(percentage)}%</span>
        <span className="text-xs text-muted-foreground mt-1 text-center">
          {progress}/{target}
        </span>
      </div>
    </div>
  );
};
