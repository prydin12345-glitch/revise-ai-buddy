// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canonical,
  compileTemplate,
  templateSchema,
  type ProfileTemplate,
} from "../functions/_shared/profile-template";
import {
  builderRequestSchema,
  prepareProfileSave,
  type BuilderProposal,
} from "../functions/_shared/profile-builder-service";
import {
  resolveSavedTemplate,
  snapshotTemplate,
  templateSnapshotInstructions,
  templateSnapshotPlan,
} from "../functions/_shared/profile-template-context";
import { validateEvidence } from "../functions/_shared/profile-evidence";
import { fingerprint } from "../functions/_shared/profile-fingerprint";
import { validateGenericPlan } from "../functions/_shared/profile-template-plan-validator";
import { profileTopicLabel, profileTopicNotes } from "../../src/lib/profile-topic-presentation";
import { genericRows, ownerEvidence, templateFixture } from "./profile-builder-fixtures";

function proposal(template = templateFixture()): BuilderProposal {
  return {
    proposalVersion: 1, promptVersion: 1, template, origin: "model_knowledge_ai",
    evidence: null, evidenceVersion: null, presetId: null, profileSettings: null,
  };
}
const edits = (): NonNullable<ProfileTemplate["topicEdits"]> => [
  { topic: "Cells", label: "My cell revision", notes: "  Private revision note\nKeep these exact words.  " },
  { topic: "Enzymes", notes: "Ask my tutor about enzyme activity." },
];

describe("user-owned display labels and private topic notes", () => {
  it("round trips metadata and literal owned evidence without changing topics, part identities or compiled plans", async () => {
    const original = templateFixture(), evidence = await ownerEvidence();
    evidence.topicDetails = original.topics.map(topic => ({
      topic, path: ["Cell biology"], sources: [{
        documentId: evidence.documents[0].id, page: 2,
        text: `${topic}\na) Literal source learning point — keep punctuation & spacing.`,
      }],
    }));
    const rawEvidence = JSON.stringify(evidence);
    const evidenceVersion = fingerprint(canonical(validateEvidence(evidence)));
    const sourceProposal: BuilderProposal = {
      ...proposal(original), origin: "source_backed_ai", evidence, evidenceVersion,
    };
    const edited = { ...structuredClone(original), topicEdits: edits() };
    const request = builderRequestSchema.parse({
      action: "save", proposalId: crypto.randomUUID(), profileName: "Biology revision", template: edited,
    });
    if (request.action !== "save") throw Error("Expected save request");
    const saved = prepareProfileSave(sourceProposal, request.template);
    expect(saved.context.evidence).toBe(evidence);
    expect(JSON.stringify(saved.context.evidence)).toBe(rawEvidence);
    expect(saved.context.evidenceVersion).toBe(evidenceVersion);
    expect(saved.context.template.topicEdits).toEqual(edits());
    expect(saved.context.template.topics).toEqual(original.topics);
    expect(saved.context.template.sections).toEqual(original.sections);
    expect(saved.settings).toEqual(prepareProfileSave(sourceProposal, original).settings);
    expect(compileTemplate(saved.context.template)).toEqual(compileTemplate(original));
    const persisted = JSON.parse(JSON.stringify({ ...saved.settings, profile_template: saved.context }));
    const resolved = resolveSavedTemplate(persisted)!;
    expect(profileTopicLabel(persisted, "Cells")).toBe("My cell revision");
    expect(profileTopicNotes(persisted, "Cells")).toBe(edits()[0].notes);
    expect(JSON.stringify(resolved.context.evidence)).toBe(rawEvidence);
    expect(resolved.context.template.topicEdits).toEqual(edits());
    expect(validateGenericPlan(genericRows(), resolved.plan)).toEqual([]);
    expect(resolved.plan.parts.map(part => part.topic)).toEqual(["Cells", "Enzymes"]);
    expect(original).not.toHaveProperty("topicEdits");
  });

  it.each(["source_backed_ai", "model_knowledge_ai"] as const)(
    "redacts all private notes from %s snapshots while retaining labels and the exact plan",
    async origin => {
      const template = { ...templateFixture(), topicEdits: edits() };
      const evidence = origin === "source_backed_ai" ? await ownerEvidence() : null;
      const p: BuilderProposal = {
        ...proposal(), origin, evidence,
        evidenceVersion: evidence ? fingerprint(canonical(evidence)) : null,
      };
      const saved = prepareProfileSave(p, template);
      const before = JSON.stringify(saved.context);
      const frozen = snapshotTemplate({ ...saved.settings, profile_template: saved.context })!;
      expect(frozen.context.template.topicEdits).toEqual([
        { topic: "Cells", label: "My cell revision" }, { topic: "Enzymes" },
      ]);
      expect(JSON.stringify(frozen)).not.toContain('"notes"');
      expect(JSON.stringify(frozen)).not.toContain("Private revision note");
      expect(JSON.stringify(frozen)).not.toContain("Ask my tutor");
      expect(JSON.stringify(frozen)).not.toContain("Private module brief");
      expect(JSON.stringify(frozen)).not.toContain("award founder approval");
      expect(JSON.stringify(saved.context)).toBe(before);
      expect(templateSnapshotPlan(frozen)).toEqual(compileTemplate(templateFixture()));
      const instructions = templateSnapshotInstructions({ profile_template: frozen });
      expect(instructions).toContain('"topics":["Cells","Enzymes"]');
      expect(instructions).not.toContain("My cell revision");
      expect(instructions).not.toContain("Private revision note");
    },
  );

  it("leaves absent v1 fields, fingerprints and old saved contexts unchanged", async () => {
    const template = templateSchema.parse(templateFixture()), evidence = validateEvidence(await ownerEvidence());
    expect(template).not.toHaveProperty("topicEdits");
    expect(fingerprint(canonical(template))).toBe("fa36a3b9ef049afd4db0550a7795a5da71461715e3c89437409705e44732e78f");
    expect(fingerprint(canonical(evidence))).toBe("5930f4a01171c72bc68cab7ff2860db60120ddad55a5aeaf4b9a7b5258e42dfb");
    const saved = prepareProfileSave(proposal(), template);
    const oldProfile = JSON.parse(JSON.stringify({ ...saved.settings, profile_template: saved.context }));
    expect(resolveSavedTemplate(oldProfile)?.plan).toEqual(compileTemplate(template));
    expect(snapshotTemplate(oldProfile)?.context.template).not.toHaveProperty("topicEdits");
    expect(profileTopicLabel(oldProfile, "Cells")).toBe("Cells");
    expect(profileTopicNotes(oldProfile, "Cells")).toBe("");
  });
});

