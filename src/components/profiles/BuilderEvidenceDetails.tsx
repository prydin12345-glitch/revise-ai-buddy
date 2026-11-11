import type { SourceJobView } from "@/lib/profile-builder-client";

export function BuilderEvidenceDetails({ job }: { job: SourceJobView }) {
  const facts = job.reviewedFacts;
  const showIssues =
    ["failed", "needs_details"].includes(job.stage) &&
    job.validationIssues?.length;
  return (
    <>
      {job.manualComponentCode && (
        <p className="text-sm text-muted-foreground">
          Component code: <span className="font-medium text-foreground">{job.manualComponentCode.value}</span>
          {job.manualComponentCode.status === "source_verified" ? " · verified in your source" : " · user-entered reference"}
        </p>
      )}
      {job.pageReview?.map((review) => (
        <p
          key={review.document}
          role="status"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          {job.pageReview!.length > 1 ? `Document ${review.document}: ` : ""}
          {review.diagnostics?.length ? review.diagnostics.map((page) => (
            <span key={page.page} className="block">
              PDF page {page.page}{page.printedPage !== undefined && page.printedPage !== page.page ? ` (printed page ${page.printedPage})` : ""}: {page.status === "selected"
                ? "selected for reading."
                : page.status === "blocked"
                  ? `located, but could not be used. ${page.reason ?? "The assessment details need checking."}`
                  : `the selected assessment was not found on this page. ${page.reason ?? "Check the PDF page number and the printed page label."}`}
            </span>
          )) : <>{review.readPages.length
            ? `PDF pages selected for reading: ${review.readPages.join(", ")}.`
            : "None of the selected PDF pages could be matched to this assessment."}
          {review.skippedPages.length > 0 && (
            <> PDF pages {review.skippedPages.join(", ")} were skipped because they could not be safely matched to this assessment.</>
          )}</>}
        </p>
      ))}
      {showIssues ? (
        <details
          open
          aria-label="Profile validation details"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
          <summary className="cursor-pointer font-medium">
            What needs checking
          </summary>
          <ol className="mt-3 space-y-2 text-muted-foreground">
            {job.validationIssues!.map((issue) => (
              <li key={`${issue.stage}-${issue.attempt}`}>
                <span className="font-medium text-foreground">
                  Attempt {issue.attempt}
                </span>
                {" · "}
                {issue.message}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {facts ? (
        <details
          aria-label="Verified assessment facts"
          className="rounded-lg border border-border p-3 text-sm"
        >
          <summary className="cursor-pointer font-medium">
            Verified assessment facts
          </summary>
          <div className="mt-3 space-y-2 text-muted-foreground">
            {facts.tier ? (
              <p>Untiered — verified from the course catalogue.</p>
            ) : null}
            {facts.assessmentInstructions ? (
              <>
                <p>
                  Question-choice and calculator instructions use a reviewed
                  official paper cover.
                </p>
                {facts.assessmentInstructions.sourceUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block text-primary underline underline-offset-4"
                  >
                    Official assessment instructions
                  </a>
                ))}
              </>
            ) : null}
          </div>
        </details>
      ) : null}
    </>
  );
}
