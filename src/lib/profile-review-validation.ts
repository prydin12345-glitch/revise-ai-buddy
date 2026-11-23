/** Keep draft validation actionable without rendering schema dumps in the editor. */
export function profileReviewError(error: unknown): string {
  const issues = (error as { issues?: Array<{ path?: PropertyKey[] }> } | null)?.issues;
  if (Array.isArray(issues) && issues.length) {
    const path = issues[0].path ?? [];
    if (path.includes("notes")) return "Keep each personal note within 1,000 characters.";
    if (path.includes("topicEdits")) return "Check the edited subtopic names and notes. Names can have up to 180 characters.";
    if (path[0] === "durationMinutes") return "Enter a time limit between 1 and 360 whole minutes.";
    if (path.includes("marks")) return path[0] === "sections"
      ? "Each question part needs between 1 and 30 whole marks."
      : "Enter total marks between 1 and 300.";
    if (path[0] === "topics") return "Keep between 1 and 400 subtopics in this profile.";
    return "Check the profile fields before saving.";
  }
  const message = error instanceof Error ? error.message : "Check the profile before saving.";
  if (message === "Achievable marks do not match the template total.")
    return "The question marks must add up to the total marks. Adjust them in Question layout & advanced settings.";
  if (message === "Single-select MCQs require one mark.")
    return "A single-choice question must be worth one mark.";
  return message;
}
