// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  advanceSourceJob,
  getSourceJob,
  prepareSourceJob,
  trustedDocumentSelection,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import type { TemplateIdentity } from "../functions/_shared/profile-template";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";
import { ownerEvidence } from "./profile-builder-fixtures";

const owner = "30000000-0000-4000-8000-000000000001";
const dates = "First teaching 2015, first exams 2017";
const literalVersion = "Version 1.4 July 2026";
const physicsIdentity = (
  overrides: Partial<TemplateIdentity> = {},
): TemplateIdentity => ({
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/1",
  specificationVersion: dates,
  tier: "not_tiered",
  ...overrides,
});
const assessment = (paper = 1, version: string | null = literalVersion) =>
  [
    `Paper ${paper}`,
    ...(version ? [version] : []),
    "85 marks; 120 minutes.",
    "This assessment is untiered.",
    "Mechanics and Waves.",
    "Short structured answers.",
    "Answer all questions.",
    "No calculator allowed.",
  ].join("\n");

function longPages(block = assessment()) {
  const pages = Array.from(
    { length: 100 },
    (_, index) => `Supporting material ${index}\n` + "x".repeat(900),
  );
  // An incomplete cover date must not be repaired from student-supplied notes.
  pages[0] = "AQA\nA-level Physics\nCourse 7408\nFor teaching from onwards";
  pages[89] = block;
  return pages;
}

function request(pages: string[], identity = physicsIdentity()) {
  return {
    action: "prepare_source" as const,
    requestId: crypto.randomUUID(),
    identity,
    mode: "short_practice" as const,
    uploads: [
      {
        contentType: "application/pdf" as const,
        // This is a parser fixture, not an actual PDF. Other tests exercise
        // unpdf itself; these tests exercise the existing source-job protocol.
        base64: Buffer.from("%PDF-1.7\n" + JSON.stringify(pages)).toString(
          "base64",
        ),
      },
    ],
  };
}

async function evidenceFor(payload: any, block: string, version: string) {
  const source = payload.documents[0];
  const page = source.pages.find((page: any) => page.text.includes(block));
  if (!page) throw Error("The literal assessment block was not retrieved.");
  const evidence = await ownerEvidence();
  evidence.identity = { ...payload.identity, specificationVersion: version };
  evidence.documents = [
    {
      ...evidence.documents[0],
      id: source.id,
      checksum: source.checksum,
      title: "Original synthetic Physics assessment specification",
      kind: "specification",
      version,
      applicableCohort: "Not established by this source",
      locations: [
        {
          id: "assessment",
          page: page.page,
          section: "Assessment overview",
          text: block,
        },
      ],
    },
  ];
  evidence.facts.topics = ["Mechanics", "Waves"];
  evidence.facts.marks = 85;
  evidence.facts.durationMinutes = 120;
  evidence.claims = [
    ["marks", "85 marks"],
    ["durationMinutes", "120 minutes"],
    ["topics", "Mechanics and Waves"],
    ["tier", "untiered"],
    ["calculator", "No calculator allowed"],
    ["formats", "Short structured answers"],
    ["selection", "Answer all questions"],
  ].map(([field, quote]) => ({
    field,
    quote,
    documentId: source.id,
    locationId: "assessment",
    rule: "mandatory" as const,
  }));
  return {
    evidence,
    identityClaims:
      version === payload.identity.specificationVersion
        ? []
        : [
            {
              field: "specificationVersion",
              documentId: source.id,
              locationId: "assessment",
              quote: version,
            },
          ],
  };
}

function setup(pages = longPages(), version = literalVersion) {
  const memory = memoryJobStore();
  const block = pages[89];
  const model = vi.fn(async (_system: string, payload: any) => ({
    value: await evidenceFor(payload, block, version),
    promptTokens: 11,
    completionTokens: 7,
  }));
  const parsePdf = vi.fn(async (_bytes: Uint8Array) => structuredClone(pages));
  const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
  return { memory, deps, model, parsePdf };
}

