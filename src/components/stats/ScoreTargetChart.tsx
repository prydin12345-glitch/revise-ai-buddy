import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Maximize2, FileText } from "lucide-react";
import { EmptyChartState } from "./EmptyChartState";
import { ChartDataTable } from "./ChartDataTable";
import { ChartContent } from "./ExamResultsChart";
import { chartColour, chartDash } from "./chart-palette";
import { useNavigate } from "react-router-dom";
import {
  useGradeSettings,
  type SubjectGradeSettings,
} from "@/hooks/useGradeSettings";
import {
  boundariesFor,
  getScale,
  projectGrade,
  type GradeScaleId,
} from "@/lib/grade-scales";

interface Props {
  data: Array<{ period: string; [key: string]: number | string }>;
  subjects: Array<{ name: string; color: string; avgScore?: number }>;
  timeRange: "weekly" | "monthly" | "yearly";
  onTimeRangeChange: (range: "weekly" | "monthly" | "yearly") => void;
  revisionGoals: Array<{
    subject: string;
    targetPercentage: number;
    deadline: string;
    currentAverage: number;
    color: string;
  }>;
  defaultScaleId?: GradeScaleId;
}

/** Presentation only: select existing values and reuse the existing grade projection. */
export function scoreTargetView(
  data: Props["data"],
  subject: Props["subjects"][number] | undefined,
  goals: Props["revisionGoals"],
  settings: SubjectGradeSettings,
  defaultScaleId?: GradeScaleId,
) {
  const scaleId = settings.scaleId ?? defaultScaleId;
  const scale = scaleId ? getScale(scaleId) : null;
  const goal = goals.find(
    (g) =>
      g.subject.trim().toLowerCase() === subject?.name.trim().toLowerCase(),
  );
  const gradeBoundary =
    scale && settings.targetGrade
      ? boundariesFor(scale, settings.boundaries)[settings.targetGrade]
      : undefined;
  const target = goal?.targetPercentage ?? gradeBoundary ?? null;
  const projection =
    scale && typeof subject?.avgScore === "number"
      ? projectGrade(subject.avgScore, scale, {
          overrides: settings.boundaries,
          tierId: settings.tierId,
        }).grade
      : null;
  const rows = data.map((row) => ({
    period: row.period,
    score:
      subject && typeof row[subject.name] === "number"
        ? row[subject.name]
        : null,
  }));
  return {
    rows,
    target:
      typeof target === "number" &&
      Number.isFinite(target) &&
      target >= 0 &&
      target <= 100
        ? target
        : null,
    projection,
  };
}

export function ScoreTargetChart({
  data,
  subjects,
  timeRange,
  onTimeRangeChange,
  revisionGoals,
  defaultScaleId,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState("");
  const navigate = useNavigate();
  const { get } = useGradeSettings();
  const active =
    subjects.find((subject) => subject.name === selected) ?? subjects[0];
  const settings = get(active?.name ?? "");
  const view = scoreTargetView(
    data,
    active,
    revisionGoals,
    settings,
    defaultScaleId,
  );
  const hasData = view.rows.some((row) => row.score !== null);
  const index = Math.max(
    0,
    subjects.findIndex((subject) => subject.name === active?.name),
  );
  const timeRangeOptions = [
    { key: "weekly", label: "7 days" },
    { key: "monthly", label: "30 days" },
    { key: "yearly", label: "12 months" },
  ] as const;

  return (
    <>
      <section className="stats-score-target" aria-label="Score versus target">
        <div className="stats-section-heading">
          <div>
            <h2>Score vs target</h2>
            <p>Actual results · selected range</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="stats-chart-control"
            aria-label="Expand score trends"
            title="Compare all subjects"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="stats-target-controls">
          <label className="stats-subject-select">
            <span className="sr-only">Score trend subject</span>
            <select
              value={active?.name ?? ""}
              onChange={(event) => setSelected(event.target.value)}
              disabled={!subjects.length}
            >
              {subjects.length ? (
                subjects.map((subject) => (
                  <option key={subject.name} value={subject.name}>
                    {subject.name}
                  </option>
                ))
              ) : (
                <option value="">No subjects yet</option>
              )}
            </select>
          </label>
          <div
            className="stats-range-control"
            aria-label="Score trend date range"
          >
            {timeRangeOptions.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={timeRange === key}
                onClick={() => onTimeRangeChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="stats-chart-body">
          {hasData ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart
                accessibilityLayer
                data={view.rows}
                margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  width={34}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [
                    `${Math.round(value)}%`,
                    active?.name ?? "Score",
                  ]}
                  cursor={{
                    stroke: "hsl(var(--muted-foreground))",
                    strokeDasharray: "3 3",
                  }}
                />
                <Area
                  type="linear"
                  dataKey="score"
                  name={active?.name}
                  stroke={chartColour(index)}
                  fill={chartColour(index)}
                  fillOpacity={0.15}
                  strokeWidth={2.5}
                  strokeDasharray={chartDash(index)}
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={{ r: 3, fill: "hsl(var(--card))", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "hsl(var(--card))", strokeWidth: 3 }}
                />
                {view.target !== null && (
                  <ReferenceLine
                    y={view.target}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{
                      value: `Target ${view.target}%`,
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState
              message="No marked results in this range"
              icon={FileText}
              action={{
                label: "Take an exam",
                onClick: () => navigate("/my-exams"),
              }}
              height={160}
            />
          )}
        </div>
        <div className="stats-target-caption">
          <span>
            {view.target !== null
              ? `Saved target: ${view.target}%`
              : "No saved target for this subject"}
          </span>
          {view.projection && (
            <span>
              Estimated grade <strong>{view.projection}</strong>
              {settings.targetGrade ? ` · target ${settings.targetGrade}` : ""}
            </span>
          )}
        </div>
        {view.projection && (
          <p className="stats-grade-note">
            Estimate uses your existing grade scale and boundaries.
          </p>
        )}
        <ChartDataTable
          caption="Score trends"
          rows={data}
          series={subjects.map((subject) => ({
            key: subject.name,
            label: subject.name,
          }))}
        />
      </section>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="stats-chart-dialog max-w-[900px] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Score trends</DialogTitle>
            <DialogDescription>
              Compare all subjects’ actual exam scores using the selected date
              range and saved revision goals.
            </DialogDescription>
          </DialogHeader>
          {data.length > 0 && subjects.length > 0 ? (
            <ChartContent
              data={data}
              subjects={subjects}
              revisionGoals={revisionGoals}
              height={350}
            />
          ) : (
            <p className="stats-chart-empty">
              No marked results in this range.
            </p>
          )}
          <div className="stats-chart-legend">
            {subjects.map((subject, i) => (
              <span key={subject.name}>
                <i style={{ background: chartColour(i) }} />
                {subject.name}
              </span>
            ))}
          </div>
          <ChartDataTable
            caption="Score trends"
            rows={data}
            series={subjects.map((subject) => ({
              key: subject.name,
              label: subject.name,
            }))}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
