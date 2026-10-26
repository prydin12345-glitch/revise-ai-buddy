import { cloneElement, type ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  const { container } = render(<ProfileTrendChart profiles={profiles} rows={[{ key: "one", period: "Mon", full: null, short: Number.NaN }]}
    timeRange="weekly" onTimeRangeChange={() => {}} />);
  expect(screen.getByRole("status")).toHaveTextContent("No marked exam results");
  expect(screen.queryByText("0%")).toBeNull();
  expect(screen.queryByLabelText("Exam profile legend")).toBeNull();
  expect(container.querySelector(".recharts-wrapper")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View exam score trends data" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByText("Full mock")).toBeNull();
  expect(within(dialog).queryByRole("table", { hidden: true })).toBeNull();
});

it("excludes unscored profiles from a mixed trend while retaining a real zero", () => {
  render(<ProfileTrendChart profiles={profiles} rows={[{ key: "one", period: "Mon", full: null, short: 0 }]}
    timeRange="weekly" onTimeRangeChange={() => {}} />);
  const legend = screen.getByLabelText("Exam profile legend");
  expect(legend).toHaveTextContent("Short paper");
  expect(legend).not.toHaveTextContent("Full mock");
  expect(screen.queryByRole("status")).toBeNull();
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
  expect(screen.getByRole("status")).toHaveTextContent("Not enough shared topic data");
  expect(document.querySelector(".recharts-radar-polygon")).toBeNull();
  expect(screen.queryByLabelText("Exam profile legend")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View topic spread data" }));
  expect(within(screen.getByRole("dialog")).queryByRole("table", { hidden: true })).toBeNull();
});

it("does not let an unattempted profile hide the available topic spread or appear in its key", () => {
  const groups = [
    { profileId: "full", profileName: "Full mock", topics: [] },
    { profileId: "short", profileName: "Short paper", topics: [topic("Cells", 0), topic("Molecules", 80), topic("Enzymes", 60)] },
  ];
  expect(sharedRadarTopics(groups)).toEqual(["Cells", "Enzymes", "Molecules"]);
  render(<ProfileTopicRadar profiles={profiles} topicsByProfile={groups}/>);
  expect(screen.queryByRole("status")).toBeNull();
  const legend = screen.getByLabelText("Exam profile legend");
  expect(legend).toHaveTextContent("Short paper");
  expect(legend).not.toHaveTextContent("Full mock");
  expect(document.querySelector(".recharts-radar-polygon path")).toHaveAttribute("stroke", "var(--stats-series-4)");
});

it("shows only an empty topic spread when every profile is unmarked", () => {
  render(<ProfileTopicRadar profiles={profiles} topicsByProfile={[
    { profileId: "full", profileName: "Full mock", topics: [topic("Pending", 0, false)] },
    { profileId: "short", profileName: "Short paper", topics: [] },
  ]}/>);
  expect(screen.getByRole("status")).toHaveTextContent("Not enough shared topic data");
  expect(screen.queryByLabelText("Exam profile legend")).toBeNull();
  expect(document.querySelector(".recharts-wrapper")).toBeNull();
});

it("opens the selected category inside its own card and returns to the chart", () => {
  render(<TopicBreakdownChart topics={[topic("Cells", 80), topic("Enzymes", 60), topic("Molecules", 0), topic("Pending", 0, false)]} />);
  expect(screen.getByRole("button", { name: "Strong: 1 topics" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Needs attention: 1 topics" }));
  const group = screen.getByRole("region", { name: "Needs attention topics" });
  expect(group).toHaveTextContent("Molecules");
  expect(group).toHaveTextContent("0%");
  expect(group).not.toHaveTextContent("Cells");
  expect(group).not.toHaveTextContent("Pending");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { name: "Topic breakdown" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Back to topic breakdown chart" }));
  expect(screen.queryByRole("region", { name: "Needs attention topics" })).toBeNull();
  expect(screen.getByRole("button", { name: "Show needs attention topics" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Needs attention: 1 topics" })).toHaveFocus();
});

it("supports pointer and keyboard activation on the actual doughnut segments", () => {
  render(<TopicBreakdownChart topics={[topic("Cells", 80), topic("Molecules", 25)]} />);
  fireEvent.click(screen.getByRole("button", { name: "Show needs attention topics" }));
  expect(screen.getByRole("region", { name: "Needs attention topics" })).toHaveTextContent("Molecules");
  fireEvent.click(screen.getByRole("button", { name: "Back to topic breakdown chart" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Show strong topics" }), { key: "Enter" });
  expect(screen.getByRole("region", { name: "Strong topics" })).toHaveTextContent("Cells");
  expect(screen.getByRole("button", { name: "Back to topic breakdown chart" })).toHaveFocus();
});

it("keeps zero-count categories usable without inventing topic evidence", () => {
  render(<TopicBreakdownChart topics={[topic("Cells", 90), topic("Pending", 0, false)]} />);
  fireEvent.click(screen.getByRole("button", { name: "Needs attention: 0 topics" }));
  const group = screen.getByRole("region", { name: "Needs attention topics" });
  expect(group).toHaveTextContent("No topics in this group yet");
  expect(within(group).queryByRole("listitem")).toBeNull();
});

it("groups only selected-profile recorded time and labels unassigned revision separately", () => {
  render(<ProfileStudyChart profiles={profiles} days={[
    { key: "mon", day: "Monday", hoursByProfile: { short: 0 }, total: 0 },
    { key: "tue", day: "Tuesday", hoursByProfile: { short: 1.2 }, total: 1.2 },
  ]} totalHours={1.2} unassignedHours={0.8} />);
  expect(screen.getByText("This week")).toBeVisible();
  expect(screen.queryByText(/Unlinked revision/)).toBeNull();
  expect(screen.queryByText("Full mock")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View study hours data" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Unlinked revision: 0.8h");
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("0h");
  expect(screen.getByRole("table", { hidden: true })).toHaveTextContent("1.2h");
});

it("shows a clock empty state without zero-only study graphs or profile keys", () => {
  const { container } = render(<ProfileStudyChart profiles={profiles} days={[
    { key: "mon", day: "Monday", hoursByProfile: { full: 0, short: Number.NaN }, total: 0 },
    { key: "tue", day: "Tuesday", hoursByProfile: { full: 0, short: Number.POSITIVE_INFINITY }, total: 0 },
  ]} totalHours={0} unassignedHours={0}/>);
  expect(screen.getByRole("status")).toHaveTextContent("0 Hours studied this week");
  expect(container.querySelector(".lucide-clock3")).not.toBeNull();
  expect(container.querySelector(".recharts-wrapper")).toBeNull();
  expect(screen.queryByLabelText("Exam profile legend")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View study hours data" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByRole("table", { hidden: true })).toBeNull();
  expect(dialog).not.toHaveTextContent("Full mock");
});

it("keeps zero-only study profiles out of a populated weekly key", () => {
  render(<ProfileStudyChart profiles={profiles} days={[
    { key: "mon", day: "Monday", hoursByProfile: { full: 0, short: .5 }, total: .5 },
  ]} totalHours={.5} unassignedHours={0}/>);
  expect(screen.queryByRole("status")).toBeNull();
  const legend = screen.getByLabelText("Exam profile legend");
  expect(legend).toHaveTextContent("Short paper");
  expect(legend).not.toHaveTextContent("Full mock");
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

it("keeps an empty score distribution free of graph axes and zero-filled data tables", () => {
  const { container } = render(<TopicScoreDistribution topics={[topic("Pending", 0, false), topic("Invalid", Number.NaN)]}/>);
  expect(screen.getByRole("status")).toHaveTextContent("No marked topic scores yet");
  expect(container.querySelector(".subject-stats-chart-empty > svg")).not.toBeNull();
  expect(container.querySelector(".recharts-wrapper")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View topic score distribution data" }));
  expect(within(screen.getByRole("dialog")).queryByRole("table", { hidden: true })).toBeNull();
});

it("uses theme foreground for hovered topic counts rather than the slice colour", () => {
  const { container } = render(<TopicBreakdownChart topics={[topic("Cells", 80), topic("Molecules", 25)]}/>);
  fireEvent.mouseEnter(container.querySelector(".recharts-pie-sector")!);
  const item = container.querySelector<HTMLElement>(".recharts-tooltip-item");
  expect(item).not.toBeNull();
  expect(item?.style.color).toBe("hsl(var(--foreground))");
});
