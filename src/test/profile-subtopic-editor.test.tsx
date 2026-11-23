import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileSubtopicEditor, type ProfileSubtopicEditorProps } from "@/components/profiles/ProfileSubtopicEditor";
import type { ProfileTemplate } from "../../supabase/functions/_shared/profile-template";
import type { ProfileEvidence } from "../../supabase/functions/_shared/profile-evidence";

afterEach(cleanup);

const MARKET = "1.1.1 The market";
const RESEARCH = "1.1.2 Market research";
const GLOBAL = "4.1.1 Growing economies";
const topics = [MARKET, RESEARCH, GLOBAL];
const literal = "a) Mass and niche markets\nb) Market size and market share\nc) Brands and dynamic markets\nKeep every word, including this final outcome about uncertainty.";

function template(overrides: Partial<ProfileTemplate> = {}): ProfileTemplate {
  return {
    schemaVersion: 1,
    identity: {
      country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level",
      subject: "Business", organisation: "Edexcel", course: "9BS0", component: "9BS0/01",
      specificationVersion: "2026", tier: "not_tiered",
    },
    mode: "full_mock", marks: 1, durationMinutes: 2, topics: [...topics], calculator: "allowed",
    sections: [{ id: "s1", title: "Section A", groups: [{ id: "g1", parts: [{
      id: "p1", topic: MARKET, marks: 1, response: "short_answer", demand: "AO1", resource: "none",
    }] }] }],
    warnings: [], designDecisions: [], ...overrides,
  };
}

function evidence(): ProfileEvidence {
  return {
    version: 1, identity: template().identity,
    documents: [{
      id: "spec", checksum: "a".repeat(64), title: "Business specification", url: null,
      version: "2026", kind: "specification", authority: "owner_supplied", retrievedOn: "2026-11-22",
      state: "active", applicableCohort: "2026", locations: [],
    }],
    facts: {
      marks: 1, durationMinutes: 2, topics: [...topics], tier: "not_tiered", calculator: "allowed",
      formats: ["short_answer"], selection: "all_compulsory", mathsRequirement: null, practicalRequirement: null,
    },
    claims: [], unresolved: [], conflicts: [],
    topicDetails: [
      { topic: MARKET, path: ["Theme 1 · Marketing and people", "1.1 Meeting customer needs"], sources: [
        { documentId: "spec", page: 18, text: literal },
        { documentId: "other", page: 19, text: "A second exact source passage, with no invented learning points." },
      ] },
      { topic: RESEARCH, path: ["Theme 1 · Marketing and people", "1.1 Meeting customer needs"], sources: [
        { documentId: "spec", page: 20, text: "Primary and secondary research, with qualitative and quantitative data." },
      ] },
      { topic: GLOBAL, path: ["Theme 4 · Global business", "4.1 Globalisation"], sources: [
        { documentId: "spec", page: 40, text: "Explain the growth of international trade." },
      ] },
    ],
  };
}

function props(overrides: Partial<ProfileSubtopicEditorProps> = {}): ProfileSubtopicEditorProps {
  return {
    template: template(), evidence: evidence(), disabled: false, canUndo: false,
    onRenameTopic: vi.fn(), onRemoveTopics: vi.fn(), onAddTopic: vi.fn(),
    onRestoreTopics: vi.fn(), onUndo: vi.fn(), ...overrides,
  };
}

function expectNoMutation(p: ProfileSubtopicEditorProps) {
  for (const callback of [p.onRenameTopic, p.onRemoveTopics, p.onAddTopic, p.onRestoreTopics, p.onUndo])
    expect(callback).not.toHaveBeenCalled();
}

const search = (value: string) => fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
const row = (name: string) => screen.getByRole("article", { name });
function chooseGroup(label: string) {
  const select = screen.getByRole("combobox", { name: "Filter by syllabus group" });
  const option = within(select).getByRole("option", { name: new RegExp(label) }) as HTMLOptionElement;
  fireEvent.change(select, { target: { value: option.value } });
}

