import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
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

const useGaugeSize = () => {
  const [size, setSize] = useState(260);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setSize(160);
      else if (w < 640) setSize(190);
      else if (w < 1024) setSize(220);
      else setSize(260);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
};

const SemiGauge = ({
  score,
  color,
  size = 260,
  examCount,
}: {
  score: number;
  color: string;
  size?: number;
  examCount: number;
}) => {
  const strokeWidth = 20;
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size * 0.55;
  const circumference = Math.PI * r;
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (clampedScore / 100) * circumference;

  // Indicator dot: angle from π (left=0%) to 0 (right=100%)
  const angle = Math.PI * (1 - clampedScore / 100);
  const dotX = cx + r * Math.cos(angle);
  const dotY = cy - r * Math.sin(angle);

  const gradientId = `gauge-grad-${size}`;
  const trackGradId = `track-grad-${size}`;

  const descriptor = score >= 70 ? "Strong" : score >= 50 ? "Developing" : "Needs Work";

  // Right-side info — pushed further right for breathing room
  const infoX = size - strokeWidth + 30;
  const infoY = cy - 10;

  return (
    <svg
      width={size + 120}
      height={size * 0.62}
      viewBox={`0 0 ${size + 120} ${size * 0.62}`}
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

      {/* Outer glow */}
      <path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 8}
        strokeLinecap="round"
        opacity={0.06}
      />

      {/* Track arc */}
      <path
        d={`M ${strokeWidth} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth} ${cy}`}
        fill="none"
        stroke={`url(#${trackGradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Value arc */}
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

      {/* Indicator dot */}
      {clampedScore > 3 && clampedScore < 97 && (
        <motion.circle
          cx={dotX}
          cy={dotY}
          r={strokeWidth / 2 + 2}
          fill="hsl(var(--card))"
          stroke={color}
          strokeWidth={3}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        />
      )}

      {/* Score percentage */}
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

      {/* Low label */}
      <text
        x={strokeWidth}
        y={cy + strokeWidth + 14}
        fontSize={size * 0.048}
        fontWeight={500}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
      >
        Low
      </text>

      {/* High label */}
      <text
        x={size - strokeWidth}
        y={cy + strokeWidth + 14}
        fontSize={size * 0.048}
        fontWeight={500}
        fill="hsl(var(--muted-foreground))"
        textAnchor="middle"
      >
        High
      </text>

      {/* Right-side info: descriptor + exam count */}
      <text
        x={infoX}
        y={infoY}
        fontSize={13}
        fontWeight={600}
        fill={color}
        textAnchor="start"
      >
        {descriptor}
      </text>
      <text
        x={infoX}
        y={infoY + 18}
        fontSize={11}
        fontWeight={400}
        fill="hsl(var(--muted-foreground))"
        textAnchor="start"
      >
        {examCount} exam{examCount !== 1 ? "s" : ""}
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
      {/* Header — title left, subject name right (no arrows) */}
      <div className="px-[18px] py-3.5 border-b border-border flex-shrink-0 flex items-center justify-between gap-3">
        <div className="flex-shrink-0">
          <div className="text-sm font-semibold text-foreground" style={{ letterSpacing: "-0.2px" }}>
            Subject Performance
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Average score per subject
          </div>
        </div>

        {sorted.length > 0 && (
          <div
            className="text-sm font-semibold min-w-0"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: gaugeColor,
              maxWidth: 180,
              textAlign: "right",
            }}
            title={sorted[activeIndex]?.name}
          >
            {sorted[activeIndex]?.name}
          </div>
        )}
      </div>

      {/* Content — arrows flanking the gauge */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative px-2 py-6">
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
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg mt-1 border-0 cursor-pointer"
              style={{ fontFamily: "inherit" }}
            >
              Create an exam
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 w-full justify-center">
            {/* Left arrow */}
            {sorted.length > 1 && (
              <button
                onClick={() => goTo((activeIndex - 1 + sorted.length) % sorted.length, -1)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 transition-colors flex-shrink-0 border-0 cursor-pointer text-muted-foreground"
              >
                <ChevronLeft size={18} />
              </button>
            )}

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
                  examCount={subject.count}
                />
              </motion.div>
            </AnimatePresence>

            {/* Right arrow */}
            {sorted.length > 1 && (
              <button
                onClick={() => goTo((activeIndex + 1) % sorted.length, 1)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 transition-colors flex-shrink-0 border-0 cursor-pointer text-muted-foreground"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer — Combined Performance label */}
      {sorted.length > 0 && (
        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border flex-shrink-0">
          <div className="text-xs text-muted-foreground text-center">
            Combined Performance · All exam profiles
          </div>
        </div>
      )}
    </motion.div>
  );
};
