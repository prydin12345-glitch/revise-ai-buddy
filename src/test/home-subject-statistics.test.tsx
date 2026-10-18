import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import SubjectDonut from "@/components/dashboard/SubjectDonut";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";

const hooks = vi.hoisted(() => ({ profilesLoading: false, topicsLoading: false, profilesError: null as string | null, topicsError: null as string | null, retryProfiles: vi.fn(), retryTopics: vi.fn(), performance: vi.fn(), profiles: [] as any[], topics: [] as any[] }));
vi.mock("@/hooks/useSubjectProfiles", () => ({ useSubjectProfiles: () => ({ getProfilesForSubject: (name: string) => hooks.profiles.filter(p => p.subject_name === name), loading: hooks.profilesLoading, error: hooks.profilesError, retry: hooks.retryProfiles }) }));
vi.mock("@/hooks/useUnifiedTopicPerformance", () => ({ useUnifiedTopicPerformance: (...args: unknown[]) => { hooks.performance(...args); return { topics: hooks.topics, loading: hooks.topicsLoading, error: hooks.topicsError, refetch: hooks.retryTopics }; } }));
vi.mock("recharts", () => ({ ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>, PieChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>, Pie: () => <g />, Cell: () => null, Sector: () => null }));
vi.mock("framer-motion", () => ({ AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>, motion: { div: ({ children, className }: { children: ReactNode; className: string }) => <div className={className}>{children}</div> }, useReducedMotion: () => true }));

const subjects = [{ key: "bio-id", name: "Biology", pct: 60, color: "#246746", identifiers: ["saved-bio-id"] }, { key: "chem-id", name: "Chemistry", pct: 40, color: "#244ea0" }];
let store: WorkspaceStore;
function View({ items = subjects, basis = "study_time", ownerStore = store }: { items?: typeof subjects; basis?: "study_time" | "exam_count"; ownerStore?: WorkspaceStore }) {
  return <WorkspaceContext.Provider value={{ ownerId: ownerStore.ownerId, ready: true, store: ownerStore }}><SubjectDonut subjects={items} centerValue="78%" shareBasis={basis} /></WorkspaceContext.Provider>;
}
beforeEach(() => {
  store = new WorkspaceStore("alice");
  hooks.profilesLoading = false; hooks.topicsLoading = false; hooks.profilesError = null; hooks.topicsError = null;
  hooks.retryProfiles.mockClear(); hooks.retryTopics.mockClear(); hooks.performance.mockClear();
  hooks.profiles = [{ id: "bio-profile", subject_name: "Biology", profile_name: "OCR Biology A · Unified biology", topics: ["Cells", "Ecology", "Energy"], exam_board: "OCR", educational_tier: "A Level" }];
  hooks.topics = [{ topic: "Cells", unifiedScore: 0, examScore: 0, practiceScore: null, mastery: "weak", examQuestionCount: 1, practiceQuestionCount: 0, lastAttempted: "2026-10-01" }, { topic: "Energy", unifiedScore: 80, examScore: 80, practiceScore: null, mastery: "strong", examQuestionCount: 2, practiceQuestionCount: 0, lastAttempted: "2026-10-03" }];
});
afterEach(cleanup);
const openSubject = () => fireEvent.click(screen.getByRole("button", { name: "Biology 60%" }));
const openProfile = () => fireEvent.click(screen.getByRole("button", { name: /OCR Biology A · Unified biology/ }));

