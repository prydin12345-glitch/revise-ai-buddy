import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
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
  const strokeWidth = 20;
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size * 0.55;
  const circumference = Math.PI * r;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;

  const angleRad = Math.PI * (1 - Math.min(score, 100) / 100);
  const dotX = cx + r * Math.cos(Math.PI - angleRad);
  const dotY = cy - r * Math.sin(Math.PI - angleRad);

  const gradientId = `gauge-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const trackGradId = `track-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      width={size}
      height={size * 0.58}
      viewBox={`0 0 ${size} ${size * 0.58}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={trackGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity={0.6} />
          <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity={1} />
        </linearGradient>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>

      <path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 8}
        strokeLinecap="round"
        opacity={0.06}
      />

      <path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke={`url(#${trackGradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      <motion.path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />

      {score > 2 && score < 98 && (
        <motion.circle
          cx={dotX}
          cy={dotY}
          r={strokeWidth / 2 + 2}
          fill="white"
          stroke={color}
          strokeWidth={3}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        />
      )}

      <text
        x={cx}
        y={cy - size * 0.04}
        textAnchor="middle"
        fontSize={size * 0.2}
        fontWeight={800}
        fill="hsl(var(--foreground))"
        letterSpacing={-2}
      >
        {Math.round(score)}%
      </text>

      <text
        x={strokeWidth}
        y={cy + strokeWidth + 10}
        fontSize={size * 0.048}
        fontWeight={500}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
      >
        Low
      </text>

      <text
        x={size - strokeWidth}
        y={cy + strokeWidth + 10}
        fontSize={size * 0.048}
        fontWeight={500}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
      >
        High
      </text>

      <text
        x={cx}
        y={cy + size * 0.04}
        textAnchor="middle"
        fontSize={size * 0.052}
        fontWeight={500}
        fill={color}
        opacity={0.8}
      >
        {score >= 70 ? "Strong" : score >= 50 ? "Developing" : "Needs Work"}
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

  const goTo = (newIndex: number, dir: number) => {
    if (sorted.length === 0) return;
    setDirection(dir);
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col"
    >
      {/* Header */}
      <div className="px-[18px] py-3.5 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground" style={{ letterSpacing: "-0.2px" }}>
            Subject Performance
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Average score per subject
          </div>
        </div>

        {sorted.length > 0 && (
          <div className="flex items-center gap-2">
            {sorted.length > 1 && (
              <button
                onClick={() => goTo((activeIndex - 1 + sorted.length) % sorted.length, -1)}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 transition-colors flex-shrink-0"
                style={{ border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
              >
                <ChevronLeft size={14} />
              </button>
            )}

            <div
              className="text-sm font-semibold text-center"
              style={{
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: gaugeColor,
              }}
            >
              {sorted[activeIndex]?.name}
            </div>

            {sorted.length > 1 && (
              <button
                onClick={() => goTo((activeIndex + 1) % sorted.length, 1)}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 transition-colors flex-shrink-0"
                style={{ border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative px-4 py-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-5 gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <BarChart2 size={22} className="text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground mb-1">
                No exam data yet
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
                Complete an exam to see your subject performance here
              </div>
            </div>
            <button
              onClick={() => navigate("/my-exams")}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg mt-1"
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Create an exam
            </button>
          </div>
        ) : (
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
              <div className="text-center mt-1">
                <span className="text-xs text-muted-foreground">
                  {subject.count} exam{subject.count !== 1 ? "s" : ""}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Footer — subject pills */}
      {sorted.length > 1 && (
        <div
          className="px-3.5 pb-3.5 pt-2.5 border-t border-border flex gap-1.5 flex-shrink-0"
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {sorted.map((s, i) => {
            const isActive = i === activeIndex;
            const pillColor =
              s.avgScore >= 70
                ? "hsl(142 71% 45%)"
                : s.avgScore >= 50
                ? "hsl(25 95% 53%)"
                : "hsl(0 84% 60%)";

            return (
              <button
                key={s.name}
                onClick={() => goTo(i, i > activeIndex ? 1 : -1)}
                className="flex-shrink-0 text-xs"
                style={{
                  padding: "4px 12px",
                  borderRadius: 99,
                  border: `1px solid ${isActive ? pillColor : "hsl(var(--border))"}`,
                  background: isActive ? pillColor + "18" : "transparent",
                  color: isActive ? pillColor : "hsl(var(--muted-foreground))",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
