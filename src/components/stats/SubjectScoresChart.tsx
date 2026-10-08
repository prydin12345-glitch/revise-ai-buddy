import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartDataTable } from "./ChartDataTable";

interface Props {
  data: { name: string; avgScore: number; count: number }[];
  viewMode: "score" | "count";
  onViewModeChange: (mode: "score" | "count") => void;
}

const ScoreMarker = ({ x, y, width }: any) => (
  <circle
    cx={x + width / 2}
    cy={y}
    r="5"
    fill="var(--stats-series-5)"
    stroke="hsl(var(--card))"
    strokeWidth="3"
  />
);

/** Existing subject averages/counts, presented as compact comparison bars. */
export function SubjectScoresChart({
  data,
  viewMode,
  onViewModeChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const scoreMode = viewMode === "score";
  const rows = data.filter((subject) => subject.count > 0);
  const key = scoreMode ? "avgScore" : "count";
  const unit = scoreMode ? "%" : "";
  const chart = (height: number) =>
    rows.length ? (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          accessibilityLayer
          data={rows}
          margin={{ top: 12, left: 0, right: 10, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(name) =>
              name.length > 11 ? `${name.slice(0, 9)}…` : name
            }
          />
          <YAxis
            domain={scoreMode ? [0, 100] : [0, "auto"]}
            width={42}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickFormatter={(value) => `${value}${unit}`}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [
              `${scoreMode ? Math.round(value) : value}${unit}`,
              scoreMode ? "Average exam score" : "Completed exams",
            ]}
          />
          <Bar
            dataKey={key}
            fill="var(--stats-series-5)"
            background={{ fill: "var(--stats-bar-track)" }}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
            maxBarSize={32}
          >
            <LabelList dataKey={key} content={<ScoreMarker />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <p className="stats-chart-empty" role="status">
        Complete an exam to compare your subjects.
      </p>
    );

  return (
    <>
      <section
        className="stats-panel stats-subject-scores"
        aria-label="Subject performance comparison"
      >
        <div className="stats-panel-heading stats-chart-heading">
          <div>
            <h2>Subject performance</h2>
            <p>
              {scoreMode
                ? "Average graded-exam score"
                : "Graded exams by subject"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="stats-chart-control"
            aria-label="Expand subject comparison"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="stats-chart-body">{chart(135)}</div>
        <div className="stats-chart-footer">
          <div
            className="stats-mode-control"
            aria-label="Subject comparison measure"
          >
            <button
              type="button"
              aria-pressed={scoreMode}
              onClick={() => onViewModeChange("score")}
            >
              Score
            </button>
            <button
              type="button"
              aria-pressed={!scoreMode}
              onClick={() => onViewModeChange("count")}
            >
              Exams
            </button>
          </div>
          <ChartDataTable
            caption="Subject performance comparison"
            rows={rows}
            periodKey="name"
            periodLabel="Subject"
            series={[
              { key, label: scoreMode ? "Average score" : "Completed exams" },
            ]}
            unit={unit}
          />
        </div>
      </section>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="stats-chart-dialog max-w-[800px] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Subject performance comparison</DialogTitle>
            <DialogDescription>
              {scoreMode
                ? "Existing average graded-exam score for each subject."
                : "Existing number of graded exams for each subject."}
            </DialogDescription>
          </DialogHeader>
          {chart(350)}
          <ChartDataTable
            caption="Subject performance comparison"
            rows={rows}
            periodKey="name"
            periodLabel="Subject"
            series={[
              { key, label: scoreMode ? "Average score" : "Completed exams" },
            ]}
            unit={unit}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
