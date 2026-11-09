import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  BuilderFollowupQuestions,
  type BuilderMissingItem,
} from "@/components/profiles/BuilderFollowupQuestions";

afterEach(cleanup);
const assessment: BuilderMissingItem = {
  field: "assessment",
  question: "Which assessment are you preparing for?",
  choices: [
    { value: "paper-1", label: "Paper 1" },
    { value: "unit-2", label: "Unit 2 — Written assessment" },
  ],
};
const summary = [
  { label: "Subject", value: "Physics" },
  { label: "Exam board", value: "AQA" },
  { label: "Level", value: "A-level" },
];

it("lets phones enter ranges and lists and avoids adding a suggested page twice", () => {
  const onAnswer = vi.fn();
  render(<BuilderFollowupQuestions jobId="page-build" summary={summary} onChange={vi.fn()} onAnswer={onAnswer} items={[{ field: "source_pages", question: "Which PDF pages show the assessment?", choices: [{ value: "1:8", label: "Page 8" }, { value: "1:9", label: "Page 9" }] }]} />);
  const input = screen.getByLabelText("Which PDF pages show the assessment?");
  expect(input).toHaveAttribute("inputmode", "text");
  fireEvent.click(screen.getByRole("button", { name: "Page 8" }));
  fireEvent.click(screen.getByRole("button", { name: "Page 8" }));
  expect(input).toHaveValue("8");
  fireEvent.change(input, { target: { value: "8-10, 12" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ source_pages: "8-10, 12" });
});

it("asks only the one missing detail and keeps known choices read-only", () => {
  const onAnswer = vi.fn(),
    onChange = vi.fn();
  render(
    <BuilderFollowupQuestions
      jobId="same-build"
      items={[assessment]}
      summary={summary}
      onAnswer={onAnswer}
      onChange={onChange}
    />,
  );
  expect(screen.getAllByRole("combobox")).toHaveLength(1);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByText("A-level")).toBeVisible();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(assessment.question), {
    target: { value: "unit-2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ assessment: "unit-2" });
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  expect(onChange).toHaveBeenCalledOnce();
  expect(screen.getByLabelText(assessment.question)).toHaveValue("unit-2");
});

it("asks one of two missing questions at a time, then accepts only the next answer", () => {
  const onAnswer = vi.fn(),
    onChange = vi.fn();
  const module = {
    field: "module",
    question: "Which option does your class study?",
  };
  const view = render(
    <BuilderFollowupQuestions
      jobId="same-build"
      items={[assessment, module]}
      summary={summary}
      onAnswer={onAnswer}
      onChange={onChange}
    />,
  );
  expect(screen.getAllByRole("combobox")).toHaveLength(1);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(module.question)).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Paper / component code"),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(assessment.question), {
    target: { value: "paper-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onAnswer).toHaveBeenLastCalledWith({ assessment: "paper-1" });
  view.rerender(
    <BuilderFollowupQuestions
      jobId="same-build"
      items={[module]}
      summary={summary}
      onAnswer={onAnswer}
      onChange={onChange}
    />,
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByLabelText(module.question)).toHaveValue("");
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(module.question), {
    target: { value: "  Astrophysics  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onAnswer).toHaveBeenLastCalledWith({ module: "Astrophysics" });
});

it("uses a focused source picker when a new readable document is genuinely needed", () => {
  render(
    <BuilderFollowupQuestions
      jobId="same-build"
      items={[
        {
          field: "source",
          question: "Can you add a readable assessment brief?",
        },
      ]}
      summary={summary}
      onAnswer={vi.fn()}
      onChange={vi.fn()}
      sourcePicker={<button>Choose files</button>}
    />,
  );
  expect(screen.getByRole("button", { name: "Choose files" })).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Continue" }),
  ).not.toBeInTheDocument();
});

it("disables every editable action during continuation", () => {
  const onAnswer = vi.fn();
  render(
    <BuilderFollowupQuestions
      jobId="same-build"
      items={[assessment]}
      summary={summary}
      onAnswer={onAnswer}
      onChange={vi.fn()}
      busy
    />,
  );
  expect(screen.getByLabelText(assessment.question)).toBeDisabled();
  expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
  expect(onAnswer).not.toHaveBeenCalled();
});
