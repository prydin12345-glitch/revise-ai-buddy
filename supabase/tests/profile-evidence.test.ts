// @vitest-environment node
import { it, expect } from "vitest";
import {
  validateEvidence,
  validateEvidenceTemplate,
  parseOwnerDocument,
  compareEvidenceVersions,
  validateSourceUrl,
} from "../functions/_shared/profile-evidence";
import {
  SOURCE_REGISTRY,
  resolveRegisteredSource,
} from "../functions/_shared/profile-source-registry";
import {
  ownerEvidence,
  templateFixture,
  pearsonTemplate,
  syllabus,
} from "./profile-builder-fixtures";
it("pins the researched official Pearson documents to course, dates and exact checksums", () => {
  const evidence = resolveRegisteredSource(SOURCE_REGISTRY[0].id);
  expect(evidence.documents).toHaveLength(2);
  expect(evidence.facts).toMatchObject({
    marks: 90,
    durationMinutes: 105,
    tier: "not_tiered",
  });
  expect(evidence.documents[0].checksum).toBe(
    "79808a9caf407092b8b870b8876a81f809ad3a3f1b588f17b2151d5416c54387",
  );
  validateEvidenceTemplate(pearsonTemplate("full_mock"), evidence);
});
it("unknown is distinct from an untiered qualification and a full mock remains blocked", async () => {
  const e = await ownerEvidence();
  e.facts.tier = null;
  e.identity.tier = null;
  e.claims = e.claims.filter((c) => c.field !== "tier");
  const t = templateFixture();
  t.identity.tier = null;
  validateEvidenceTemplate(t, e);
  t.mode = "full_mock";
  expect(() => validateEvidenceTemplate(t, e)).toThrow(/unknown/);
});
it.each([
  "marks",
  "durationMinutes",
  "topics",
  "tier",
  "calculator",
  "formats",
  "selection",
  "mathsRequirement",
])("rejects unsupported or contradictory evidence for %s", async (field) => {
  const e = await ownerEvidence();
  if (field === "marks") e.facts.marks = 7;
  if (field === "durationMinutes") e.facts.durationMinutes = 45;
  if (field === "topics") e.facts.topics = ["Genetics"];
  if (field === "tier") e.facts.tier = "higher";
  if (field === "calculator") e.facts.calculator = "allowed";
  if (field === "formats") e.facts.formats = ["mcq_single"];
  if (field === "selection") e.facts.selection = "optional";
  if (field === "mathsRequirement") {
    e.facts.mathsRequirement = "At least 20% mathematics";
    e.claims.push({
      field,
      documentId: "owner-doc",
      locationId: "brief",
      quote: "6 marks",
      rule: "mandatory",
    });
  }
  expect(() => validateEvidence(e)).toThrow();
});
it("references must resolve to real document locations; superseded rules cannot certify a current draft", async () => {
  const e = await ownerEvidence();
  e.claims[0].locationId = "invented";
  expect(() => validateEvidence(e)).toThrow(/resolve/);
  e.claims[0].locationId = "brief";
  e.documents[0].state = "superseded";
  expect(() => validateEvidence(e)).toThrow(/superseded/);
});
it("source contradictions and unsupported optional requirements remain visible and unsavable", async () => {
  const e = await ownerEvidence();
  e.conflicts = ["Two covers disagree"];
  expect(() => validateEvidenceTemplate(templateFixture(), e)).toThrow(
    /conflicting/,
  );
  const optional = await ownerEvidence();
  optional.documents[0].locations[0].text += " Choose one question.";
  optional.claims.find((c) => c.field === "selection")!.quote =
    "Choose one question";
  optional.facts.selection = "optional";
  expect(() => validateEvidenceTemplate(templateFixture(), optional)).toThrow(
    /adapter/,
  );
});
it("source version comparison never mutates the earlier saved profile", async () => {
  const a = await ownerEvidence(),
    b = structuredClone(a);
  b.documents[0].version = "2027";
  expect(compareEvidenceVersions(a, b).changed).toBe(true);
  expect(a.documents[0].version).toBe("2026");
});
it.each([
  "http://qualifications.pearson.com/a",
  "https://user:password@qualifications.pearson.com/a",
  "https://qualifications.pearson.com:8443/a",
  "https://qualifications.pearson.com.evil.example/a",
  "https://127.0.0.1/a",
  "https://[::1]/a",
  "https://qualifications.pearson.com/a#instructions",
])("refuses unsafe or unregistered URL %s", (url) =>
  expect(() => validateSourceUrl(url)).toThrow(),
);
it("a registered domain alone does not permit arbitrary runtime fetches", () =>
  expect(() =>
    resolveRegisteredSource(
      undefined,
      "https://qualifications.pearson.com/invented.pdf",
    ),
  ).toThrow(/not registered/));
it("checks original document bytes before a parser can detach or mutate its buffer", async () => {
  const bytes = new TextEncoder().encode("%PDF-mock");
  const parsed = await parseOwnerDocument(
    bytes,
    "application/pdf",
    async (b) => {
      b.fill(0);
      return [syllabus];
    },
  );
  expect(new TextDecoder().decode(bytes)).toBe("%PDF-mock");
  expect(parsed.checksum).toHaveLength(64);
});
it("limits upload size and rejects fake PDFs, invalid UTF-8, excessive text and empty scans", async () => {
  const parser = async () => [];
  for (const [bytes, type] of [
    [new Uint8Array(3_000_001), "text/plain"],
    [new TextEncoder().encode("not a PDF"), "application/pdf"],
    [new Uint8Array([255]), "text/plain"],
    [new TextEncoder().encode("x".repeat(45001)), "text/plain"],
  ] as const)
    await expect(parseOwnerDocument(bytes, type, parser)).rejects.toThrow();
  await expect(
    parseOwnerDocument(
      new TextEncoder().encode("%PDF-blank"),
      "application/pdf",
      parser,
    ),
  ).rejects.toThrow(/shorter|readable/);
});