describe("reported Physics teaching-date source failure", () => {
  it("indexes a late Paper 1 without AI, retaining the original dates separately from effective identity", async () => {
    const pages = longPages(),
      runtime = setup(pages),
      input = request(pages);
    expect(pages.join("").length).toBeGreaterThan(45_000);
    const prepared = await prepareSourceJob(owner, input, runtime.deps);
    expect(prepared.stage).toBe("identifying");
    expect(prepared.identity?.component).toBe("7408/1");
    expect(prepared.identity?.specificationVersion).toBe("Not verified");
    expect(runtime.parsePdf).toHaveBeenCalledOnce();
    expect(runtime.model).not.toHaveBeenCalled();
    expect(runtime.memory.reservations).toBe(0);
    const record = runtime.memory.records.get(
      ownerKey(owner, input.requestId),
    )!;
    expect(record.data.requestedIdentity).toEqual(input.identity);
    expect(
      record.data.chunks.flatMap((chunk) =>
        chunk.sources.flatMap((source) => source.pages),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          page: 90,
          text: expect.stringContaining("Paper 1"),
        }),
      ]),
    );
    expect(prepared).not.toHaveProperty("data");
    expect(JSON.stringify(prepared)).not.toContain(assessment());
  });

  it("accepts a literally cited source version while the 2015/2017 text remains unverified context", async () => {
    const pages = longPages(),
      runtime = setup(pages),
      input = request(pages);
    await prepareSourceJob(owner, input, runtime.deps);
    const ready = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.identity?.specificationVersion).toBe(literalVersion);
    expect(runtime.model).toHaveBeenCalledOnce();
    const [system, payload] = runtime.model.mock.calls[0];
    expect(system).toMatch(/unverified student notes/);
    expect(payload.userContext).toEqual({
      specificationDates: dates,
      authority: "user_context_not_source_evidence",
    });
    expect(payload.identity.specificationVersion).toBe("Not verified");
    expect(
      payload.documents
        .flatMap((document: any) =>
          document.pages.map((page: any) => page.text),
        )
        .join("\n"),
    ).not.toMatch(/2015|2017/);
    expect(
      runtime.memory.records.get(ownerKey(owner, input.requestId))!.data
        .requestedIdentity.specificationVersion,
    ).toBe(dates);
  });

  it.each(["missing quoted year", "missing year in an actual cover quote"])(
    "does not restore a source date from userContext: %s",
    async (attack) => {
      const pages = longPages(assessment(1, null)),
        runtime = setup(pages, "2015"),
        input = request(pages);
      runtime.model.mockImplementation(async (_system, payload) => {
        const value = await evidenceFor(payload, pages[89], "2015");
        if (attack === "missing year in an actual cover quote") {
          const cover = payload.documents[0].pages.find(
            (page: any) => page.page === 1,
          );
          value.evidence.documents[0].locations.push({
            id: "cover",
            page: 1,
            section: "Cover",
            text: cover.text,
          });
          value.identityClaims[0].locationId = "cover";
          value.identityClaims[0].quote = "For teaching from onwards";
        } else {
          value.identityClaims[0].quote = "First teaching 2015";
        }
        return { value, promptTokens: 11, completionTokens: 7 };
      });
      await prepareSourceJob(owner, input, runtime.deps);
      const repair = await advanceSourceJob(
        owner,
        input.requestId,
        runtime.deps,
      );
      expect(repair.stage).toBe("identifying");
      const failed = await advanceSourceJob(
        owner,
        input.requestId,
        runtime.deps,
      );
      expect(failed.stage).toBe("failed");
      expect(failed.identity?.specificationVersion).toBe("Not verified");
      expect(runtime.model).toHaveBeenCalledTimes(2);
      await getSourceJob(owner, input.requestId, runtime.deps);
      await advanceSourceJob(owner, input.requestId, runtime.deps);
      expect(runtime.model).toHaveBeenCalledTimes(2);
    },
  );

  it("requires an actual version mismatch to be resolved after one charged extraction, with no blind repair", async () => {
    const pages = longPages(),
      runtime = setup(pages),
      input = request(pages, physicsIdentity({ specificationVersion: "v1.3" }));
    await prepareSourceJob(owner, input, runtime.deps);
    const result = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(result.stage).toBe("needs_details");
    expect(result.needs).toHaveLength(1);
    expect(result.needs![0]).toMatch(/Version 1\.4 July 2026/);
    expect(result.needs![0]).toMatch(/v1\.3/);
    expect(result.needs![0]).toMatch(/version|matching source/i);
    expect(runtime.model).toHaveBeenCalledOnce();
    expect(runtime.memory.usage).toHaveLength(1);
    await advanceSourceJob(owner, input.requestId, runtime.deps);
    await getSourceJob(owner, input.requestId, runtime.deps);
    expect((await prepareSourceJob(owner, input, runtime.deps)).stage).toBe(
      "needs_details",
    );
    expect(runtime.model).toHaveBeenCalledOnce();
    expect(runtime.parsePdf).toHaveBeenCalledOnce();
    expect(runtime.memory.reservations).toBe(1);
  });

  it("accepts a source version's literal display formatting without confusing it with a different issue", async () => {
    const pages = longPages(),
      runtime = setup(pages),
      input = request(
        pages,
        physicsIdentity({ specificationVersion: "v1.4-july-2026" }),
      );
    await prepareSourceJob(owner, input, runtime.deps);
    const ready = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.identity?.specificationVersion).toBe(literalVersion);
    expect(runtime.model).toHaveBeenCalledOnce();
    expect(runtime.model.mock.calls[0][1]).not.toHaveProperty("userContext");
  });

  it("normalises legacy lowercase board/wrapped paper names only within the exact known qualification", async () => {
    const pages = longPages(),
      runtime = setup(pages),
      input = request(
        pages,
        physicsIdentity({ organisation: "aqa", component: "(Paper 1)" }),
      );
    const prepared = await prepareSourceJob(owner, input, runtime.deps);
    expect(prepared.stage).toBe("identifying");
    expect(prepared.identity?.organisation).toBe("AQA");
    expect(prepared.identity?.component).toBe("7408/1");
    expect(
      runtime.memory.records.get(ownerKey(owner, input.requestId))!.data
        .requestedIdentity,
    ).toEqual(input.identity);
    expect(
      (await advanceSourceJob(owner, input.requestId, runtime.deps)).stage,
    ).toBe("ready");
    expect(
      trustedDocumentSelection({
        ...input.identity,
        course: "7407",
        qualification: "AS",
      }).componentAliases,
    ).toEqual([]);
  });
});

