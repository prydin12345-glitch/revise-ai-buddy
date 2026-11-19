// @vitest-environment node
import { beforeAll, expect, it } from "vitest";
import { canonicaliseOwnedSourceIdentity } from "../functions/_shared/profile-source-identity";
import { discoverSourceAssessments, type DiscoveredAssessment } from "../functions/_shared/profile-assessment-discovery";
import { SourceIdentityValidationError, SourceCallUncertainError, sourceValidationRecord, type SourceIdentityField } from "../functions/_shared/profile-builder-diagnostics";
import type { TemplateIdentity } from "../functions/_shared/profile-template";

const expected: TemplateIdentity = {
  country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level",
  subject: "Business Studies", organisation: "Pearson Edexcel", course: "9BS0",
  component: "9BS0/01", specificationVersion: "Issue 1 September 2014", tier: null,
};
let owned: DiscoveredAssessment;
beforeAll(async () => {
  owned = (await discoverSourceAssessments([{ id: "owned", checksum: "a".repeat(64), pages: [
    "Pearson Edexcel A-level Business (9BS0)\nPaper 1: Marketing (9BS0/01)\n100 marks\nPaper 2: Strategy (9BS0/02)\n80 marks",
  ] }], expected)).candidates[0];
});

it.each(["Paper 1", "Paper1", "Paper 1 — Marketing", "Paper 1 — Marketing (9BS0/01)", "9bs0 / 01"])("canonicalises uniquely source-proven %s without mutating the response", component => {
  const raw = Object.freeze({ ...expected, component });
  expect(canonicaliseOwnedSourceIdentity(raw, expected, owned)).toEqual(expected);
  expect(raw.component).toBe(component);
});
it.each(["Paper 2", "9BS0/02", "8BS0/01", "9BS0/01A", "Paper 2 — Strategy (9BS0/01)", "Paper 1 — Invented title (9BS0/01)"])("does not conceal a different or unsupported assessment: %s", component => {
  expect(canonicaliseOwnedSourceIdentity({ ...expected, component }, expected, owned).component).toBe(component);
});
it("does not treat opaque IDs or unconfirmed manual references as source aliases", () => {
  expect(canonicaliseOwnedSourceIdentity({ ...expected, component: owned.id }, expected, owned).component).toBe(owned.id);
  const uncoded = { ...owned, componentCode: undefined, canonicalComponent: "Paper 1", aliases: ["Paper 1"], courseCode: undefined, courseCodeReference: undefined };
  const selected = { ...expected, component: "Paper 1" };
  expect(canonicaliseOwnedSourceIdentity({ ...selected, component: "9BS0/01" }, selected, uncoded).component).toBe("9BS0/01");
  expect(canonicaliseOwnedSourceIdentity({ ...expected, component: "Paper 1" }, expected, { ...owned, references: [] }).component).toBe("Paper 1");
});
it("accepts supported display spellings while preserving the server-selected values", () => {
  expect(canonicaliseOwnedSourceIdentity({ ...expected, country: "United Kingdom", subject: "Business", organisation: "Edexcel", course: " 9bs0 " }, expected, owned)).toEqual(expected);
});
it.each([
  ["subject", "Business management"], ["qualification", "AS"], ["country", "US"],
  ["specificationVersion", "Issue 2 September 2016"], ["tier", "not_tiered"], ["course", "8BS0"],
] as const)("does not change conflicting %s into the selected value", (field, value) => {
  expect(canonicaliseOwnedSourceIdentity({ ...expected, [field]: value }, expected, owned)[field]).toBe(value);
});
it("needs the source-declared Business course before accepting a subject alias", () => {
  const raw = { ...expected, subject: "Business" };
  for (const source of [undefined, { ...owned, courseCodeReference: undefined }, { ...owned, courseCode: "8BS0" }])
    expect(canonicaliseOwnedSourceIdentity(raw, expected, source).subject).toBe("Business");
  const university = { ...expected, stage: "University", organisation: "Pearson Edexcel" };
  expect(canonicaliseOwnedSourceIdentity({ ...university, organisation: "Edexcel" }, university, owned).organisation).toBe("Edexcel");
});
it.each(["component", "course", "subject", "organisation", "qualification", "specificationVersion", "module", "tier", "mode"] as SourceIdentityField[])("publishes a controlled %s diagnostic without rejected content", field => {
  const error = new SourceIdentityValidationError(field);
  error.message = "PRIVATE_REJECTED_MODEL_OUTPUT";
  const record = sourceValidationRecord(error, "extraction", 1);
  expect(record).toMatchObject({ code: "identity_conflict", field });
  expect(record.detail).toContain("PRIVATE_REJECTED_MODEL_OUTPUT");
  expect(record.message).not.toContain("PRIVATE_REJECTED_MODEL_OUTPUT");
});
it("distinguishes an unconfirmed service outcome from identity or evidence validation", () => {
  const record = sourceValidationRecord(new SourceCallUncertainError(), "draft", 3);
  expect(record).toMatchObject({ attempt: 3, stage: "draft", code: "provider_outcome_unknown" });
  expect(record.field).toBeUndefined();
  expect(record.message).toMatch(/not be retried automatically/);
});
