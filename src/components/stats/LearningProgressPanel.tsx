import { Skeleton } from "@/components/ui/skeleton";
import { StatsGauge } from "./StatsGauge";

export function LearningProgressPanel({
  accuracy,
  readiness,
  loading = false,
  hasData = true,
  onAccuracy,
  onReadiness,
}: {
  accuracy: number;
  readiness: number;
  loading?: boolean;
  hasData?: boolean;
  onAccuracy?: () => void;
  onReadiness?: () => void;
}) {
  const metrics = [
    {
      label: "Topic accuracy",
      value: accuracy,
      detail: "Across marked topics",
      colour: "var(--stats-series-3)",
      onClick: onAccuracy,
    },
    {
      label: "Exam readiness estimate",
      value: readiness,
      detail: "Scores, coverage & consistency",
      colour: "var(--stats-series-1)",
      onClick: onReadiness,
    },
  ];
  return (
    <section className="stats-learning-pair" aria-label="Learning progress">
      {metrics.map((metric) => {
        const content = (
          <>
            {loading ? (
              <Skeleton
                className="mx-auto h-24 w-full max-w-40"
                aria-label={`Loading ${metric.label}`}
              />
            ) : (
              <StatsGauge
                value={hasData ? metric.value : null}
                label={metric.label}
                colour={metric.colour}
              />
            )}
            <span className="stats-gauge-label">{metric.label}</span>
            <span className="stats-gauge-caption">
              {hasData ? metric.detail : "Complete marked work to begin"}
            </span>
            {metric.onClick && (
              <span className="stats-metric-link">View details</span>
            )}
          </>
        );
        return metric.onClick ? (
          <button
            key={metric.label}
            type="button"
            className="stats-gauge-tile"
            onClick={metric.onClick}
            aria-label={`${metric.label}: ${hasData ? `${Math.round(metric.value)}%` : "no data"}. View details`}
          >
            {content}
          </button>
        ) : (
          <div key={metric.label} className="stats-gauge-tile">
            {content}
          </div>
        );
      })}
    </section>
  );
}
