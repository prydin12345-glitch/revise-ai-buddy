import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsGauge } from "./StatsGauge";
import { LearningProgressPanel } from "./LearningProgressPanel";
import { clampPct } from "./mobile/tokens";

/** Same marked-topic thresholds and readiness formula used by MobileStatsTelemetry.
 * Pending responses never count as marked topics. No query or scoring changes. */
export function summariseLearningProgress(
  topics: UnifiedTopicScore[],
  examAverage: number,
  streak: number,
  bestStreak: number,
) {
  const attempted = topics.filter(
    (t) => t.examQuestionCount + t.practiceQuestionCount > 0,
  );
  const coverage = topics.length
    ? clampPct((attempted.length / topics.length) * 100)
    : 0;
  const consistency = clampPct((streak / Math.max(bestStreak, 7)) * 100);
  const accuracy = attempted.length
    ? attempted.reduce((sum, t) => sum + t.unifiedScore, 0) / attempted.length
    : examAverage;
  const readiness =
    clampPct(examAverage) * 0.6 +
    clampPct(coverage) * 0.25 +
    clampPct(consistency) * 0.15;
  const mastered = attempted.filter(
    (t) => clampPct(t.unifiedScore) >= 70,
  ).length;
  const developing = attempted.filter(
    (t) => clampPct(t.unifiedScore) >= 40 && clampPct(t.unifiedScore) < 70,
  ).length;
  const review = attempted.filter((t) => clampPct(t.unifiedScore) < 40).length;
  return {
    attempted,
    coverage,
    accuracy,
    readiness,
    mastered,
    developing,
    review,
  };
}

export function DesktopLearningGauges({
  topics,
  average,
  streak,
  bestStreak,
  hasExams,
  loading,
}: {
  topics: UnifiedTopicScore[];
  average: number;
  streak: number;
  bestStreak: number;
  hasExams: boolean;
  loading: boolean;
}) {
  const summary = summariseLearningProgress(
    topics,
    average,
    streak,
    bestStreak,
  );
  return (
    <LearningProgressPanel
      accuracy={summary.accuracy}
      readiness={summary.readiness}
      hasData={hasExams || summary.attempted.length > 0}
      loading={loading}
    />
  );
}

export function TopicProgressOverview({
  topics,
  loading,
  action,
  onMastery,
}: {
  topics: UnifiedTopicScore[];
  loading: boolean;
  action?: ReactNode;
  onMastery?: () => void;
}) {
  const { attempted, coverage, mastered, developing, review } =
    summariseLearningProgress(topics, 0, 0, 0);
  return (
    <section className="stats-topic-progress" aria-label="Topic progress">
      <div className="stats-section-heading flex items-center justify-between gap-2">
        <h2>Topic progress</h2>
        {action}
      </div>
      {loading ? (
        <Skeleton
          className="mx-5 mb-5 h-40"
          aria-label="Loading topic progress"
        />
      ) : (
        <>
          <div className="stats-ring-pair">
            <div className="stats-ring-item">
              <StatsGauge
                shape="ring"
                label="Mastered share of marked topics"
                value={
                  attempted.length ? (mastered / attempted.length) * 100 : null
                }
                colour="var(--stats-series-2)"
              />
              <h3>
                {onMastery ? (
                  <button
                    type="button"
                    onClick={onMastery}
                    aria-label={`Mastered topics: ${mastered} / ${attempted.length}. View details`}
                  >
                    Mastered topics <span aria-hidden="true">↗</span>
                  </button>
                ) : (
                  "Mastered topics"
                )}
              </h3>
              <p>
                {mastered} of {attempted.length} marked
              </p>
            </div>
            <div className="stats-ring-item">
              <StatsGauge
                shape="ring"
                label="Tracked-topic coverage"
                value={topics.length ? coverage : null}
                colour="var(--stats-series-3)"
              />
              <h3>Topic coverage</h3>
              <p>
                {attempted.length} of {topics.length} tracked
              </p>
            </div>
          </div>
          <div className="stats-topic-legend">
            <span>
              <i className="bg-[var(--stats-series-3)]" />
              {mastered} mastered
            </span>
            <span>
              <i className="bg-[var(--stats-series-2)]" />
              {developing} developing
            </span>
            <span>
              <i className="bg-[var(--stats-series-5)]" />
              {review} to review
            </span>
          </div>
        </>
      )}
    </section>
  );
}
