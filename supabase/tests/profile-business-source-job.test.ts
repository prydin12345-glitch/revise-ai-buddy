// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import {
  advanceSourceJob,
  answerSourceJob,
  confirmSourceJob,
  prepareSourceJob,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import { discoverSourceAssessments } from "../functions/_shared/profile-assessment-discovery";
import { validateEvidenceTemplate, type ProfileEvidence } from "../functions/_shared/profile-evidence";
import { checksum, type ProfileTemplate, type TemplateIdentity } from "../functions/_shared/profile-template";
import { sourceTextIncludes } from "../functions/_shared/source-text-match";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";

const fixture: {
  source: { physicalPageCount: number; retrievedOn: string };
  excerpts: Array<{ page: number; text: string }>;
} = JSON.parse(readFileSync(new URL("./fixtures/edexcel-alevel-business-official.json", import.meta.url), "utf8"));

interface ReadPayload {
  identity: TemplateIdentity;
  chunkId: string;
  documents: Array<{ id: string; checksum: string; pages: Array<{ page: number; text: string }> }>;
}

it("builds official Business Paper 3 through a page-46 follow-up, retaining page-15 duration and unknown source rules", async () => {
  const pages = Array<string>(fixture.source.physicalPageCount).fill("");
  for (const excerpt of fixture.excerpts) pages[excerpt.page - 1] = excerpt.text;
  // Replay the captured official text at the parser boundary. This envelope is
  // not the original PDF or its checksum; PDF extraction has a separate test.
  const bytes = new TextEncoder().encode("%PDF-1.7\n" + JSON.stringify(fixture.excerpts));
  const identity: TemplateIdentity = {
    country: "GB", educationSystem: "UK", stage: "Secondary",
    qualification: "A-level", subject: "Business", organisation: "Pearson Edexcel",
    course: "9BS0", component: "Paper 3", specificationVersion: "Not verified", tier: null,
  };
  const discovery = await discoverSourceAssessments([
    { id: "upload-1", checksum: await checksum(bytes), pages },
  ], identity);
  const selected = discovery.candidates.find((candidate) => candidate.componentCode === "9BS0/03")!;
  expect(selected).toBeDefined();
  const memory = memoryJobStore();
  let reads = 0;
  const parsePdf = vi.fn(async (supplied: Uint8Array) => {
    expect(supplied).toEqual(bytes);
    return [...pages];
  });
  const model = vi.fn<SourceJobDeps["model"]>(async (_system, raw) => {
    if (!("documents" in (raw as object))) {
      const payload = raw as { identity: TemplateIdentity; mode: ProfileTemplate["mode"]; evidence: ProfileEvidence };
      const template: ProfileTemplate = {
        schemaVersion: 1, identity: payload.identity, mode: payload.mode,
        marks: payload.evidence.facts.marks!, durationMinutes: payload.evidence.facts.durationMinutes!,
        topics: payload.evidence.facts.topics, calculator: "unknown",
        sections: [{
          id: "practice", title: "Examly practice layout",
          groups: payload.evidence.facts.topics.map((topic, index) => ({
            id: `group-${index}`,
            parts: [{ id: `part-${index}`, topic, marks: 25,
              response: index % 2 ? "long_form" : "short_answer", demand: "AO2", resource: "none" }],
          })),
        }],
        warnings: ["Tier and calculator permission remain unknown in these source excerpts."],
        designDecisions: ["Four 25-mark groups are an Examly practice layout choice; the specification does not prescribe that distribution."],
      };
      return { value: template, promptTokens: 7, completionTokens: 5 };
    }
    const payload = raw as ReadPayload, source = payload.documents[0];
    const followup = ++reads === 2;
    expect(payload.identity).toMatchObject({ course: "9BS0", component: "9BS0/03", tier: null });
    const suppliedText = source.pages.map((page) => page.text).join("\n");
    expect(suppliedText).not.toMatch(/9BS0\/0[12]/);
    expect(source.pages.some((page) => page.page === 15 && page.text.includes("Duration: 2 hours."))).toBe(true);
    if (followup) expect(source.pages.some((page) => page.page === 46)).toBe(true);
    const locations: ProfileEvidence["documents"][number]["locations"] = [];
    const claims: ProfileEvidence["claims"] = [];
    const cite = (field: string, page: number, text: string, quote = text) => {
      expect(source.pages.some((supplied) => supplied.page === page && sourceTextIncludes(supplied.text, text))).toBe(true);
      expect(sourceTextIncludes(pages[page - 1], text)).toBe(true);
      const id = `${payload.chunkId}-${locations.length}`;
      locations.push({ id, page, section: "Paper 3 assessment", text });
      claims.push({ field, documentId: source.id, locationId: id, quote, rule: "mandatory" });
    };
    const topics: string[] = [];
    if (!followup) {
      // A valid partial read omits topics/formats; accepted marks/time survive
      // the ensuing clarification rather than being re-created by the answer.
      cite("marks", 15, "100 marks available.", "100 marks");
      cite("durationMinutes", 15, "Duration: 2 hours.");
      cite("selection", 15, "Students answer all questions from both sections.");
    } else {
      const summary = source.pages.find((page) => page.page === 46)!;
      const assessment = summary.text.match(/Questions in Sections A and B[\s\S]*?The assessment comprises 100 marks\./)![0];
      cite("marks", 46, assessment, "100 marks");
      for (const page of [17, 25, 31, 39]) {
        const heading = source.pages.find((supplied) => supplied.page === page)!.text.trim();
        const topic = heading.replace(/^Theme \d+:\s*/, "");
        topics.push(topic);
        cite("topics", page, heading, topic);
      }
    }
    const evidence: ProfileEvidence = {
      version: 1, identity: { ...payload.identity },
      documents: [{
        id: source.id, checksum: source.checksum, title: "Pearson Edexcel Level 3 Advanced GCE in Business",
        url: null, authority: "owner_supplied", state: "active", kind: "specification",
        version: payload.identity.specificationVersion, retrievedOn: fixture.source.retrievedOn,
        applicableCohort: "First assessment: 2017", locations,
      }],
      facts: {
        marks: 100, durationMinutes: followup ? null : 120, topics, tier: null,
        calculator: "unknown", selection: followup ? "unknown" : "all_compulsory",
        formats: [], mathsRequirement: null, practicalRequirement: null,
      },
      claims, unresolved: [], conflicts: [],
    };
    return { value: { evidence, identityClaims: [] }, promptTokens: 7, completionTokens: 5 };
  });
  const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
  const owner = "93000000-0000-4000-8000-000000000001", requestId = crypto.randomUUID();
  const input = {
    action: "prepare_source" as const, requestId, identity: { ...identity, component: selected.label },
    selectedAssessmentId: selected.id, specificationVersionIntent: "source" as const,
    mode: "short_practice" as const,
    uploads: [{ contentType: "application/pdf" as const, base64: Buffer.from(bytes).toString("base64") }],
  };
  const prepared = await prepareSourceJob(owner, input, deps);
  expect(prepared).toMatchObject({ stage: "identifying", assessmentConfirmed: true, identity: { component: "9BS0/03", tier: null } });
  expect(model).not.toHaveBeenCalled();
  const question = await advanceSourceJob(owner, requestId, deps);
  expect(question.stage, JSON.stringify(question)).toBe("needs_details");
  expect(question.missingItems?.[0].field).toBe("source_pages");
  const partial = structuredClone(memory.records.get(ownerKey(owner, requestId))!.data.partials[0]);
  const reading = await answerSourceJob(owner, requestId, {
    revision: question.revision, answers: { source_pages: "1:46" },
  }, deps);
  expect(reading.stage, JSON.stringify(reading)).toBe("identifying");
  expect(reading.pageReview?.[0]).toMatchObject({ requestedPages: [46], readPages: [46], skippedPages: [] });
  expect(memory.records.get(ownerKey(owner, requestId))!.data.partials[0]).toEqual(partial);
  expect(model).toHaveBeenCalledOnce();
  const ready = await advanceSourceJob(owner, requestId, deps);
  expect(ready.stage, JSON.stringify(ready)).toBe("ready");
  expect(ready.missingItems).toBeUndefined();
  const evidence = memory.records.get(ownerKey(owner, requestId))!.data.evidence!;
  expect(evidence.facts).toMatchObject({
    marks: 100, durationMinutes: 120, tier: null, calculator: "unknown", selection: "all_compulsory",
    formats: ["short_answer", "long_form"],
  });
  const duration = evidence.claims.find((claim) => claim.field === "durationMinutes")!;
  expect(evidence.documents[0].locations.find((location) => location.id === duration.locationId)?.page).toBe(15);
  const format = evidence.claims.find((claim) => claim.field === "formats")!;
  expect(evidence.documents[0].locations.find((location) => location.id === format.locationId)?.page).toBe(46);
  expect(evidence.catalogueFacts).toBeUndefined();
  expect(evidence.claims.some((claim) => ["tier", "calculator"].includes(claim.field))).toBe(false);
  expect(evidence.facts.topics).toEqual(["Marketing and people", "Managing business activities", "Business decisions and strategy", "Global business"]);
  await confirmSourceJob(owner, requestId, { identity: ready.identity!, mode: ready.mode }, deps);
  const complete = await advanceSourceJob(owner, requestId, deps);
  expect(complete.stage, JSON.stringify(complete)).toBe("complete");
  expect(complete.proposal?.evidence).toEqual(evidence);
  expect(complete.proposal?.template.identity.tier).toBeNull();
  validateEvidenceTemplate(complete.proposal!.template, evidence);
  for (const document of evidence.documents) {
    for (const location of document.locations) expect(sourceTextIncludes(pages[location.page - 1], location.text)).toBe(true);
    for (const claim of evidence.claims.filter((claim) => claim.documentId === document.id)) {
      expect(sourceTextIncludes(document.locations.find((location) => location.id === claim.locationId)!.text, claim.quote)).toBe(true);
    }
  }
  expect(parsePdf).toHaveBeenCalledOnce();
  expect(model).toHaveBeenCalledTimes(3);
  expect(memory.reservations).toBe(1);
  expect(memory.records.get(ownerKey(owner, requestId))!.callIntents).toBe(3);
});

