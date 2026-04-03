import { BookOpen } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";
import { useNavigate } from "react-router-dom";

interface SubjectPerformanceChartProps {
  data: Array<{
    name: string;
    value: number;
    count: number;
    avgScore: number;
    color: string;
  }>;
  viewMode: "score" | "count";
  onViewModeChange: (mode: "score" | "count") => void;
}

/** Semi-circular gauge SVG */
const SemiGauge = ({
  score,
  color,
  size = 120,
}: {
  score: number;
  color: string;
  size?: number;
}) => {
  const r = (size - 12) / 2;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const circumference = Math.PI * r; // half circle
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;

  return (
    <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={8}
        strokeLinecap="round"
      />
      {/* Value */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
      {/* Percentage text */}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        className="text-foreground"
        style={{ fontSize: size * 0.22, fontWeight: 700, fill: "currentColor" }}
      >
        {Math.round(score)}%
      </text>
      {/* Labels */}
      <text
        x={cx - r + 2}
        y={cy + 14}
        textAnchor="start"
        className="text-muted-foreground"
        style={{ fontSize: 9, fill: "currentColor" }}
      >
        Low
      </text>
      <text
        x={cx + r - 2}
        y={cy + 14}
        textAnchor="end"
        className="text-muted-foreground"
        style={{ fontSize: 9, fill: "currentColor" }}
      >
        High
      </text>
    </svg>
  );
};

export const SubjectPerformanceChart = ({
  data,
}: SubjectPerformanceChartProps) => {
  const navigate = useNavigate();
  const sorted = [...data].sort((a, b) => b.avgScore - a.avgScore);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="text-sm font-semibold text-foreground">
          Subject Performance
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Average score per subject
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-4 flex-1">
        {sorted.length === 0 ? (
          <EmptyChartState
            message="No exam data yet"
            icon={BookOpen}
            action={{
              label: "Create an exam",
              onClick: () => navigate("/my-exams"),
            }}
            height={200}
          />
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {sorted.map((subject) => {
              const gaugeColor =
                subject.avgScore >= 70
                  ? "hsl(142 71% 45%)"
                  : subject.avgScore >= 50
                  ? "hsl(25 95% 53%)"
                  : "hsl(0 84% 60%)";

              return (
                <div
                  key={subject.name}
                  className="flex flex-col items-center gap-1 min-w-[100px]"
                >
                  <SemiGauge
                    score={subject.avgScore}
                    color={gaugeColor}
                    size={100}
                  />
                  <span className="text-xs font-semibold text-foreground text-center leading-tight">
                    {subject.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {subject.count} exam{subject.count !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
