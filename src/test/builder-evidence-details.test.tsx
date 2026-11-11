import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BuilderEvidenceDetails } from "@/components/profiles/BuilderEvidenceDetails";
import type { SourceJobView } from "@/lib/profile-builder-client";

afterEach(cleanup);
const job: SourceJobView = {
  jobId: "source-receipt",
  stage: "failed",
  mode: "full_mock",
  progress: { completed: 0, total: 2 },
  message: "Source checking stopped.",
};

it("explains which requested physical pages were excluded without claiming they supplied evidence", () => {
  render(<BuilderEvidenceDetails job={{ ...job, stage: "reading", pageReview: [{ document: 1, requestedPages: [8, 9, 10], readPages: [8, 9], skippedPages: [10] }] }} />);
  expect(screen.getByRole("status")).toHaveTextContent("PDF pages selected for reading: 8, 9.");
  expect(screen.getByRole("status")).toHaveTextContent("PDF pages 10 were skipped because they could not be safely matched to this assessment.");
  expect(screen.queryByText(/Examly-approved/)).not.toBeInTheDocument();
});

it("shows both failed checks without exposing private rejected model details", () => {
  const issues = [
    {
      attempt: 1,
      stage: "extraction" as const,
      code: "contradictory_fact",
      message: "The mark total did not match the assessment evidence.",
      detail: "PRIVATE_REJECTED_JSON_FIRST",
    },
    {
      attempt: 2,
      stage: "extraction" as const,
      code: "unmatched_quote",
      message:
        "A quoted source passage did not match the supplied document text.",
      detail: "PRIVATE_REJECTED_JSON_SECOND",
    },
  ];
  const view = render(
    <BuilderEvidenceDetails job={{ ...job, validationIssues: issues }} />,
  );
  expect(screen.getByLabelText("Profile validation details")).toHaveAttribute(
    "open",
  );
  expect(screen.getByText("Attempt 1")).toBeVisible();
  expect(screen.getByText("Attempt 2")).toBeVisible();
  expect(view.container).toHaveTextContent(issues[0].message);
  expect(view.container).toHaveTextContent(issues[1].message);
  expect(view.container.textContent).not.toContain("PRIVATE_REJECTED_JSON");
});

it("distinguishes course-catalogue tiering from optional official instruction sources", () => {
  render(
    <BuilderEvidenceDetails
      job={{
        ...job,
        stage: "ready",
        reviewedFacts: {
          tier: {
            value: "not_tiered",
            source: "assessment_catalogue",
            courseId: "aqa_alevel_physics_7408",
          },
          assessmentInstructions: {
            rulePackId: "reviewed-paper1",
            selection: "all_compulsory",
            calculator: "allowed",
            sourceUrls: ["https://www.aqa.org.uk/paper1.pdf"],
          },
        },
      }}
    />,
  );
  expect(
    screen.getByLabelText("Verified assessment facts"),
  ).not.toHaveAttribute("open");
  expect(
    screen.getByText(/Untiered — verified from the course catalogue/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", {
      name: "Official assessment instructions",
      hidden: true,
    }),
  ).toHaveAttribute("href", "https://www.aqa.org.uk/paper1.pdf");
  expect(
    screen.queryByLabelText("Profile validation details"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Examly-approved/)).not.toBeInTheDocument();
});

it("keeps historical resolved checks out of a successful review", () => {
  render(
    <BuilderEvidenceDetails
      job={{
        ...job,
        stage: "complete",
        validationIssues: [
          {
            attempt: 1,
            stage: "extraction",
            code: "missing_reference",
            message: "Earlier source reference needed checking.",
          },
        ],
      }}
    />,
  );
  expect(
    screen.queryByLabelText("Profile validation details"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Verified assessment facts"),
  ).not.toBeInTheDocument();
});

it("distinguishes a located but blocked page from a missing assessment and shows printed labels", () => {
  render(<BuilderEvidenceDetails job={{ ...job, pageReview: [{
    document: 1, requestedPages: [14, 15], readPages: [], skippedPages: [14, 15],
    diagnostics: [
      {page: 14, printedPage: 12, status: "blocked", code: "qualification_scope", reason: "The qualification cannot be established from the source."},
      {page: 15, status: "not_matched", code: "assessment_not_found"},
    ],
  }] }} />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("PDF page 14 (printed page 12): located, but could not be used.");
  expect(status).toHaveTextContent("The qualification cannot be established from the source.");
  expect(status).toHaveTextContent("PDF page 15: the selected assessment was not found on this page.");
  expect(status).not.toHaveTextContent("None of the selected PDF pages could be matched");
});
