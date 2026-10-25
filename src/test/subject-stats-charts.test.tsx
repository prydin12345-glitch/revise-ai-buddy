import { cloneElement, type ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";
import {
  ProfileTrendChart, ProfileTopicRadar, ProfileStudyChart, TopicBreakdownChart,
  TopicScoreDistribution, sharedRadarTopics, statsProfileColour, topicScoreBins,
} from "@/components/stats/SubjectStatsCharts";

vi.mock("recharts", async original => ({
  ...(await original<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 440, height: 230 }),
}));
afterEach(cleanup);
const profiles = [
  { id: "full", name: "Full mock", subject: "Biology" },
  { id: "short", name: "Short paper", subject: "Biology" },
];
const topic = (name: string, score: number, marked = true): UnifiedTopicScore => ({
  topic: name, subjectId: "Biology", unifiedScore: score, examScore: marked ? score : null,
  practiceScore: null, examQuestionCount: marked ? 3 : 0, practiceQuestionCount: 0,
  pendingQuestionCount: marked ? 0 : 1, mastery: !marked ? "untested" : score >= 75 ? "strong" : score >= 50 ? "developing" : "weak",
  lastAttempted: null, practicedSinceLastExam: false,
});

it("keeps a selected profile's colour stable and exposes genuine zero / missing trend data", () => {
  const onRange = vi.fn();
  const { container } = render(<ProfileTrendChart profiles={profiles}
    rows={[{ key: "one", period: "Mon", short: 0 }, { key: "two", period: "Tue", short: null }, { key: "three", period: "Wed", short: 70 }]}
    timeRange="weekly" onTimeRangeChange={onRange} />);
  expect(statsProfileColour(profiles, "short")).toBe("var(--stats-series-4)");
  expect(container.querySelectorAll(".recharts-area path.recharts-area-curve")[0]).toHaveAttribute("stroke", "var(--stats-series-4)");
  fireEvent.change(screen.getByRole("combobox", { name: "Exam trend date range" }), { target: { value: "monthly" } });
  expect(onRange).toHaveBeenCalledWith("monthly");
  fireEvent.click(screen.getByRole("button", { name: "View exam score trends data" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Short paper");
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("0%");
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("—");
  expect(screen.queryByRole("columnheader", { name: "Full mock", hidden: true })).toBeNull();
});

it("does not draw absent profile results as a zero series", () => {
  render(<ProfileTrendChart profiles={profiles} rows={[{ key: "one", period: "Mon", full: null }]}
    timeRange="weekly" onTimeRangeChange={() => {}} />);
  expect(screen.getByRole("status")).toHaveTextContent("No marked exam results");
  expect(screen.queryByText("0%")).toBeNull();
});

it("uses only shared marked topics for radar axes and preserves a real zero", () => {
  const groups = [
    { profileId: "full", profileName: "Full mock", topics: [topic("Cells", 0), topic("Molecules", 80), topic("Enzymes", 60), topic("Pending", 0, false), topic("Only full", 50)] },
    { profileId: "short", profileName: "Short paper", topics: [topic("cells", 70), topic("Molecules", 50), topic("Enzymes", 90), topic("Pending", 0, false)] },
  ];
  expect(sharedRadarTopics(groups)).toEqual(["Cells", "Enzymes", "Molecules"]);
  render(<ProfileTopicRadar profiles={profiles} topicsByProfile={groups} />);
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View topic spread data" }));
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("0%");
  expect(screen.getByRole("table", { hidden: true })).not.toHaveTextContent("Pending");
});

it("requires at least three common axes instead of inventing a polygon", () => {
  render(<ProfileTopicRadar profiles={profiles} topicsByProfile={[
    { profileId: "full", profileName: "Full mock", topics: [topic("Cells", 50)] },
    { profileId: "short", profileName: "Short paper", topics: [topic("Enzymes", 70)] },
  ]} />);
  expect(screen.getByRole("status")).toHaveTextContent("At least three marked topics");
  expect(document.querySelector(".recharts-radar-polygon")).toBeNull();
});

it("counts marked topic statuses and routes the exact status action", () => {
  const onStatus = vi.fn();
  render(<TopicBreakdownChart topics={[topic("Cells", 80), topic("Enzymes", 60), topic("Molecules", 0), topic("Pending", 0, false)]} onStatusSelect={onStatus} />);
  expect(screen.getByRole("button", { name: "Strong: 1 topics" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Needs attention: 1 topics" }));
  expect(onStatus).toHaveBeenCalledWith("weak");
  expect(screen.getByText("3 marked topics · not whole-syllabus coverage.")).toBeVisible();
});

it("groups only selected-profile recorded time and labels unassigned revision separately", () => {
  render(<ProfileStudyChart profiles={profiles} days={[
    { key: "mon", day: "Monday", hoursByProfile: { short: 0 }, total: 0 },
    { key: "tue", day: "Tuesday", hoursByProfile: { short: 1.2 }, total: 1.2 },
  ]} totalHours={1.2} unassignedHours={0.8} />);
  expect(screen.getByText("recorded time")).toBeVisible();
  expect(screen.getByText(/0.8h of unassigned subject revision is separate/)).toBeVisible();
  expect(screen.queryByText("Full mock")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View study hours data" }));
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("0h");
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("1.2h");
});

it("uses ten numeric score bins, with 100 in the last band, excluding pending and invalid results", () => {
  const topics = [topic("Zero", 0), topic("Nine", 9), topic("Ten", 10), topic("Hundred", 100), topic("Pending", 0, false), topic("Invalid", Number.NaN)];
  const bins = topicScoreBins(topics);
  expect(bins).toHaveLength(10);
  expect(bins.map(row => row.count)).toEqual([2, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
  render(<TopicScoreDistribution topics={topics} />);
  fireEvent.click(screen.getByRole("button", { name: "View topic score distribution data" }));
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("90–100%");
});