describe("bounded metadata and canonical scope validation", () => {
  it.each([
    [{ topic: "Cells", label: "First" }, { topic: "Cells", notes: "Second" }],
    [{ topic: "Invented genetics", label: "Cells" }],
    [{ topic: "cells", label: "Cells" }],
    [{ topic: "Cells ", label: "Cells" }],
    [{ topic: "Cells", label: "x".repeat(181) }],
    [{ topic: "Cells", label: " " }],
    [{ topic: "Cells", notes: "x".repeat(1001) }],
    [{ topic: "Cells", notes: 42 }],
    [{ topic: "Cells", sourceQuote: "Invented source evidence" }],
  ].map(topicEdits => ({ topicEdits })))("rejects duplicate, unscoped, malformed or oversized user edits: %j", ({ topicEdits }) => {
    const template = { ...templateFixture(), topicEdits };
    expect(() => templateSchema.parse(template)).toThrow();
    expect(() => prepareProfileSave(proposal(), template)).toThrow();
  });

  it("bounds entry count and aggregate text while allowing 400 short edits and individual maxima", () => {
    const template = templateFixture();
    template.topics.push(...Array.from({ length: 398 }, (_, index) => `Topic ${index}`));
    template.topicEdits = template.topics.map(topic => ({ topic, label: "Revision" }));
    expect(templateSchema.parse(template).topicEdits).toHaveLength(400);
    template.topicEdits.push({ topic: "Cells" });
    expect(() => templateSchema.parse(template)).toThrow();
    template.topicEdits = template.topics.map(topic => ({ topic, label: "l".repeat(180), notes: "n".repeat(1000) }));
    expect(() => templateSchema.parse(template)).toThrow(/capacity/);
    template.topicEdits = [{ topic: "Cells", label: "l".repeat(180), notes: "n".repeat(1000) }];
    expect(templateSchema.parse(template).topicEdits).toEqual(template.topicEdits);
  });

  it("rejects an edit attached to an ambiguous canonical key", () => {
    const template = templateFixture();
    template.topics.push("Cells");
    template.topicEdits = [{ topic: "Cells", label: "My cells" }];
    expect(() => prepareProfileSave(proposal(), template)).toThrow(/one saved canonical topic/);
  });

  it.each(["part scope", "duplicate part", "duplicate group", "duplicate section"])(
    "metadata cannot bypass existing %s validation", kind => {
      const template = { ...templateFixture(), topicEdits: edits() };
      if (kind === "part scope") template.sections[0].groups[0].parts[0].topic = "My cell revision";
      if (kind === "duplicate part") template.sections[0].groups[0].parts[1].id = "cells";
      if (kind === "duplicate group") template.sections[0].groups[0].id = "section";
      if (kind === "duplicate section") template.sections.push(structuredClone(template.sections[0]));
      expect(() => prepareProfileSave(proposal(), template)).toThrow(/scope|Duplicate/);
    },
  );
});

