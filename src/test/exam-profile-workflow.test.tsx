import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExamProfileModal } from "@/components/stats/ExamProfileModal";
import { CustomProfileTopics } from "@/components/stats/profile/CustomProfileTopics";
import { ProfilePaperPreview } from "@/components/stats/profile/ProfilePaperPreview";
import { ExamProfileCard } from "@/components/subjects/ExamProfileCard";
import { buildPaperPlan } from "@/lib/biology-paper-contract";
import { openMoreQuestionSettings, saveProfile } from "./profile-test-render";

vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: { preferred_educational_level: "level2" },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(),
  },
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Object.defineProperty(HTMLElement.prototype, "scrollTo", {
  configurable: true,
  value: vi.fn(),
});
afterEach(cleanup);
const base = {
  profile_name: "My geography paper",
  topics: ["Rivers"],
  question_count: 6,
  written_question_count: 5,
  mcq_count: 1,
  educational_tier: "level2",
  time_limit_minutes: 42,
  question_structure: "standalone",
  calculator_policy: "not_allowed",
};
function editor(initialData?: any, options: Record<string, any> = {}) {
  const save = vi.fn();
  render(
    <ExamProfileModal
      open
      onOpenChange={() => {}}
      subjectName="Geography"
      subjectColor="#bc6418"
      examBoard="AQA"
      availableTopics={["Weather", "Rivers", "Coasts"]}
      onSave={save}
      initialData={initialData}
      {...options}
    />,
  );
  return save;
}
const page = (name: string | RegExp) =>
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Profile sections" })).getByRole(
      "button",
      { name },
    ),
  );