it("accepts the reported Paper 1 page list, preserves its first read and completes practice with no invented tier", async () => {
  const pages = Array<string>(68).fill("");
  for (const name of ["official", "scope", "continuation"]) {
    const part = JSON.parse(readFileSync(new URL(`./fixtures/edexcel-alevel-business-${name}.json`, import.meta.url), "utf8"));
    expect(part.source.sha256).toBe("8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f");
    for (const excerpt of part.excerpts) pages[excerpt.page - 1] = excerpt.text;
  }
  const bytes = new TextEncoder().encode("%PDF-1.7\n" + JSON.stringify(pages));
  const identity: TemplateIdentity = { country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level", subject: "Business", organisation: "Pearson Edexcel", course: "9BS0", component: "Paper 1", specificationVersion: "Not verified", tier: null };
  const memory = memoryJobStore();
  let reads = 0;
  const model = vi.fn<SourceJobDeps["model"]>(async (_system, raw: any) => {
    if (!raw.documents) {
      const topics = raw.evidence.facts.topics;
      const template: ProfileTemplate = { schemaVersion: 1, identity: raw.identity, mode: raw.mode,
        marks: 6, durationMinutes: 10, topics, calculator: "unknown", warnings: [],
        designDecisions: ["This six-mark practice layout is not the official full paper."],
        sections: [{ id: "practice", title: "Practice", groups: [{ id: "group", parts: topics.map((topic: string, index: number) => ({ id: `part-${index}`, topic, marks: 3, response: "short_answer", demand: "AO1", resource: "none" })) }] }],
      };
      return { value: template, promptTokens: 1, completionTokens: 1 };
    }
    const payload = raw as ReadPayload, source = payload.documents[0], followup = ++reads === 2;
    const text = source.pages.map(page => page.text).join("\n");
    expect(text).not.toMatch(/Paper [23]|9BS0\/0[23]/);
    const locations: ProfileEvidence["documents"][number]["locations"] = [], claims: ProfileEvidence["claims"] = [];
    const cite = (field: string, page: number, text: string, quote: string) => {
      expect(source.pages.some(snippet => snippet.page === page && sourceTextIncludes(snippet.text, text))).toBe(true);
      const id = `${payload.chunkId}-location-${locations.length}`;
      locations.push({ id, page, section: "Paper 1 source", text });
      claims.push({ field, documentId: source.id, locationId: id, quote, rule: "mandatory" });
    };
    const topics = followup ? ["Meeting customer needs", "Globalisation"] : [];
    if (!followup) {
      const block = pages[13].match(/Overview of assessment[\s\S]*?100 marks available\./)![0];
      cite("marks", 14, block, "100 marks");
      cite("durationMinutes", 14, "Duration: 2 hours.", "Duration: 2 hours.");
      cite("selection", 14, "Students answer all questions from both sections.", "Students answer all questions from both sections.");
    } else {
      cite("topics", 18, "1.1 Meeting customer needs", "Meeting customer needs");
      cite("topics", 40, "4.1 Globalisation", "Globalisation");
    }
    const evidence: ProfileEvidence = { version: 1, identity: { ...payload.identity, tier: "not_tiered" },
      documents: [{ id: source.id, checksum: source.checksum, title: "Public Business reference excerpts", version: payload.identity.specificationVersion, kind: "specification", authority: "owner_supplied", url: null, state: "active", retrievedOn: "2026-11-19", applicableCohort: "First assessment 2017", locations }],
      facts: { marks: followup ? null : 100, durationMinutes: followup ? null : 120, topics, tier: null,
        calculator: "unknown", selection: followup ? "unknown" : "all_compulsory", formats: [], mathsRequirement: null, practicalRequirement: null },
      claims, unresolved: [], conflicts: [],
    };
    return { value: { evidence, identityClaims: [] }, promptTokens: 1, completionTokens: 1 };
  });
  const parsePdf = vi.fn(async () => [...pages]);
  const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
  const owner = "93000000-0000-4000-8000-000000000002", requestId = crypto.randomUUID();
  await prepareSourceJob(owner, { action: "prepare_source", requestId, identity, specificationVersionIntent: "source", mode: "short_practice",
    uploads: [{ contentType: "application/pdf", base64: Buffer.from(bytes).toString("base64") }] }, deps);
  const question = await advanceSourceJob(owner, requestId, deps);
  expect(question).toMatchObject({ stage: "needs_details", missingItems: [{ field: "source_pages" }], identity: { tier: null } });
  expect(question.missingItems?.[0].choices?.map(choice => choice.value)).toEqual(expect.arrayContaining(["1:18", "1:40"]));
  expect(question.missingItems?.[0].choices?.map(choice => choice.value)).not.toEqual(expect.arrayContaining(["1:26", "1:32"]));
  const previous = structuredClone(memory.records.get(ownerKey(owner, requestId))!.data.partials[0]);
  const reading = await answerSourceJob(owner, requestId, { revision: question.revision!, answers: { source_pages: "13,14,17,18,39,40,45" } }, deps);
  expect(reading.stage, JSON.stringify(reading)).toBe("identifying");
  expect(reading.pageReview?.[0]).toMatchObject({ readPages: [13,14,17,18,39,40,45], skippedPages: [] });
  expect(model).toHaveBeenCalledOnce();
  expect(memory.records.get(ownerKey(owner, requestId))!.data.partials[0]).toEqual(previous);
  const ready = await advanceSourceJob(owner, requestId, deps);
  expect(ready.stage, JSON.stringify(ready)).toBe("ready");
  expect(ready.validationIssues).toBeUndefined();
  expect(ready.missingItems).toBeUndefined();
  await confirmSourceJob(owner, requestId, { identity: ready.identity!, mode: ready.mode }, deps);
  const complete = await advanceSourceJob(owner, requestId, deps);
  expect(complete.stage, JSON.stringify(complete)).toBe("complete");
  expect(complete.proposal?.evidence?.facts).toMatchObject({ marks: 100, durationMinutes: 120, topics: ["Meeting customer needs", "Globalisation"], tier: null });
  expect(complete.proposal?.template.identity.tier).toBeNull();
  expect(parsePdf).toHaveBeenCalledOnce();
  expect(model).toHaveBeenCalledTimes(3);
  expect(memory.reservations).toBe(1);
});