describe("pure presentation helpers", () => {
  it("accepts readonly templates and bounded saved/profile/snapshot JSON without changing canonical tags", () => {
    const template = { topics: ["Cells", "Enzymes"], topicEdits: edits() } as const;
    const before = JSON.stringify(template);
    for (const input of [template, { template }, { context: { template } },
      { profile_template: { template } }, { profile_template: { context: { template } } },
      { topics: ["Legacy profile topics"], profile_template: { template } }]) {
      expect(profileTopicLabel(input, "Cells")).toBe("My cell revision");
      expect(profileTopicNotes(input, "Cells")).toBe(edits()[0].notes);
      expect(profileTopicLabel(input, "Enzymes")).toBe("Enzymes");
      expect(profileTopicLabel(input, "Unknown")).toBe("Unknown");
      expect(profileTopicNotes(input, "Unknown")).toBe("");
    }
    expect(JSON.stringify(template)).toBe(before);
  });

  it.each([null, undefined, "json", [], {}, { topics: 1 }, { topics: [null] },
    { topics: ["Cells"], topicEdits: "invalid" },
    { topics: ["Cells"], topicEdits: [{ topic: "Cells", notes: 3 }] },
    { topics: ["Cells"], topicEdits: [{ topic: "Other", label: "Forged" }] },
    { topics: ["Cells", "Cells"], topicEdits: [{ topic: "Cells", label: "Ambiguous" }] },
    { topics: ["Cells"], topicEdits: [{ topic: "Cells", label: "First" }, { topic: "Cells", label: "Duplicate" }] },
    { topics: ["Cells"], topicEdits: [{ topic: "Cells", notes: "x".repeat(1001) }] },
    { topics: ["Cells"], topicEdits: Array.from({ length: 401 }, () => ({ topic: "Cells" })) },
  ])("falls back safely on malformed unknown context %j", input => {
    expect(profileTopicLabel(input, "Cells")).toBe("Cells");
    expect(profileTopicNotes(input, "Cells")).toBe("");
  });

  it("bounds aggregate notes and wrapper depth even for cyclic unknown objects", () => {
    const topics = ["Cells", ...Array.from({ length: 100 }, (_, index) => `Topic ${index}`)];
    const input = { topics, topicEdits: topics.map(topic => ({ topic, label: "Display", notes: "x".repeat(1000) })) };
    expect(profileTopicLabel(input, "Cells")).toBe("Cells");
    expect(profileTopicNotes(input, "Cells")).toBe("");
    const cyclic: Record<string, unknown> = {};
    cyclic.template = cyclic;
    expect(profileTopicLabel(cyclic, "Cells")).toBe("Cells");
    expect(profileTopicNotes(cyclic, "Cells")).toBe("");
  });
});
