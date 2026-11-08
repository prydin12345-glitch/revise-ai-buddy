import {
  prepareProfileSave,
  proposeProfile,
} from "../functions/_shared/profile-builder-service";
import {
  snapshotTemplate,
  templateSnapshotPlan,
  resolveSavedTemplate,
} from "../functions/_shared/profile-template-context";
import { canonical } from "../functions/_shared/profile-template";
import { fingerprint } from "../functions/_shared/profile-fingerprint";
import { evidenceFingerprint } from "../functions/_shared/profile-evidence";
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  assertSourceSpecificationIssues,
  coverSpecificationIssueConflict,
  specificationIssue,
} from "../functions/_shared/profile-source-version";
import {
  validateEvidence,
  validateEvidenceTemplate,
} from "../functions/_shared/profile-evidence";
import {
  advanceSourceJob,
  answerSourceJob,
  prepareSourceJob,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import { memoryJobStore } from "./profile-builder-jobs-fixtures";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";
const current = "Version 1.4 July 2026";
const identity = {
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/2",
  specificationVersion: current,
  tier: "not_tiered" as const,
};
const owner = "90000000-0000-4000-8000-000000000001";
const metadata = (version: string) => [
  {
    kind: "specification",
    authority: "owner_supplied",
    state: "active",
    version,
  },
];
describe("source specification issue consistency", () => {
  it.each(["v1.4-july-2026", "Version 1.4 July 2026", "1.4"])(
    "recognises issue typography without changing identity: %s",
    (value) => {
      expect(specificationIssue(value)).toEqual({
        family: "version",
        identifier: "1.4",
      });
      expect(() =>
        assertSourceSpecificationIssues(current, metadata(value)),
      ).not.toThrow();
    },
  );
  it("does not interpret teaching/exam years or sitting dates as an edition", () => {
    expect(
      specificationIssue("First teaching 2015, first exams 2017"),
    ).toBeNull();
    expect(specificationIssue("June 2025 sitting")).toBeNull();
    expect(() =>
      assertSourceSpecificationIssues(current, [
        { ...metadata("1.3")[0], kind: "past_paper" },
      ]),
    ).not.toThrow();
  });
  it("rejects a 1.3 source hidden under a copied 1.4 identity", async () => {
    const e = await ownerEvidence();
    e.identity = { ...identity };
    e.documents[0].kind = "specification";
    e.documents[0].version = "1.3";
    expect(() => validateEvidence(e)).toThrow(/specification issue.*differs/);
  });
  it("uses the actual cover issue and ignores later historic issues", () => {
    expect(
      coverSpecificationIssueConflict(current, [
        { page: 1, text: "Specification\nVersion 1.3 18 October 2017" },
      ]),
    ).toMatch(/PDF states Version 1.3/);
    expect(
      coverSpecificationIssueConflict(current, [
        { page: 1, text: "Version 1.4 July 2026" },
        { page: 2, text: "Version 1.3 18 October 2017" },
      ]),
    ).toBeNull();
  });
  it("does not confuse a question-booklet print version with the specification issue", () => {
    expect(
      coverSpecificationIssueConflict(current, [
        { page: 1, text: "AQA Physics 7408/2\nQuestion paper\nVersion 1.0" },
      ]),
    ).toBeNull();
  });
  it("keeps a booklet print issue separate even when its cover names the specification", () => {
    expect(
      coverSpecificationIssueConflict(current, [
        {
          page: 1,
          text: "AQA Physics 7408/2\nQuestion paper\nFor specification 7408\nVersion 1.0",
        },
      ]),
    ).toBeNull();
    expect(
      coverSpecificationIssueConflict(current, [
        {
          page: 1,
          text: "AQA A-level Physics specification\nVersion 1.3 18 October 2017",
        },
        { page: 3, text: "Question paper\nVersion 1.0" },
      ]),
    ).toMatch(/PDF states Version 1.3/);
  });
  it("asks for the matching edition before any model call and retains the uploaded file", async () => {
    const memory = memoryJobStore(),
      model = vi.fn(),
      parsePdf = vi.fn(async () => [
        "AQA A-level Physics\nSpecification\nVersion 1.3 18 October 2017\nPaper 2\n85 marks; 120 minutes",
      ]);
    const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
    const q = await prepareSourceJob(
      owner,
      {
        action: "prepare_source",
        requestId: crypto.randomUUID(),
        identity,
        mode: "full_mock",
        uploads: [
          {
            contentType: "application/pdf",
            base64: btoa("%PDF-1.7 original fixture"),
          },
        ],
      },
      deps,
    );
    expect(q.stage).toBe("needs_details");
    expect(q.missingItems?.[0].field).toBe("source");
    expect(q.missingItems?.[0].question).toMatch(/1.3.*1.4/);
    expect(parsePdf).toHaveBeenCalledOnce();
    expect(model).not.toHaveBeenCalled();
    expect(memory.reservations).toBe(0);
    const record = [...memory.records.values()][0];
    expect(record.data.retainedDocuments?.[0].pages).toHaveLength(1);
    await advanceSourceJob(owner, q.jobId, deps);
    expect(model).not.toHaveBeenCalled();
  });
  it("stops a mismatched legacy upload before reserving or making a model call", async () => {
    const deps = {
      claim: vi.fn(async () => ({ state: "claimed" as const })),
      reserve: vi.fn(),
      beginCall: vi.fn(),
      usage: vi.fn(),
      finish: vi.fn(),
      parsePdf: vi.fn(async () => [
        "AQA A-level Physics specification\nVersion 1.3 18 October 2017\nPaper 2",
      ]),
      model: vi.fn(),
    };
    await expect(
      proposeProfile(
        owner,
        {
          action: "propose",
          requestId: crypto.randomUUID(),
          identity,
          mode: "full_mock",
          upload: {
            contentType: "application/pdf",
            base64: btoa("%PDF-1.7 original fixture"),
          },
        },
        deps,
      ),
    ).rejects.toThrow(/PDF states Version 1.3/);
    expect(deps.parsePdf).toHaveBeenCalledOnce();
    expect(deps.reserve).not.toHaveBeenCalled();
    expect(deps.beginCall).not.toHaveBeenCalled();
    expect(deps.model).not.toHaveBeenCalled();
  });
  it.each(["marks", "durationMinutes", "formats", "selection"] as const)(
    "cannot promote unknown %s into an authentic full mock",
    async (field) => {
      const e = await ownerEvidence(),
        t = templateFixture();
      t.mode = "full_mock";
      if (field === "formats") e.facts.formats = [];
      else if (field === "selection") e.facts.selection = "unknown";
      else e.facts[field] = null;
      expect(() => validateEvidenceTemplate(t, e)).toThrow(
        /requirements are unknown/,
      );
      expect(() =>
        validateEvidenceTemplate({ ...t, mode: "custom" }, e),
      ).not.toThrow();
    },
  );
  it.each(["marks", "partial topics"])(
    "a page answer cannot waive unresolved %s in an authentic full mock",
    async (missing) => {
      const source =
        "AQA A-level Physics (7408)\nSpecification\nVersion 1.4 July 2026\nPaper 2 (7408/2)\n85 marks; 120 minutes.\nMechanics and Waves. Sections 7 and 8.\nShort structured answers.\nAnswer all questions.\nA scientific calculator is allowed.";
      const memory = memoryJobStore(),
        parsePdf = vi.fn(async () => [source]);
      const model = vi.fn(async (_system: string, payload: any) => {
        const e = await ownerEvidence(),
          d = payload.documents[0];
        e.identity = { ...payload.identity };
        e.documents = [
          {
            ...e.documents[0],
            id: d.id,
            checksum: d.checksum,
            version: current,
            kind: "specification",
            locations: [
              { id: "loc", page: 1, section: "Paper 2", text: source },
            ],
          },
        ];
        e.facts = {
          ...e.facts,
          marks: missing === "marks" ? null : 85,
          durationMinutes: 120,
          topics:
            missing === "partial topics"
              ? ["Waves", "Sections 7 and 8"]
              : ["Mechanics", "Waves"],
          calculator: "allowed",
        };
        e.claims = [
          ["marks", "85 marks"],
          ["durationMinutes", "120 minutes"],
          ["topics", "Mechanics and Waves. Sections 7 and 8"],
          ["tier", "untiered"],
          ["calculator", "A scientific calculator is allowed"],
          ["formats", "Short structured answers"],
          ["selection", "Answer all questions"],
        ]
          .filter(([field]) => field !== "tier")
          .map(([field, quote]) => ({
            field,
            quote,
            documentId: d.id,
            locationId: "loc",
            rule: "mandatory" as const,
          }));
        return {
          value: { evidence: e, identityClaims: [] },
          promptTokens: 4,
          completionTokens: 4,
        };
      });
      const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
      const prepared = await prepareSourceJob(
        owner,
        {
          action: "prepare_source",
          requestId: crypto.randomUUID(),
          identity,
          mode: "full_mock",
          uploads: [
            {
              contentType: "application/pdf",
              base64: btoa("%PDF-1.7 fixture"),
            },
          ],
        },
        deps,
      );
      const first = await advanceSourceJob(owner, prepared.jobId, deps);
      expect(first.stage).toBe("needs_details");
      expect(first.missingItems?.[0].field).toBe("source_pages");
      const continued = await answerSourceJob(
        owner,
        first.jobId,
        { revision: first.revision!, answers: { source_pages: "1:1" } },
        deps,
      );
      expect(continued.stage).toBe("identifying");
      const second = await advanceSourceJob(owner, first.jobId, deps);
      expect(second.stage).toBe("needs_details");
      expect(second.missingItems?.[0].field).toBe("source");
      expect(second.proposal).toBeUndefined();
      expect(model).toHaveBeenCalledTimes(2);
      expect(parsePdf).toHaveBeenCalledOnce();
    },
  );
  it("rejects student additions or removals as full mock scope while preserving Custom", async () => {
    const e = await ownerEvidence(),
      t = templateFixture();
    t.mode = "full_mock";
    const added = {
      ...t,
      topics: [...t.topics, "Astrophysics"],
      addedTopics: ["Astrophysics"],
    };
    expect(() => validateEvidenceTemplate(added, e)).toThrow(
      /source topic scope/,
    );
    expect(() =>
      validateEvidenceTemplate({ ...added, mode: "custom" }, e),
    ).not.toThrow();
    expect(() =>
      validateEvidenceTemplate({ ...t, topics: [t.topics[0]] }, e),
    ).toThrow(/source topic scope/);
  });
  it("keeps an immutable historical attempt usable while blocking its mismatched profile for new generation", async () => {
    const evidence = await ownerEvidence(),
      template = templateFixture();
    template.identity = { ...identity };
    template.mode = "full_mock";
    evidence.identity = { ...identity };
    evidence.documents[0].kind = "specification";
    evidence.documents[0].version = current;
    const proposal: any = {
      proposalVersion: 1,
      promptVersion: 1,
      origin: "source_backed_ai",
      template,
      evidence,
      evidenceVersion: await evidenceFingerprint(evidence),
      presetId: null,
      profileSettings: null,
    };
    const saved = prepareProfileSave(proposal, template),
      profile = { ...saved.settings, profile_template: saved.context };
    const frozen = snapshotTemplate(profile)!;
    // This is a server-written historical snapshot fixture, not a client
    // override. Recomputing its fixture binding represents the old release.
    frozen.context.evidence!.documents[0].version = "1.3";
    frozen.context.evidence!.facts.formats = [];
    frozen.evidenceBindingChecksum = fingerprint(
      canonical(frozen.context.evidence),
    );
    expect(templateSnapshotPlan(frozen)?.totalMarks).toBe(template.marks);
    // An old profile is rechecked when used for a new generation.
    const old = structuredClone(profile);
    (old.profile_template.evidence as any).documents[0].version = "1.3";
    old.profile_template.evidenceVersion = await evidenceFingerprint(
      old.profile_template.evidence!,
    );
    expect(() => resolveSavedTemplate(old)).toThrow(
      /specification issue.*differs/,
    );
    expect(templateSnapshotPlan(frozen)?.totalMarks).toBe(template.marks);
  });
});
