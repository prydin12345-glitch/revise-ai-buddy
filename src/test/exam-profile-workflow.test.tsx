import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExamProfileModal } from "@/components/stats/ExamProfileModal";
import { ProfileTopicBrowser } from "@/components/stats/profile/ProfileTopicBrowser";
import { ProfilePaperPreview } from "@/components/stats/profile/ProfilePaperPreview";
import { ExamProfileCard } from "@/components/subjects/ExamProfileCard";
import { buildPaperPlan } from "@/lib/biology-paper-contract";

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
const page = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Profile setup" })).getByRole(
      "button",
      { name },
    ),
  );

describe("Exam profile workflow", () => {
  it("starts creation at Basics and validates an attempted step, without pre-emptive warnings", () => {
    editor();
    expect(screen.getByLabelText("Profile name")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create Profile" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Give your profile a name.",
    );
    expect(screen.getByRole("button", { name: "Basics" })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("keeps counts, structure, selected topics and an exact duration while moving backwards", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Mixed" }));
    fireEvent.change(screen.getByLabelText("Search topics"), {
      target: { value: "Coasts" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Coasts" }));
    fireEvent.change(screen.getByLabelText("Search topics"), {
      target: { value: "Weather" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Weather" }));
    fireEvent.click(screen.getByRole("switch", { name: "Timed paper" }));
    fireEvent.change(screen.getByLabelText("Time limit in minutes"), {
      target: { value: "42" },
    });
    page("Basics");
    expect(screen.getByLabelText("Written questions")).toHaveValue(6);
    expect(screen.getByLabelText("Multiple choice")).toHaveValue(2);
    page("Your paper");
    expect(screen.getByRole("button", { name: "Mixed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Selected" }));
    expect(screen.getByRole("checkbox", { name: "Coasts" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Weather" })).toBeChecked();
    expect(screen.getByLabelText("Time limit in minutes")).toHaveValue(42);
    page("Review");
    fireEvent.click(screen.getByRole("button", { name: "Create Profile" }));
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][1]).toEqual(["Coasts", "Weather"]);
    expect(save.mock.calls[0][2]).toBe(8);
    expect(save.mock.calls[0][4]).toBe(42);
    expect(save.mock.calls[0][7].questionStructure).toBe("mixed");
  });

  it("opens editing at Review and retains the existing save contract without visiting every page", () => {
    const save = editor(base);
    expect(screen.getByRole("button", { name: "Review" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.queryByLabelText("Profile name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));
    expect(save.mock.calls[0][0]).toBe(base.profile_name);
    expect(save.mock.calls[0][1]).toEqual(base.topics);
    expect(save.mock.calls[0][4]).toBe(42);
    expect(save.mock.calls[0][5].calculatorPolicy).toBe("not_allowed");
    expect(save.mock.calls[0][7].questionStructure).toBe("standalone");
  });

  it("puts Advanced behind the header icon and preserves edits when it closes", async () => {
    const save = editor(base);
    fireEvent.click(screen.getByRole("button", { name: "Advanced settings" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Calculator allowed" }),
    );
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Calculator allowed" }),
      { key: "Escape" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));
    expect(save.mock.calls[0][5].calculatorPolicy).toBe("allowed");
    expect(save.mock.calls[0][4]).toBe(42);
  });

  it("keeps Geography sections, marks and optional-question counts when saving", () => {
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
    page("Sections & marks");
    expect(screen.getByLabelText("Students answer")).toHaveValue(1);
    fireEvent.change(screen.getByLabelText("Section name"), {
      target: { value: "Rivers and coasts" },
    });
    fireEvent.change(screen.getByLabelText("Question 2 marks"), {
      target: { value: "9" },
    });
    page("Review");
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));
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

  it("previews the real guided plan and prevents edits to its topics and duration", () => {
    const plan = buildPaperPlan(
      "full_mock",
      "higher",
      "aqa_gcse_biology",
      "paper_2",
    )!;
    const save = editor(
      {
        ...base,
        assessment_tier: "higher",
        mcq_count: 9,
        written_question_count: 27,
        question_count: 36,
        topics: ["Ecology"],
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
    page("Your paper");
    for (const part of plan.parts)
      expect(screen.getByTestId("profile-paper-preview")).toHaveTextContent(
        `Q${part.questionNumber}`,
      );
    for (const checkbox of screen
      .getAllByRole("checkbox")
      .filter(
        (input) =>
          input !==
          screen.getByRole("checkbox", { name: /Interactive answer formats/ }),
      ))
      expect(checkbox).toBeDisabled();
    expect(screen.getByLabelText("Time limit in minutes")).toBeDisabled();
    expect(screen.getByLabelText("Time limit in minutes")).toHaveValue(105);
    expect(
      screen.queryByRole("button", { name: "Customise sections & marks" }),
    ).toBeNull();
    page("Review");
    fireEvent.click(screen.getByRole("button", { name: "Update Profile" }));
    expect(save.mock.calls[0][2]).toBe(36);
    expect(
      save.mock.calls[0][5].paperBlueprint.paperContract.contractVersion,
    ).toBe(plan.contractVersion);
  });

  it("blocks invalid time input before saving", () => {
    const save = editor(base);
    page("Your paper");
    fireEvent.change(screen.getByLabelText("Time limit in minutes"), {
      target: { value: "-1" },
    });
    expect(
      screen.getByRole("button", { name: "Update Profile" }),
    ).toBeDisabled();
    page("Review");
    expect(screen.getByRole("status")).toHaveTextContent("whole number");
    expect(save).not.toHaveBeenCalled();
  });
});

it("search and sorting do not mutate topic selection; bulk topics are deduplicated", () => {
  const change = vi.fn();
  const view = render(
    <ProfileTopicBrowser
      allTopics={["Rivers", "Coasts"]}
      selectedTopics={["Rivers"]}
      onChange={change}
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
  fireEvent.click(screen.getByRole("button", { name: "Add your own" }));
  fireEvent.change(screen.getByLabelText("New topics"), {
    target: {
      value: "[Hazards](https://example.com), hazards, RIVERS, Coasts",
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
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
