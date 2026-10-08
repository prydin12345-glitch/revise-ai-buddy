import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";
import { StatsGauge } from "@/components/stats/StatsGauge";
import { LearningProgressPanel } from "@/components/stats/LearningProgressPanel";
import { SubjectHistoryBars } from "@/components/stats/SubjectHistoryBars";
import { RevisionPrioritiesCard } from "@/components/stats/RevisionPrioritiesCard";
import {
  summariseLearningProgress,
  TopicProgressOverview,
} from "@/components/stats/TopicProgressOverview";

afterEach(cleanup);
const topic = (
  name: string,
  score: number,
  marked = true,
): UnifiedTopicScore => ({
  topic: name,
  subjectId: "Biology",
  unifiedScore: score,
  examScore: marked ? score : null,
  practiceScore: null,
  examQuestionCount: marked ? 2 : 0,
  practiceQuestionCount: 0,
  pendingQuestionCount: marked ? 0 : 1,
  mastery: marked ? "developing" : "untested",
  lastAttempted: null,
  practicedSinceLastExam: false,
});

it("retains the mobile readiness formula and marked-topic boundaries on desktop", () => {
  const summary = summariseLearningProgress(
    [
      topic("Cells", 80),
      topic("Enzymes", 40),
      topic("Ecology", 0),
      topic("Pending", 0, false),
    ],
    70,
    4,
    8,
  );
  expect(summary.attempted).toHaveLength(3);
  expect(summary.accuracy).toBe(40);
  expect(summary.coverage).toBe(75);
  expect(summary.readiness).toBe(70 * 0.6 + 75 * 0.25 + 50 * 0.15);
  expect([summary.mastered, summary.developing, summary.review]).toEqual([
    1, 1, 1,
  ]);
});

it("keeps empty topic coverage empty and uses the existing exam-average fallback", () => {
  const summary = summariseLearningProgress([], 60, 0, 0);
  expect(summary.accuracy).toBe(60);
  expect(summary.coverage).toBe(0);
  expect(summary.readiness).toBe(36);
  expect(summary.attempted).toEqual([]);
});

it("distinguishes a real zero percentage from an unavailable gauge", () => {
  render(
    <>
      <StatsGauge value={0} label="Accuracy" />
      <StatsGauge value={null} label="Coverage unavailable" />
      <StatsGauge value={Number.NaN} label="Invalid input" />
    </>,
  );
  expect(screen.getByRole("meter", { name: "Accuracy" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  expect(screen.getByText("0%")).toBeVisible();
  expect(screen.getAllByRole("img")).toHaveLength(2);
  expect(screen.queryByText("NaN%")).toBeNull();
});

it("both learning gauges keep their independent existing detail actions", () => {
  const accuracy = vi.fn(),
    readiness = vi.fn();
  render(
    <LearningProgressPanel
      accuracy={60}
      readiness={75}
      onAccuracy={accuracy}
      onReadiness={readiness}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Topic accuracy: 60%. View details" }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Exam readiness estimate: 75%. View details",
    }),
  );
  expect(accuracy).toHaveBeenCalledOnce();
  expect(readiness).toHaveBeenCalledOnce();
});

it("subject charts expose actual periods, genuine zero and missing results without invented bars", () => {
  const { container } = render(
    <SubjectHistoryBars
      subject="Biology"
      colour="#285ba5"
      rows={[
        { period: "Mon", Biology: 0 },
        { period: "Tue" },
        { period: "Wed", Biology: 80 },
      ]}
    />,
  );
  expect(screen.getByRole("img")).toHaveAccessibleName(
    /Mon: 0%; Tue: no marked results; Wed: 80%/,
  );
  expect(container.querySelectorAll("rect")).toHaveLength(2);
});

it("revision priorities exclude pending work and keep the existing lowest-score ordering", () => {
  const viewAll = vi.fn();
  render(
    <RevisionPrioritiesCard
      topics={[
        topic("Cells", 80),
        topic("Enzymes", 30),
        topic("Pending", 0, false),
        topic("Ecology", 0),
      ]}
      loading={false}
      action={<button onClick={viewAll}>View all</button>}
    />,
  );
  expect(
    screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual(["Ecology", "Enzymes", "Cells"]);
  expect(screen.queryByText("Pending")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View all" }));
  expect(viewAll).toHaveBeenCalledOnce();
});

it("mastery and coverage rings show the correct independent denominators", () => {
  render(
    <TopicProgressOverview
      topics={[
        topic("Cells", 80),
        topic("Ecology", 0),
        topic("Pending", 0, false),
      ]}
      loading={false}
    />,
  );
  expect(
    screen.getByRole("meter", { name: "Mastered share of marked topics" }),
  ).toHaveAttribute("aria-valuenow", "50");
  expect(
    screen.getByRole("meter", { name: "Tracked-topic coverage" }),
  ).toHaveAttribute("aria-valuenow", String((2 / 3) * 100));
  expect(screen.getByText("1 of 2 marked")).toBeVisible();
  expect(screen.getByText("2 of 3 tracked")).toBeVisible();
});

it("loading and empty topic modules never present invented percentages", () => {
  const view = render(<TopicProgressOverview topics={[]} loading />);
  expect(screen.getByLabelText("Loading topic progress")).toBeVisible();
  expect(screen.queryByRole("meter")).toBeNull();
  view.rerender(<TopicProgressOverview topics={[]} loading={false} />);
  expect(screen.queryByRole("meter")).toBeNull();
  expect(screen.getByText("0 of 0 tracked")).toBeVisible();
});