describe("Exam profile workflow", () => {
  it("starts creation at Setup and validates Continue without pre-emptive warnings", () => {
    editor();
    expect(screen.getByLabelText("Profile name")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create Profile" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Give your profile a name.",
    );
    expect(screen.getByLabelText("Profile name")).toBeVisible();
    expect(screen.queryByLabelText("Search topics")).toBeNull();
  });

  it("keeps counts, structure, selected topics and an exact duration while moving backwards", async () => {
    const save = editor();
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "Coasts revision" },
    });
    fireEvent.change(screen.getByLabelText("Written questions"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Multiple choice"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Topics 0" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    page("Paper layout");
    fireEvent.click(screen.getByRole("button", { name: "Mixed" }));
    expect(screen.getByTestId("profile-paper-preview")).toHaveTextContent(
      "Example layout",
    );
    page(/^Topics \d+$/);
    fireEvent.click(screen.getByRole("button", { name: /^Topic library \d+$/ }));
    fireEvent.change(screen.getByLabelText("Search topics"), {
      target: { value: "Coasts" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Coasts" }));
    fireEvent.change(screen.getByLabelText("Search topics"), {
      target: { value: "Weather" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Weather" }));
    page("Exam settings");
    openMoreQuestionSettings();
    fireEvent.click(screen.getByRole("switch", { name: "Timed paper" }));
    fireEvent.change(screen.getByLabelText("Time limit in minutes"), {
      target: { value: "42" },
    });
    expect(screen.getByLabelText("Written questions")).toHaveValue(6);
    expect(screen.getByLabelText("Multiple choice")).toHaveValue(2);
    page("Paper layout");
    expect(screen.getByRole("button", { name: "Mixed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    page(/^Topics 2$/);
    expect(screen.getByRole("article", { name: "Coasts" })).toBeVisible();
    expect(screen.getByRole("article", { name: "Weather" })).toBeVisible();
    page("Exam settings");
    openMoreQuestionSettings();
    expect(screen.getByLabelText("Time limit in minutes")).toHaveValue(42);
    expect(screen.getByRole("button", { name: "Create Profile" })).toHaveTextContent("Create profile");
    await saveProfile("Create Profile");
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][1]).toEqual(["Coasts", "Weather"]);
    expect(save.mock.calls[0][2]).toBe(8);
    expect(save.mock.calls[0][4]).toBe(42);
    expect(save.mock.calls[0][7].questionStructure).toBe("mixed");
  });

  it("opens editing at Topics and retains the save contract without visiting every tab", async () => {
    const save = editor(base);
    expect(screen.getByRole("button", { name: "Topics 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const navigation = within(
      screen.getByRole("navigation", { name: "Profile sections" }),
    );
    expect(navigation.getAllByRole("button")).toHaveLength(3);
    expect(navigation.getByRole("button", { name: "Exam settings" })).toBeVisible();
    expect(navigation.getByRole("button", { name: "Paper layout" })).toBeVisible();
    expect(screen.getByRole("article", { name: "Rivers" })).toBeVisible();
    expect(screen.queryByRole("article", { name: "Weather" })).toBeNull();
    expect(screen.queryByLabelText("Profile name")).toBeNull();
    expect(screen.getByRole("button", { name: "Update Profile" })).toHaveTextContent("Save changes");
    await saveProfile();
    expect(save.mock.calls[0][0]).toBe(base.profile_name);
    expect(save.mock.calls[0][1]).toEqual(base.topics);
    expect(save.mock.calls[0][4]).toBe(42);
    expect(save.mock.calls[0][5].calculatorPolicy).toBe("not_allowed");
    expect(save.mock.calls[0][7].questionStructure).toBe("standalone");
  });

  it("keeps advanced edits in Exam settings when More question settings closes", async () => {
    const save = editor(base);
    expect(
      screen.queryByRole("button", { name: "Advanced settings" }),
    ).toBeNull();
    page("Exam settings");
    openMoreQuestionSettings();
    fireEvent.click(screen.getByRole("button", { name: "Calculator allowed" }));
    fireEvent.click(screen.getByText("More question settings"));
    page("Paper layout");
    page("Exam settings");
    openMoreQuestionSettings();
    expect(screen.getByLabelText("Time limit in minutes")).toHaveValue(42);
    await saveProfile();
    expect(save.mock.calls[0][5].calculatorPolicy).toBe("allowed");
    expect(save.mock.calls[0][4]).toBe(42);
  });

  it("keeps Geography sections, marks and optional-question counts when saving", async () => {
    const sections = [
      {
        title: "Physical geography",
        answerCount: 1,
        questions: [
          { marks: 4, style: "Identify from a figure" },
          { marks: 6, style: "Analyse data / calculation" },
        ],
      },
    ];
    const save = editor({
      ...base,
      question_count: 2,
      written_question_count: 2,
      mcq_count: 0,
      paper_blueprint: { sections },
    });
    page("Paper layout");
    expect(screen.getByLabelText("Students answer")).toHaveValue(1);
    fireEvent.change(screen.getByLabelText("Section name"), {
      target: { value: "Rivers and coasts" },
    });
    fireEvent.change(screen.getByLabelText("Question 2 marks"), {
      target: { value: "9" },
    });
    page("Exam settings");
    page("Paper layout");
    expect(screen.getByLabelText("Students answer")).toHaveValue(1);
    expect(screen.getByLabelText("Question 2 marks")).toHaveValue(9);
    await saveProfile();
    expect(save.mock.calls[0][5].paperBlueprint.sections).toEqual([
      {
        ...sections[0],
        title: "Rivers and coasts",
        questions: [
          sections[0].questions[0],
          { ...sections[0].questions[1], marks: 9 },
        ],
      },
    ]);
    expect(save.mock.calls[0][2]).toBe(2);
    expect(save.mock.calls[0][5].mcqCount).toBe(0);
  });

  it("preserves a saved 25-question layout in the profile patch after section and mark edits", async () => {
    const questions = Array.from({ length: 25 }, (_, index) => ({
      marks: 4,
      style: "Explain / describe",
      rubric: `Saved rubric ${index + 1}`,
    }));
    const section = { title: "Physical geography", questions };
    const save = editor({
      ...base,
      question_count: 25,
      written_question_count: 25,
      mcq_count: 0,
      paper_blueprint: { sections: [section] },
    });

    page("Paper layout");
    fireEvent.change(screen.getByLabelText("Section name"), {
      target: { value: "Rivers and coasts" },
    });
    fireEvent.change(screen.getByLabelText("Question 25 marks"), {
      target: { value: "9" },
    });
    page("Exam settings");
    expect(screen.getByLabelText("Written questions")).toHaveValue(25);
    await saveProfile();

    expect(save).toHaveBeenCalledOnce();
    const args = save.mock.calls[0];
    expect(args[2]).toBe(25);
    expect(args[6]).toBe(25);
    expect(args[5].profilePatch).toMatchObject({
      question_count: 25,
      written_question_count: 25,
      mcq_count: 0,
    });
    expect(args[5].profilePatch.paper_blueprint.sections).toEqual([
      {
        ...section,
        title: "Rivers and coasts",
        questions: questions.map((question, index) =>
          index === 24 ? { ...question, marks: 9 } : question,
        ),
      },
    ]);
  });

  it("blocks saving an unadded studied title, guards closing and clears it for another profile", async () => {
    const profiles = [
      {
        ...base,
        profile_name: "Shakespeare revision",
        topics: ["Shakespeare"],
        studied_texts: [
          { role: "shakespeare", title: "The Tempest", edition: "Annotated" },
        ],
      },
      {
        ...base,
        profile_name: "Poetry revision",
        topics: ["Poetry"],
        studied_texts: [
          { role: "poetry_anthology", title: "Power and conflict", edition: "School" },
        ],
      },
    ];
    const originalProfiles = structuredClone(profiles);
    const save = vi.fn();
    const changeOpen = vi.fn();
    function Editor() {
      const [open, setOpen] = useState(true);
      const [profile, setProfile] = useState(profiles[0]);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setProfile(profiles[1]);
              setOpen(true);
            }}
          >
            Open another profile
          </button>
          <ExamProfileModal
            open={open}
            onOpenChange={(value) => {
              changeOpen(value);
              setOpen(value);
            }}
            subjectName="English Literature"
            subjectColor="#bc6418"
            examBoard="AQA"
            availableTopics={["Shakespeare", "Poetry"]}
            initialData={profile}
            onSave={save}
          />
        </>
      );
    }
    render(<Editor />);
    fireEvent.click(screen.getByText(/^Studied texts/, { selector: "summary" }));
    expect(screen.getByRole("button", { name: "Remove The Tempest" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Studied content type"), {
      target: { value: "modern_drama" },
    });
    fireEvent.change(screen.getByLabelText("Studied texts"), {
      target: { value: "An Inspector Calls" },
    });

    expect(screen.getByRole("button", { name: "Update Profile" })).toBeDisabled();
    expect(
      screen.getByText("Add the studied content, or clear its title before saving."),
    ).toHaveAttribute("role", "status");
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close profile" }));
    const confirmation = screen.getByRole("alertdialog", {
      name: "Discard unsaved changes?",
    });
    expect(changeOpen).not.toHaveBeenCalled();
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Discard and continue" }),
    );
    await waitFor(() => expect(changeOpen).toHaveBeenCalledWith(false));
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open another profile" }));
    fireEvent.click(screen.getByText(/^Studied texts/, { selector: "summary" }));
    expect(screen.getByLabelText("Studied texts")).toBeVisible();
    expect(screen.getByLabelText("Studied texts")).toHaveValue("");
    expect(screen.getByLabelText("Studied content type")).toHaveValue("shakespeare");
    expect(screen.getByRole("button", { name: "Remove Power and conflict" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remove The Tempest" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove An Inspector Calls" })).toBeNull();
    expect(screen.getByRole("button", { name: "Update Profile" })).toBeEnabled();
    await saveProfile();
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][5].profilePatch.studied_texts).toEqual(
      originalProfiles[1].studied_texts,
    );
    expect(profiles).toEqual(originalProfiles);
  });

  it("previews the real guided plan and prevents edits to its topics and duration", async () => {
    const plan = buildPaperPlan(
      "full_mock",
      "higher",
      "aqa_gcse_biology",
      "paper_2",
    )!;
    const topics = ["Ecology"];
    const save = editor(
      {
        ...base,
        assessment_tier: "higher",
        mcq_count: 9,
        written_question_count: 27,
        question_count: 36,
        topics,
        paper_blueprint: {
          courseSelection: { courseId: plan.courseId, paperId: plan.paperId },
          paperContract: {
            courseId: plan.courseId,
            paperId: plan.paperId,
            mode: plan.mode,
            contractVersion: plan.contractVersion,
          },
        },
      },
      { subjectName: "Biology Higher" },
    );
    page("Paper layout");
    const fullPreview = screen.getByText("Full paper preview");
    fireEvent.click(fullPreview);
    const preview = within(fullPreview.closest("details")!).getByTestId(
      "profile-paper-preview",
    );
    for (const part of plan.parts)
      expect(within(preview).getByText(`Q${part.questionNumber}`)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Customise sections & marks" }),
    ).toBeNull();
    page(/^Topics \d+$/);
    for (const topic of topics) {
      expect(screen.getByRole("button", { name: `Edit ${topic}` })).toBeDisabled();
      expect(screen.getByRole("button", { name: `Remove ${topic}` })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Add topic" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Topic library \d+$/ }));
    const topicCheckboxes = screen.getAllByRole("checkbox");
    expect(topicCheckboxes).toHaveLength(topics.length);
    for (const checkbox of topicCheckboxes) {
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    }
    page("Exam settings");
    openMoreQuestionSettings();
    expect(screen.getByRole("switch", { name: "Timed paper" })).toBeDisabled();
    expect(screen.getByLabelText("Time limit in minutes")).toBeDisabled();
    expect(screen.getByLabelText("Time limit in minutes")).toHaveValue(105);
    await saveProfile();
    expect(save.mock.calls[0][2]).toBe(36);
    expect(
      save.mock.calls[0][5].paperBlueprint.paperContract.contractVersion,
    ).toBe(plan.contractVersion);
  });

  it("blocks invalid time input before saving", () => {
    const save = editor(base);
    page("Exam settings");
    openMoreQuestionSettings();
    fireEvent.change(screen.getByLabelText("Time limit in minutes"), {
      target: { value: "-1" },
    });
    expect(
      screen.getByRole("button", { name: "Update Profile" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("whole number");
    page("Paper layout");
    expect(screen.getByRole("button", { name: "Update Profile" })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
});

it("search and sorting do not mutate topic selection; bulk topics are deduplicated", async () => {
  const change = vi.fn();
  const view = render(
    <CustomProfileTopics
      allTopics={["Rivers", "Coasts"]}
      topics={["Rivers"]}
      onChange={change}
      getTopicLabel={(topic) => topic}
      onRename={vi.fn()}
      onUndo={vi.fn()}
      canUndo={false}
      subjectName="Geography"
      accent="#bc6418"
    />,
  );
  fireEvent.change(screen.getByLabelText("Search topics"), {
    target: { value: "Coasts" },
  });
  fireEvent.change(screen.getByLabelText("Sort topics"), {
    target: { value: "alphabetical" },
  });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^Topic library \d+$/ }));
  expect(screen.getByRole("checkbox", { name: "Include Rivers" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Include Coasts" })).not.toBeChecked();
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Add topic" }));
  fireEvent.change(screen.getByLabelText("New topics"), {
    target: {
      value: "[Hazards](https://example.com), hazards, RIVERS, Coasts",
    },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
  });
  expect(change).toHaveBeenCalledWith(["Rivers", "hazards", "Coasts"]);
  view.unmount();
});

it("renders every guided part with the saved marks, rather than a generic geography example", () => {
  const plan = buildPaperPlan(
    "short_practice",
    "higher",
    "aqa_gcse_biology",
    "paper_2",
  )!;
  const { container } = render(
    <ProfilePaperPreview
      plan={plan}
      subjectName="Biology"
      structure="mixed"
      writtenCount={6}
      mcqCount={2}
      parentCount={2}
      maxParts={3}
    />,
  );
  for (const part of plan.parts)
    expect(screen.getByText(`Q${part.questionNumber}`)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/erosion|gradient|correct_answer/);
  expect(container.textContent).toContain(`[${plan.parts[0].marks}]`);
});

it("shows saved paper identity on cards and keeps editing separate from history navigation", () => {
  const edit = vi.fn();
  const profile = {
    ...base,
    id: "synthetic",
    assessment_tier: "higher",
    topics: ["Ecology"],
    paper_blueprint: {
      courseSelection: { courseId: "aqa_gcse_biology", paperId: "paper_2" },
      paperContract: {
        courseId: "aqa_gcse_biology",
        paperId: "paper_2",
        mode: "full_mock",
        contractVersion: 1,
      },
    },
  };
  render(
    <MemoryRouter>
      <ExamProfileCard
        profile={profile}
        subjectName="Biology"
        subjectColor="#246746"
        onEdit={edit}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/8461\/2H/)).toBeInTheDocument();
  expect(screen.getByText("36 parts")).toBeInTheDocument();
  expect(screen.getByText("105 min")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: `Edit ${profile.profile_name}` }),
  );
  expect(edit).toHaveBeenCalledOnce();
});