describe("readable-source recovery stays scoped and uncharged", () => {
  it("offers the assessment actually found in a long readable source using one targeted question", async () => {
    const pages = longPages(assessment(2)),
      runtime = setup(pages),
      input = request(pages);
    const result = await prepareSourceJob(owner, input, runtime.deps);
    expect(result.stage).toBe("needs_details");
    expect(result.needs).toEqual([
      "Which assessment in your source are you preparing for?",
    ]);
    expect(result.assessmentChoices).toHaveLength(1);
    expect(result.assessmentChoices![0].label).toMatch(/^Paper 2\b/);
    expect(result.needs!.join(" ")).not.toMatch(/readable|unreadable/i);
    expect(runtime.model).not.toHaveBeenCalled();
    expect(runtime.memory.reservations).toBe(0);
    expect(
      (await getSourceJob(owner, input.requestId, runtime.deps))
        .assessmentChoices,
    ).toEqual(result.assessmentChoices);
  });

  it.each(["AS-only source", "unseparated combined AS/A-level rows"])(
    "does not offer an unsafe paper choice from %s",
    async (source) => {
      const pages = longPages();
      if (source === "AS-only source") {
        pages[0] = "AQA\nAS Physics\nCourse 7407";
        pages[89] = assessment().replace(
          "85 marks; 120 minutes",
          "70 marks; 90 minutes",
        );
      } else {
        pages[0] = "AQA AS and A-level Physics specification\n7407 / 7408";
        pages[89] =
          "Assessment overview\nAS Paper 1 | 70 marks | 90 minutes\nA-level Paper 1 | 85 marks | 120 minutes";
      }
      const runtime = setup(pages),
        input = request(pages);
      const result = await prepareSourceJob(owner, input, runtime.deps);
      expect(result.stage).toBe("needs_details");
      expect(result.assessmentChoices).toBeUndefined();
      expect(result.needs?.join(" ")).toMatch(/AS|A-level|qualification/i);
      expect(result.needs?.join(" ")).not.toMatch(
        /not find readable|unreadable/i,
      );
      expect(runtime.model).not.toHaveBeenCalled();
      expect(runtime.memory.reservations).toBe(0);
    },
  );

  it("keeps only the A-level literal block from an explicitly separated combined page", async () => {
    const block = assessment(),
      pages = longPages(
        "AS\nPaper 1\n70 marks; 90 minutes.\nA-level\n" + block,
      ),
      runtime = setup(pages),
      input = request(pages);
    const prepared = await prepareSourceJob(owner, input, runtime.deps);
    expect(prepared.stage).toBe("identifying");
    const record = runtime.memory.records.get(
      ownerKey(owner, input.requestId),
    )!;
    const retrieved = record.data.chunks
      .flatMap((chunk) =>
        chunk.sources.flatMap((doc) => doc.pages.map((page) => page.text)),
      )
      .join("\n");
    expect(retrieved).toContain(block);
    expect(retrieved).not.toContain("70 marks");
    expect(retrieved).not.toContain("90 minutes");
  });

  it("still identifies a genuinely unreadable PDF as a reading failure rather than offering invented choices", async () => {
    const runtime = setup(["  "]),
      input = request(["  "]);
    const failed = await prepareSourceJob(owner, input, runtime.deps);
    expect(failed.stage).toBe("failed");
    expect(failed.needs?.join(" ")).toMatch(/no readable text/i);
    expect(failed.assessmentChoices).toBeUndefined();
    expect(runtime.model).not.toHaveBeenCalled();
  });
});