describe("ProfileSubtopicEditor", () => {
  it("shows names and simple path groups immediately, citations before expansion, and every literal source outcome on demand", () => {
    const p = props();
    render(<ProfileSubtopicEditor {...p} />);
    expect(row("The market")).toBeVisible();
    expect(row("Market research")).toBeVisible();
    expect(row("Growing economies")).toBeVisible();
    expect(screen.getByRole("heading", { name: "1.1 Meeting customer needs" })).toBeVisible();
    expect(within(row("The market")).getByRole("heading")).toHaveTextContent("1.1.1");
    expect(within(row("The market")).getByText(/Business specification · PDF page 18/)).toBeVisible();
    expect(screen.queryByRole("list", { name: "Source outcomes for The market" })).not.toBeInTheDocument();
    fireEvent.click(within(row("The market")).getByRole("button", { name: /Show source outcomes/ }));
    const outcomes = within(row("The market")).getByRole("list", { name: "Source outcomes for The market" });
    expect(outcomes.querySelector("blockquote")?.textContent).toBe(literal);
    expect(within(outcomes).getByText("Business specification · physical PDF page 18")).toBeVisible();
    expect(within(outcomes).getByText("Source document · physical PDF page 19")).toBeVisible();
    expect(within(outcomes).getByText(/A second exact source passage/)).toBeVisible();
    expectNoMutation(p);
  });

  it("supports legacy flat labels and unrelated subjects without making up paths or outcomes", () => {
    const p = props({ template: template({ topics: ["Cell membranes", "Mitosis", "Personal topic"], addedTopics: ["Personal topic"] }), evidence: null });
    render(<ProfileSubtopicEditor {...p} />);
    for (const label of ["Cell membranes", "Mitosis", "Personal topic"])
      expect(row(label)).toBeVisible();
    expect(screen.getByText("Added by you")).toBeVisible();
    expect(screen.queryByText(/PDF page/)).not.toBeInTheDocument();
    expect(screen.queryByText("Source outcomes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore subtopics" })).not.toBeInTheDocument();
    expectNoMutation(p);
  });

  it("does not give student additions source provenance even when an exact canonical name matches old evidence", () => {
    render(<ProfileSubtopicEditor {...props({ template: template({ addedTopics: [MARKET] }) })} />);
    const added = within(row("The market"));
    expect(added.getByText("Added by you")).toBeVisible();
    expect(added.getByText("Your own subtopic")).toBeVisible();
    expect(added.queryByText(/PDF page/)).not.toBeInTheDocument();
    expect(added.queryByRole("button", { name: /Show source outcomes/ })).not.toBeInTheDocument();
  });

  it.each([
    ["Markets in my words", "Markets in my words"],
    ["1.1.1", "Markets in my words"],
    ["The market", "Markets in my words"],
    ["uncertainty", "Markets in my words"],
    ["revise on Tuesday", "Markets in my words"],
    ["Globalisation", "Growing economies"],
  ])("searches %s across aliases, codes, original names, full outcomes, notes and paths without mutations", (query, expected) => {
    const p = props({ template: template({ topicEdits: [{ topic: MARKET, label: "Markets in my words", notes: "Remember to revise on Tuesday." }] }) });
    render(<ProfileSubtopicEditor {...p} />);
    search(query);
    expect(row(expected)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 subtopics");
    if (expected === "Markets in my words") {
      expect(within(row(expected)).getByText(/Original source name: 1.1.1 The market/)).toBeVisible();
      expect(within(row(expected)).getByText("Your notes · written by you")).toBeVisible();
      expect(within(row(expected)).getByText("Remember to revise on Tuesday.")).toBeVisible();
      expect(within(row(expected)).getByRole("list", { name: /Source outcomes/ })).toBeVisible();
    }
    expectNoMutation(p);
  });

  it("uses the same view-only group filter in the desktop sidebar and phone select", () => {
    const p = props();
    render(<ProfileSubtopicEditor {...p} />);
    chooseGroup("Theme 4");
    expect(row("Growing economies")).toBeVisible();
    expect(screen.queryByRole("article", { name: "The market" })).not.toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "Filter subtopics" }));
    expect(nav.getByRole("button", { name: /Theme 4/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(nav.getByRole("button", { name: /Theme 1/ }));
    expect(row("The market")).toBeVisible();
    expect(row("Market research")).toBeVisible();
    expect(screen.queryByRole("article", { name: "Growing economies" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue(JSON.stringify(["Theme 1 · Marketing and people"]));
    expectNoMutation(p);
  });

  it("skips a shared subject wrapper for useful section filters and handles an absent active group after parent edits", () => {
    const e = evidence();
    e.topicDetails = e.topicDetails!.map(detail => ({ ...detail, path: ["Business", ...detail.path] }));
    const p = props({ evidence: e });
    const view = render(<ProfileSubtopicEditor {...p} />);
    chooseGroup("Theme 4");
    view.rerender(<ProfileSubtopicEditor {...p} template={template({ topics: [MARKET, RESEARCH] })} />);
    expect(row("The market")).toBeVisible();
    expect(screen.getByRole("combobox")).toHaveValue("all");
    expectNoMutation(p);
  });

  it("edits a display alias and personal notes using the untouched canonical ID", () => {
    const p = props();
    const original = JSON.stringify(p.template);
    render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit The market" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Subtopic name"), { target: { value: "  Markets in my words  " } });
    fireEvent.change(dialog.getByLabelText(/Your notes/), { target: { value: "  My revision reminder.  " } });
    fireEvent.click(dialog.getByRole("button", { name: "Done" }));
    expect(p.onRenameTopic).toHaveBeenCalledExactlyOnceWith(MARKET, "Markets in my words", "My revision reminder.");
    expect(JSON.stringify(p.template)).toBe(original);
    expect(p.template.sections[0].groups[0].parts[0].topic).toBe(MARKET);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves the canonical code and name when changing only personal notes", () => {
    const p = props();
    render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit The market" }));
    expect(screen.getByLabelText("Subtopic name")).toHaveValue("The market");
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: "Draw a market map." } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(p.onRenameTopic).toHaveBeenCalledExactlyOnceWith(MARKET, MARKET, "Draw a market map.");
  });

  it("adds a trimmed student topic and notes, preserves notes through validation, and cancels without mutation", () => {
    const p = props();
    const originalTemplate = JSON.stringify(p.template);
    const originalEvidence = JSON.stringify(p.evidence);
    render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Add subtopic" }));
    const note = "  My own reminder.\nKeep this second line too.  ";
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: note } });
    fireEvent.change(screen.getByLabelText("Subtopic name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a subtopic name.");
    expect(screen.getByLabelText(/Your notes/)).toHaveValue(note);
    fireEvent.change(screen.getByLabelText("Subtopic name"), { target: { value: MARKET } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already in your profile");
    expect(screen.getByLabelText(/Your notes/)).toHaveValue(note);
    expectNoMutation(p);
    fireEvent.change(screen.getByLabelText("Subtopic name"), { target: { value: "  My revision topic  " } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(p.onAddTopic).toHaveBeenCalledExactlyOnceWith("My revision topic", note.trim());
    expect(JSON.stringify(p.template)).toBe(originalTemplate);
    expect(JSON.stringify(p.evidence)).toBe(originalEvidence);
    fireEvent.click(screen.getByRole("button", { name: "Edit The market" }));
    expect(screen.getByLabelText(/Your notes/)).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Subtopic name"), { target: { value: "Discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onRenameTopic).not.toHaveBeenCalled();
  });

  it("round-trips notes on a student addition through parent metadata and passes empty notes explicitly", () => {
    const p = props();
    const view = render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Add subtopic" }));
    fireEvent.change(screen.getByLabelText("Subtopic name"), { target: { value: "My new topic" } });
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: "My private reminder about trade." } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(p.onAddTopic).toHaveBeenCalledExactlyOnceWith("My new topic", "My private reminder about trade.");
    const next = template({
      topics: [...topics, "My new topic"], addedTopics: ["My new topic"],
      topicEdits: [{ topic: "My new topic", notes: "My private reminder about trade." }],
    });
    view.rerender(<ProfileSubtopicEditor {...p} template={next} />);
    search("private reminder");
    expect(within(row("My new topic")).getByText("My private reminder about trade.")).toBeVisible();
    expect(within(row("My new topic")).getByText("Your notes · written by you")).toBeVisible();
    expect(within(row("My new topic")).queryByText(/PDF page/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit My new topic" }));
    expect(screen.getByLabelText("Subtopic name")).toHaveValue("My new topic");
    expect(screen.getByLabelText(/Your notes/)).toHaveValue("My private reminder about trade.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add subtopic" }));
    expect(screen.getByLabelText(/Your notes/)).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Subtopic name"), { target: { value: "Another topic" } });
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(p.onAddTopic).toHaveBeenLastCalledWith("Another topic", "");
    expect(p.onRenameTopic).not.toHaveBeenCalled();
  });

  it("removes an aliased row by canonical ID and gives row actions 44px targets", () => {
    const p = props({ template: template({ topicEdits: [{ topic: MARKET, label: "My market label" }] }) });
    render(<ProfileSubtopicEditor {...p} />);
    for (const name of ["Edit My market label", "Remove My market label"])
      expect(screen.getByRole("button", { name })).toHaveClass("h-11", "min-w-11");
    fireEvent.click(screen.getByRole("button", { name: "Remove My market label" }));
    expect(p.onRemoveTopics).toHaveBeenCalledExactlyOnceWith([MARKET]);
    expect(p.template.topics).toEqual(topics);
  });

  it("makes bulk selection across filtered views explicit and sends one canonical removal callback", () => {
    const p = props();
    render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Select topics" }));
    chooseGroup("Theme 1");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select The market" }));
    chooseGroup("Theme 4");
    expect(screen.getByText("1 selected (1 outside this view)")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Growing economies" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove selected" }));
    expect(p.onRemoveTopics).toHaveBeenCalledExactlyOnceWith([MARKET, GLOBAL]);
    expect(screen.getByText("0 selected")).toBeVisible();
  });

  it("prevents direct or bulk removal of the final subtopic, including stale selections after a parent rerender", () => {
    const p = props();
    const view = render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Select topics" }));
    fireEvent.click(screen.getByRole("button", { name: "Select shown" }));
    expect(screen.getByText("Keep at least one subtopic in your profile.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove selected" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove selected" }));
    view.rerender(<ProfileSubtopicEditor {...p} template={template({ topics: [MARKET] })} />);
    expect(screen.getByRole("button", { name: "Remove The market" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove selected" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove The market" }));
    expectNoMutation(p);
  });

  it("delegates undo and restore to the parent and renders restored parent snapshots", () => {
    const original = template();
    const p = props({ template: template({ topics: [MARKET, RESEARCH], mode: "custom" }), canUndo: true });
    const view = render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo last topic change" }));
    expect(p.onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByRole("article", { name: "Growing economies" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore subtopics" }));
    expect(p.onRestoreTopics).toHaveBeenCalledOnce();
    view.rerender(<ProfileSubtopicEditor {...p} template={original} canUndo={false} />);
    expect(row("Growing economies")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Undo last topic change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore subtopics" })).not.toBeInTheDocument();
    expect(p.onRemoveTopics).not.toHaveBeenCalled();
  });

  it("disables mutations while busy, including an already open editor, but keeps searching and filtering available", () => {
    const p = props({ canUndo: true });
    const view = render(<ProfileSubtopicEditor {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit The market" }));
    view.rerender(<ProfileSubtopicEditor {...p} disabled />);
    expect(screen.getByLabelText("Subtopic name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    for (const name of ["Add subtopic", "Edit The market", "Remove The market", "Undo last topic change"])
      expect(screen.getByRole("button", { name })).toBeDisabled();
    search("international trade");
    expect(row("Growing economies")).toBeVisible();
    chooseGroup("Theme 1");
    expect(screen.getByText("No matching subtopics. Try another search or group.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("status")).toHaveTextContent("3 subtopics");
    expectNoMutation(p);
  });

  it("handles empty lists and capacity limits without offering an impossible add", () => {
    const p = props({ template: template({ topics: [] }), evidence: null });
    const view = render(<ProfileSubtopicEditor {...p} />);
    expect(screen.getByText("No subtopics yet. Add a subtopic to get started.")).toBeVisible();
    view.rerender(<ProfileSubtopicEditor {...p} template={template({ topics: Array.from({ length: 400 }, (_, i) => `Topic ${i}`) })} />);
    expect(screen.getAllByRole("article")).toHaveLength(400);
    expect(screen.getByRole("button", { name: "Add subtopic" })).toBeDisabled();
  });

  it("escapes owner text and never promotes mismatched or invalid source details into citations", () => {
    const e = evidence();
    e.topicDetails = [{ topic: MARKET.toLowerCase(), path: ["Wrong case"], sources: [{ documentId: "spec", page: 9, text: "Wrong topic outcomes" }] },
      { topic: RESEARCH, path: [], sources: [{ documentId: "spec", page: 0, text: "Invalid page outcome" }] }];
    const p = props({ evidence: e, template: template({ topicEdits: [{ topic: MARKET, label: "<script>alert(1)</script>", notes: "<img src=x onerror=alert(2)>" }] }) });
    render(<ProfileSubtopicEditor {...p} />);
    search("onerror");
    expect(row("<script>alert(1)</script>")).toBeVisible();
    expect(screen.getByText("<img src=x onerror=alert(2)>")).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByText(/PDF page/)).not.toBeInTheDocument();
    expectNoMutation(p);
  });
});