describe("Home statistics drill-down", () => {
  it("labels the actual share basis and supports keyboard subject highlighting and back navigation", () => {
    const { rerender } = render(<View basis="exam_count" />);
    expect(screen.getByText("Share of your papers · select a subject to explore")).toBeVisible();
    const biology = screen.getByRole("button", { name: "Biology 60%" });
    fireEvent.focus(biology);
    expect(within(screen.getByRole("img", { name: /Subject breakdown/ })).getByText("60%")).toBeVisible();
    fireEvent.blur(biology);
    expect(within(screen.getByRole("img", { name: /Subject breakdown/ })).getByText("78%")).toBeVisible();
    openSubject();
    expect(hooks.performance).toHaveBeenLastCalledWith("alice", ["bio-id", "Biology", "saved-bio-id"]);
    expect(screen.getByRole("heading", { name: "Biology Statistics" })).toBeVisible();
    // A genuine zero contributes to the profile average; an untested topic does not.
    expect(screen.getByRole("button", { name: /OCR Biology A · Unified biology/ })).toHaveTextContent("40%");
    openProfile();
    expect(screen.getByText("Biology · 3 topics · subject-wide performance")).toBeVisible();
    expect(screen.getByText("0%")).toBeVisible(); expect(screen.getByText("Untested")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to exam profiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to subjects" }));
    rerender(<View />);
    expect(screen.getByText("Share of your study time · select a subject to explore")).toBeVisible();
  });
  it("retains drill-down and topic search on remount but isolates accounts", () => {
    const first = render(<View />); openSubject(); openProfile();
    fireEvent.change(screen.getByRole("textbox", { name: "Search topics" }), { target: { value: "cells" } });
    expect(screen.queryByText("Energy", { exact: true })).not.toBeInTheDocument();
    first.unmount();
    const next = render(<View />);
    expect(screen.getByRole("textbox", { name: "Search topics" })).toHaveValue("cells");
    expect(screen.getByRole("heading", { name: "OCR Biology A · Unified biology" })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Search topics" }), { target: { value: "not present" } });
    expect(screen.getByText("No topics match your search.")).toBeVisible();
    next.rerender(<View ownerStore={new WorkspaceStore("bob")} />);
    expect(screen.getByRole("heading", { name: "Statistics" })).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("shows skeletons rather than temporary zeros during detail reads", () => {
    hooks.topicsLoading = true;
    render(<View />); openSubject();
    expect(screen.getByRole("status", { name: "Loading subject statistics" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /OCR Biology A/ })).not.toBeInTheDocument();
  });
  it("does not label a pending or failed study-time read as an empty subject breakdown", () => {
    const retry = vi.fn();
    const { rerender } = render(<SubjectDonut subjects={[]} loading onRetry={retry} />);
    expect(screen.getByRole("status", { name: "Loading subject statistics" })).toBeVisible();
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
    rerender(<SubjectDonut subjects={[]} error="Couldn’t load your study statistics. Try again." onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load your study statistics.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<SubjectDonut subjects={subjects} />);
    expect(screen.getByRole("button", { name: "Biology 60%" })).toBeVisible();
  });
  it("keeps a back control and retries a failed topic request", () => {
    hooks.topicsError = "Couldn’t load topic performance. Try again.";
    render(<View />); openSubject();
    expect(screen.getByRole("alert")).toHaveTextContent(hooks.topicsError);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(hooks.retryTopics).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Back to subjects" }));
    expect(screen.getByRole("heading", { name: "Statistics" })).toBeVisible();
  });
  it("retries failed profile reads separately", () => {
    hooks.profilesError = "Couldn’t load exam profiles. Try again.";
    render(<View />); openSubject();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(hooks.retryProfiles).toHaveBeenCalledOnce(); expect(hooks.retryTopics).not.toHaveBeenCalled();
  });
  it("handles empty data, a removed profile and a removed subject without stale details", () => {
    const { rerender } = render(<View />); openSubject(); openProfile();
    hooks.profiles = [];
    rerender(<View />);
    expect(screen.getByText(/This exam profile is no longer available/)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to exam profiles" }));
    expect(screen.getByText(/No exam profiles yet for Biology/)).toBeVisible();
    rerender(<View items={[]} />);
    expect(screen.getByText(/This subject is no longer in your breakdown/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to subjects" }));
    expect(screen.getByRole("img", { name: "No subject data yet" })).toBeVisible();
  });
});