describe("Physics Paper 3 optional-section identity", () => {
  it.each(["7408/3", "7408/3BA"])(
    "includes only the explicitly selected named option's section code for %s",
    (component) => {
      const selection = trustedDocumentSelection(
        physicsIdentity({
          component,
          module: "Astrophysics",
        }),
      );
      expect(selection.componentAliases).toEqual(
        expect.arrayContaining(["Astrophysics", "7408/3BA"]),
      );
      expect(selection.componentAliases).not.toContain("Medical physics");
      expect(selection.componentAliases).not.toContain("7408/3BB");
    },
  );

  it("blocks a printed option code that disagrees with the chosen optional topic before any model call", async () => {
    const pages = longPages("Astrophysics\n7408/3BA\n" + assessment(3)),
      runtime = setup(pages),
      input = request(
        pages,
        physicsIdentity({ component: "7408/3BB", module: "Astrophysics" }),
      );
    const result = await prepareSourceJob(owner, input, runtime.deps);
    expect(result.stage).toBe("needs_details");
    expect(result.needs?.join(" ")).toMatch(
      /option|Astrophysics|section|component/i,
    );
    expect(runtime.model).not.toHaveBeenCalled();
    expect(runtime.memory.reservations).toBe(0);
    expect(
      trustedDocumentSelection(input.identity).componentAliases,
    ).not.toContain("7408/3BA");
  });
});
