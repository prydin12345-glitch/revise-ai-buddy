import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  scoreTargetView,
  ScoreTargetChart,
} from "@/components/stats/ScoreTargetChart";
import { SubjectScoresChart } from "@/components/stats/SubjectScoresChart";
import { SubjectPerformanceChart } from "@/components/stats/SubjectPerformanceChart";
import { SubjectGaugeCard } from "@/components/stats/mobile/SubjectGaugeCard";
import { getScale, projectGrade } from "@/lib/grade-scales";
import { cloneElement, type ReactElement } from "react";

// jsdom has no layout/ResizeObserver. Keep the real charts, with fixed test
// dimensions; responsive sizing is separately verified in Chromium.
vi.mock("recharts", async (original) => ({
  ...(await original<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(children, { width: 400, height: 200 }),
}));

afterEach(cleanup);
const biology = {
  name: "Biology",
  color: "#15756b",
  avgScore: 78,
  count: 4,
  value: 78,
};
const chemistry = {
  name: "Chemistry",
  color: "#995c12",
  avgScore: 64,
  count: 3,
  value: 64,
};
const maths = {
  name: "Mathematics",
  color: "#285ba5",
  avgScore: 86,
  count: 5,
  value: 86,
};
const goals = [
  {
    subject: "Biology",
    targetPercentage: 82,
    deadline: "2026-12-01",
    currentAverage: 78,
    color: "#15756b",
  },
];
const data = [
  { period: "Mon", Biology: 0, Chemistry: 50 },
  { period: "Tue", Chemistry: 60 },
  { period: "Wed", Biology: 78, Chemistry: 64 },
];

it("keeps a genuine zero and missing periods separate in the subject target view", () => {
  expect(
    scoreTargetView(data, biology, [], {}).rows.map((row) => row.score),
  ).toEqual([0, null, 78]);
});

it("uses only the selected subject's saved goal, including case-insensitive subject matching", () => {
  expect(scoreTargetView(data, biology, goals, {}).target).toBe(82);
  expect(scoreTargetView(data, chemistry, goals, {}).target).toBeNull();
  expect(
    scoreTargetView(data, { ...biology, name: " biology " }, goals, {}).target,
  ).toBe(82);
  expect(
    scoreTargetView(
      data,
      biology,
      [{ ...goals[0], targetPercentage: Number.NaN }],
      {},
    ).target,
  ).toBeNull();
});

it("reuses saved grade boundaries and the existing projection without assuming an account's scale", () => {
  const settings = {
    scaleId: "alevel_a_e" as const,
    targetGrade: "A",
    boundaries: { A: 81 },
  };
  const view = scoreTargetView(data, biology, [], settings);
  expect(view.target).toBe(81);
  expect(view.projection).toBe(
    projectGrade(78, getScale(settings.scaleId), {
      overrides: settings.boundaries,
    }).grade,
  );
  expect(
    scoreTargetView(data, biology, [], { targetGrade: "A" }).projection,
  ).toBeNull();
  expect(scoreTargetView(data, biology, goals, settings).target).toBe(82);
});

it("changing the displayed subject does not alter the existing range callback or leak another subject's target", () => {
  const range = vi.fn();
  render(
    <MemoryRouter>
      <ScoreTargetChart
        data={data}
        subjects={[biology, chemistry]}
        timeRange="weekly"
        onTimeRangeChange={range}
        revisionGoals={goals}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("Saved target: 82%")).toBeVisible();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Score trend subject" }),
    { target: { value: "Chemistry" } },
  );
  expect(screen.queryByText("Saved target: 82%")).toBeNull();
  expect(screen.getByText("No saved target for this subject")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "30 days" }));
  expect(range).toHaveBeenCalledWith("monthly");
});

it("the comparison keeps its existing score/count control and zero averages", () => {
  const mode = vi.fn();
  render(
    <SubjectScoresChart
      data={[{ ...biology, avgScore: 0 }]}
      viewMode="score"
      onViewModeChange={mode}
    />,
  );
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("0%");
  expect(
    screen.getByRole("columnheader", { name: "Subject", hidden: true }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Exams" }));
  expect(mode).toHaveBeenCalledWith("count");
});

it("two desktop snapshot tiles retain access to every subject and wrap selection", () => {
  render(
    <MemoryRouter>
      <SubjectPerformanceChart
        data={[biology, chemistry, maths]}
        viewMode="score"
        onViewModeChange={() => {}}
        trendData={data}
      />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("meter")).toHaveLength(2);
  expect(
    screen.queryByRole("meter", { name: "Chemistry average exam score" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next subject" }));
  expect(
    screen.getByRole("meter", { name: "Chemistry average exam score" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Previous subject" }));
  expect(screen.getByText("Selected: Mathematics · 86%")).toBeVisible();
});

it("mobile snapshots preserve their weakest-first order and the topic tally", () => {
  render(
    <SubjectGaugeCard
      subjects={[biology, chemistry, maths]}
      trendData={data}
      topicStats={() => ({ mastered: 2, developing: 1, review: 0 })}
    />,
  );
  expect(
    screen.getAllByRole("meter").map((m) => m.getAttribute("aria-label")),
  ).toEqual(["Chemistry average exam score", "Biology average exam score"]);
  expect(screen.getAllByText("2 mastered")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Next subject" }));
  expect(
    screen.getAllByRole("meter").map((m) => m.getAttribute("aria-label")),
  ).toEqual(["Biology average exam score", "Mathematics average exam score"]);
});
