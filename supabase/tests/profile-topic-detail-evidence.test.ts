// @vitest-environment node
import { expect, it } from "vitest";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";
import { canonical } from "../functions/_shared/profile-template";
import { fingerprint } from "../functions/_shared/profile-fingerprint";
import { modelEvidenceSchema, validateEvidence } from "../functions/_shared/profile-evidence";
import { prepareProfileSave } from "../functions/_shared/profile-builder-service";
import { snapshotTemplate } from "../functions/_shared/profile-template-context";

async function detailed() {
  const evidence = await ownerEvidence();
  evidence.facts.topics = ["1.1.1 Cells", "1.1.2 Enzymes"];
  evidence.topicDetails = evidence.facts.topics.map(topic => ({
    topic, path: ["1 Cell biology", "1.1 Molecules and cells"],
    sources: [{ documentId: evidence.documents[0].id, page: 4,
      text: `${topic}\na) A synthetic learning point with CO₂ and x².\nb) Compare a table of results.` }],
  }));
  const template = templateFixture();
  template.topics = evidence.facts.topics;
  template.sections[0].groups[0].parts.forEach((part, i) => { part.topic = template.topics[i]; });
  const proposal = { proposalVersion: 1 as const, promptVersion: 1 as const,
    origin: "source_backed_ai" as const, template, evidence,
    evidenceVersion: fingerprint(canonical(evidence)), presetId: null, profileSettings: null };
  return { evidence, template, proposal };
}

it("keeps existing evidence fingerprints identical when no topic details were saved", async () => {
  const original = await ownerEvidence();
  expect(canonical(validateEvidence(original))).toBe(canonical(original));
  expect(validateEvidence(original)).not.toHaveProperty("topicDetails");
});

it("does not let model extraction nominate the server's detailed-topic authority", async () => {
  const { evidence } = await detailed();
  expect(() => modelEvidenceSchema.parse(evidence)).toThrow();
});

it("requires a literal heading, unique topic and active content-document reference for every detail", async () => {
  const { evidence } = await detailed();
  expect(() => validateEvidence(evidence)).not.toThrow();
  const unsupported = structuredClone(evidence);
  unsupported.topicDetails![0].sources[0].text = "A different topic.";
  expect(() => validateEvidence(unsupported)).toThrow("literal source text");
  const foreign = structuredClone(evidence);
  foreign.topicDetails![0].sources[0].documentId = "someone-elses-upload";
  expect(() => validateEvidence(foreign)).toThrow("active content source");
  const duplicate = structuredClone(evidence);
  duplicate.topicDetails!.push(duplicate.topicDetails![0]);
  expect(() => validateEvidence(duplicate)).toThrow("uniquely belong");
});

it("keeps detailed excerpts in the owned profile and redacts them from shareable attempts", async () => {
  const { proposal, template, evidence } = await detailed();
  const saved = prepareProfileSave(proposal, template);
  expect(saved.settings.topics).toEqual(evidence.facts.topics);
  expect(saved.context.evidence).toEqual(evidence);
  const snapshot = snapshotTemplate({ ...saved.settings, profile_template: saved.context });
  expect(snapshot?.context.evidence).not.toHaveProperty("topicDetails");
  expect(JSON.stringify(snapshot)).not.toContain("synthetic learning point");
  expect(JSON.stringify(snapshot)).not.toContain("owner-doc");
  const tampered = structuredClone(proposal);
  tampered.evidence.topicDetails![0].sources[0].text += " Invented source outcome.";
  expect(() => prepareProfileSave(tampered, template)).toThrow("checksum-bound evidence");
});

it("bounds the whole source representation, not a silently truncated prefix", async () => {
  const { evidence } = await detailed();
  evidence.facts.topics = Array.from({ length: 401 }, (_, i) => `1.1.${i} Topic ${i}`);
  evidence.topicDetails = evidence.facts.topics.map(topic => ({ topic, path: [],
    sources: [{ documentId: evidence.documents[0].id, page: 4, text: topic }] }));
  expect(() => validateEvidence(evidence)).toThrow();
});
