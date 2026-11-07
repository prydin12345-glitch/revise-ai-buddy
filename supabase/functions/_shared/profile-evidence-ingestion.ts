import {
  applyCatalogueTier,
  modelEvidenceSchema,
  validateEvidence,
  type ProfileEvidence,
} from "./profile-evidence.ts";
import { resolveReviewedAssessmentRules } from "./profile-reviewed-assessment-rules.ts";

/**
 * Call only after matching model document IDs, checksums and literal locations
 * to the owned upload. The model never supplies catalogue or official authority.
 */
export function completeOwnedAssessmentEvidence(raw: unknown): ProfileEvidence {
  const parsed = modelEvidenceSchema.parse(raw);
  if (
    parsed.documents.some(
      (document) =>
        document.authority !== "owner_supplied" || document.url !== null,
    )
  )
    throw Error(
      "Uploaded evidence cannot nominate an official source authority.",
    );
  const evidence = applyCatalogueTier(parsed);
  const reviewed = resolveReviewedAssessmentRules(evidence.identity);
  if (reviewed) {
    for (const field of ["selection", "calculator"] as const) {
      const value = evidence.facts[field];
      if (value !== "unknown" && value !== reviewed.facts[field]) {
        evidence.conflicts.push(
          `The uploaded ${field} rule conflicts with the reviewed instructions for this component. Check the course, version and source.`,
        );
        continue;
      }
      if (field === "selection")
        evidence.facts.selection = reviewed.facts.selection;
      else evidence.facts.calculator = reviewed.facts.calculator;
      // Preserve source quotes; a contradictory instruction must still fail
      // validation. The new supporting claim points to a real reviewed cover.
      evidence.claims.push(
        ...reviewed.claims.filter((claim) => claim.field === field),
      );
    }
    if (
      evidence.documents.some((document) =>
        reviewed.documents.some((source) => source.id === document.id),
      )
    )
      throw Error(
        "An uploaded source cannot replace a reviewed document identity.",
      );
    evidence.documents.push(...reviewed.documents);
    evidence.conflicts = [...new Set(evidence.conflicts)];
  }
  return validateEvidence(evidence);
}
