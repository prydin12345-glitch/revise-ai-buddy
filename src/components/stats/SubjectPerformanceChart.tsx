import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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
  size = 260,
}: {
  score: number;
  color: string;
  size?: number;
}) => {
  const strokeWidth = 22;
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2 + size * 0.05;
  const circumference = Math.PI * r;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  const h = size * 0.58;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="overflow-visible">
      {/* Track */}
      <path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Value arc */}
      <motion.path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      {/* Percentage text */}
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fontSize={size * 0.2}
        fontWeight={800}
        fill="hsl(var(--foreground))"
        letterSpacing={-2}
      >
        {Math.round(score)}%
      </text>
      {/* Low label */}
      <text
        x={strokeWidth + 4}
        y={cy + 28}
        fontSize={13}
        fontWeight={500}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
      >
        Low
      </text>
      {/* High label */}
      <text
        x={size - strokeWidth - 4}
        y={cy + 28}
        fontSize={13}
        fontWeight={500}
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const goTo = (newIndex: number) => {
    if (sorted.length === 0) return;
    setDirection(newIndex > activeIndex ? 1 : -1);
    setActiveIndex(((newIndex % sorted.length) + sorted.length) % sorted.length);
  };

  const subject = sorted[activeIndex];

  const gaugeColor = subject
    ? subject.avgScore >= 70
      ? "hsl(142 71% 45%)"
      : subject.avgScore >= 50
      ? "hsl(25 95% 53%)"
      : "hsl(0 84% 60%)"
    : "hsl(var(--muted-foreground))";

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-[18px] py-3.5 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-foreground" style={{ letterSpacing: "-0.2px" }}>
            Subject Performance
          </div>
          <div className="text-[11px] text-muted-foreground mt-px">
            Average score per subject
          </div>
        </div>
        {/* Dot indicators */}
        {sorted.length > 1 && (
          <div className="flex items-center gap-1.5">
            {sorted.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="transition-all duration-200"
                style={{
                  width: i === activeIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 99,
                  background: i === activeIndex
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground) / 0.3)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative px-4 py-6">
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
          <>
            {/* Left arrow */}
            {sorted.length > 1 && (
              <button
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {/* Gauge + labels */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex flex-col items-center"
              >
                <SemiGauge
                  score={subject.avgScore}
                  color={gaugeColor}
                  size={260}
                />
                <div className="text-center mt-1 max-w-[260px]">
                  <div className="text-[15px] font-bold text-foreground leading-snug">
                    {subject.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    {subject.count} exam{subject.count !== 1 ? "s" : ""}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Right arrow */}
            {sorted.length > 1 && (
              <button
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
