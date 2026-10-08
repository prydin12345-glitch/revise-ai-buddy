import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TopStatsCards } from "@/components/stats/TopStatsCards";
import { SubjectPerformanceChart } from "@/components/stats/SubjectPerformanceChart";
import { RecentExamsTable } from "@/components/stats/RecentExamsTable";
import { ChartDataTable } from "@/components/stats/ChartDataTable";
import { StatsLoading, StatsError } from "@/components/stats/StatsPageStates";
import { QuickStatsGrid } from "@/components/stats/mobile/QuickStatsGrid";
import { MobileStatSheet } from "@/components/stats/mobile/MobileStatSheet";
import { useState } from "react";
afterEach(cleanup);
it("keeps a genuine zero score visible and retains every summary drilldown", () => {
  const click = vi.fn();
  render(
    <TopStatsCards
      totalExams={2}
      completedExams={1}
      inProgressExams={1}
      avgScore={0}
      currentStreak={0}
      longestStreak={3}
      onCardClick={click}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Average exam score: 0%/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Exams completed: 1/ }));
  fireEvent.click(screen.getByRole("button", { name: /Study time this week/ }));
  fireEvent.click(screen.getByRole("button", { name: /Revision streak/ }));
  expect(click.mock.calls.map(([type]) => type)).toEqual([
    "scores",
    "exams",
    "study-hours",
    "streak",
  ]);
});
it("shows every subject, a labelled meter and the retained previous/next selection", () => {
  const data = [
    { name: "Biology", avgScore: 65, count: 4, value: 65, color: "#111111" },
    {
      name: "Mathematics",
      avgScore: 80,
      count: 5,
      value: 80,
      color: "#222222",
    },
  ];
  render(
    <MemoryRouter>
      <SubjectPerformanceChart
        data={data}
        viewMode="score"
        onViewModeChange={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("meter")).toHaveLength(2);
  expect(screen.getByText("Selected: Mathematics · 80%")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next subject" }));
  expect(screen.getByText("Selected: Biology · 65%")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Previous subject" }));
  expect(screen.getByText("Selected: Mathematics · 80%")).toBeVisible();
});
it("keeps exam search, pagination and the exact review destination", () => {
  function Destination() {
    const location = useLocation();
    return <output aria-label="Destination">{location.pathname}</output>;
  }
  const exams = Array.from({ length: 6 }, (_, i) => ({
    id: `q${i}`,
    subject: "Biology",
    subjectColor: "#15815a",
    examTitle: `Biology paper ${i}`,
    score: 60,
    dateTaken: "8 Oct 2026",
    timeSpent: "90m",
    totalMarks: 100,
    earnedMarks: 60,
  }));
  render(
    <MemoryRouter>
      <RecentExamsTable exams={exams} />
      <Destination />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next results page" }));
  expect(screen.getByText("Biology paper 4")).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "Search exams" }), {
    target: { value: "paper 2" },
  });
  expect(screen.getByText("Biology paper 2")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Review" }));
  expect(screen.getByLabelText("Destination")).toHaveTextContent(
    "/exam/q2/review",
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Search exams" }), {
    target: { value: "not found" },
  });
  expect(screen.getByText("No exams match your search.")).toHaveAttribute(
    "role",
    "status",
  );
});
it("shows a loading skeleton and a useful error retry without inventing values", () => {
  const view = render(<StatsLoading />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  expect(view.container.textContent).not.toContain("0%");
  const retry = vi.fn();
  view.rerender(<StatsError onRetry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t load");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledTimes(1);
});
it("exposes chart data including zero and missing values to keyboards and assistive technology", () => {
  render(
    <ChartDataTable
      caption="Scores"
      rows={[{ period: "Mon", Biology: 0 }, { period: "Tue" }]}
      series={[{ key: "Biology", label: "Biology" }]}
    />,
  );
  expect(screen.getByText("0%")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Scores data table", hidden: true }),
  ).toHaveAttribute("tabindex", "0");
});
it("mobile summaries retain independent real counts and all four sheet actions", () => {
  const actions = Array.from({ length: 4 }, () => vi.fn());
  render(
    <QuickStatsGrid
      accuracy={65}
      accuracySessions={[]}
      subjectStacks={[]}
      gradeValue="1 / 2"
      gradeProgress={50}
      gradeAccent="#111111"
      gradeTrajectory={[]}
      masteredCount={3}
      developingCount={2}
      reviewCount={1}
      totalAttempted={6}
      masteredHistory={[]}
      streak={4}
      longestStreak={8}
      streakDays={[true, false, true]}
      onOpenAccuracy={actions[0]}
      onOpenGrade={actions[1]}
      onOpenMastered={actions[2]}
      onOpenStreak={actions[3]}
    />,
  );
  for (const name of [
    /Topic accuracy: 65%/,
    /Grade targets met: 1 \/ 2/,
    /Mastered topics: 3 \/ 6/,
    /Revision streak: 4 days/,
  ])
    fireEvent.click(screen.getByRole("button", { name }));
  expect(actions.map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1, 1]);
});
it("detail sheets expose a title and close control and restore focus after Escape", async () => {
  function Fixture() {
    const [open, set] = useState(false);
    return (
      <>
        <button onClick={() => set(true)}>Open details</button>
        <MobileStatSheet
          open={open}
          onClose={() => set(false)}
          title="Exam Readiness"
          subtitle="Existing calculation"
        >
          Readiness factors
        </MobileStatSheet>
      </>
    );
  }
  render(<Fixture />);
  const trigger = screen.getByRole("button", { name: "Open details" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Exam Readiness" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
