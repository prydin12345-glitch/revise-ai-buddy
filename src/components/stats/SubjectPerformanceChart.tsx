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

const SemiGauge = ({
  score,
  color,
  size = 160,
}: {
  score: number;
  color: string;
  size?: number;
}) => {
  const strokeWidth = 14;
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2 + size * 0.08;
  const circumference = Math.PI * r;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  const h = size * 0.65;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
      {/* Track */}
      <path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Value */}
      <path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      {/* Percentage */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize={size * 0.18}
        fontWeight={800}
        fill="hsl(var(--foreground))"
        letterSpacing={-1}
      >
        {Math.round(score)}%
      </text>
      {/* Low */}
      <text
        x={strokeWidth}
        y={cy + 18}
        fontSize={size * 0.075}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
      >
        Low
      </text>
      {/* High */}
      <text
        x={size - strokeWidth}
        y={cy + 18}
        fontSize={size * 0.075}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
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
      <div className="px-[18px] py-3.5 border-b border-border flex-shrink-0">
        <div className="text-[13px] font-semibold text-foreground" style={{ letterSpacing: "-0.2px" }}>
          Subject Performance
        </div>
        <div className="text-[11px] text-muted-foreground mt-px">
          Average score per subject
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
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
          <div className="flex flex-wrap justify-around gap-2 w-full">
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
                  className="flex flex-col items-center gap-1.5"
                  style={{ flex: "1 1 140px", minWidth: 120, padding: "12px 8px" }}
                >
                  <SemiGauge score={subject.avgScore} color={gaugeColor} size={160} />
                  <span
                    className="text-[13px] font-semibold text-foreground text-center leading-tight"
                    style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {subject.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
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