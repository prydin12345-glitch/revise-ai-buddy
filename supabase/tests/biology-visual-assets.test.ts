// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import baseline from "./fixtures/biology-pre-visual-assets-baseline.json";
import {
  commonsLicence,
  commonsCandidate,
} from "../functions/_shared/biology-visual-ingestion";
import {
  assetReady,
  recordAssetReview,
  reviewedAsset,
  verifyVisualBytes,
  BIOLOGY_ASSET_LEDGER,
} from "../functions/_shared/biology-visual-library";
import {
  APPROVED_VISUAL_FILES,
  SYNTHETIC_VISUAL_FILES,
  parseVisualResource,
  imageCredit,
} from "../functions/_shared/biology-visual-public";
import {
  selectVisualAssessment,
  applyVisualAssessment,
  seededVisualRows,
  visualAssignmentIssue,
} from "../functions/_shared/biology-visual-assessment";
import { visualPublicIssue } from "../functions/_shared/biology-visual-plan";
import { parseResponseEnvelope } from "../functions/_shared/response-contract";
import { markResponse } from "../functions/_shared/response-marking";
import { responseWritePayload } from "../functions/_shared/response-generation";
import { responseResources } from "../functions/_shared/response-resources";
import { projectResponseQuestions } from "../functions/_shared/response-service";
import { studentQuestion } from "../functions/_shared/exam-access";
import {
  getBiologyPaperPack,
  biologyPlanInstructions,
} from "../functions/_shared/biology-course-packs";
import { buildOcrAlevelPaper3Plan } from "../functions/_shared/ocr-alevel-biology-paper3-contract";
import {
  testAssets,
  testReview,
  simulatedApprovedAssets,
  simulatedApprovedFiles,
  visualFixture,
} from "./biology-visual-fixtures";
const meta = (
  name = "CC BY 4.0",
  url = "https://creativecommons.org/licenses/by/4.0/",
) => ({
  LicenseShortName: { value: name },
  LicenseUrl: { value: url },
  Artist: { value: "Named creator" },
  Restrictions: { value: "" },
  Copyrighted: { value: "False" },
});
it.each([
  ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/", "review_queue"],
  ["CC0", "https://creativecommons.org/publicdomain/zero/1.0/", "review_queue"],
  [
    "Public domain",
    "https://creativecommons.org/publicdomain/mark/1.0/",
    "review_queue",
  ],
  [
    "CC BY-SA 4.0",
    "https://creativecommons.org/licenses/by-sa/4.0/",
    "manual_legal_review",
  ],
  [
    "CC BY-NC 4.0",
    "https://creativecommons.org/licenses/by-nc/4.0/",
    "rejected",
  ],
  [
    "CC BY-ND 4.0",
    "https://creativecommons.org/licenses/by-nd/4.0/",
    "rejected",
  ],
  ["Educational use only", "", "rejected"],
  ["All rights reserved", "", "rejected"],
  ["CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/", "rejected"],
  ["Unknown", "", "rejected"],
])("file licence %s remains %s", (name, url, state) => {
  expect(commonsLicence(meta(name, url)).state).toBe(state);
});
it("rejects missing, conflicting, restricted or ambiguous licence evidence", () => {
  for (const m of [
    { ...meta(), Artist: {} },
    { ...meta(), LicenseUrl: { value: "https://example.com/claim" } },
    { ...meta(), Restrictions: { value: "Non-commercial only" } },
    { ...meta(), LicenseShortName: { value: "CC BY 4.0 or GFDL" } },
  ])
    expect(commonsLicence(m).state).toBe("rejected");
});
it("requires structured individual evidence, an allowed HTTPS original, and no examination/AI assets", () => {
  const page = {
    pageid: 123,
    ns: 6,
    title: "File:Original specimen.png",
    imageinfo: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/file.png",
        descriptionurl:
          "https://commons.wikimedia.org/wiki/File:Original_specimen.png",
        width: 400,
        height: 260,
        extmetadata: meta(),
      },
    ],
  };
  const c = commonsCandidate(page, "2026-10-06");
  expect(c.state).toBe("quarantined");
  expect(c.rawEvidence).toEqual(page);
  expect(c.checksum).toBeNull();
  for (const title of [
    "File:OCR exam paper.png",
    "File:AI-generated specimen.png",
  ])
    expect(() => commonsCandidate({ ...page, title }, "2026-10-06")).toThrow();
  expect(() =>
    commonsCandidate(
      {
        ...page,
        imageinfo: [
          { ...page.imageinfo[0], url: "https://other.example/a.png" },
        ],
      },
      "2026-10-06",
    ),
  ).toThrow();
});
it("requires separate complete reviews and keeps originals, rejected and deprecated assets unavailable", () => {
  let a = testAssets()[0];
  expect(assetReady(a, "alevel", "label")).toBe(false);
  a = recordAssetReview(a, "licence", testReview("licence")) as typeof a;
  expect(a.state).toBe("quarantined");
  a = recordAssetReview(a, "scientific", testReview("scientific")) as typeof a;
  expect(a.state).toBe("approved");
  expect(assetReady(a, "alevel", "label")).toBe(false); // Fixture remains excluded.
  expect(() =>
    recordAssetReview(a, "scientific", {
      ...testReview("scientific"),
      checks: {},
    }),
  ).toThrow();
  for (const state of ["rejected", "deprecated"] as const)
    expect(() =>
      recordAssetReview(
        { ...a, state },
        "scientific",
        testReview("scientific"),
      ),
    ).toThrow();
  expect(() =>
    recordAssetReview(
      {
        ...a,
        licenceReview: { ...a.licenceReview, status: "manual_legal_review" },
      },
      "licence",
      testReview("licence"),
    ),
  ).toThrow();
  for (const bad of [
    { ...simulatedApprovedAssets()[0], origin: "ai_raster" as const },
    {
      ...simulatedApprovedAssets()[0],
      identityDisclosure: "public_identity" as const,
    },
    {
      ...simulatedApprovedAssets()[0],
      licence: { ...a.licence, name: "CC BY-NC" },
    },
    {
      ...simulatedApprovedAssets()[0],
      scientificReview: { ...testReview("scientific"), reviewer: null },
    },
  ])
    expect(assetReady(bad, "alevel", "label")).toBe(false);
});
it("pins hashes, immutable versions, reviewed levels and board-independent roles", async () => {
  for (const file of SYNTHETIC_VISUAL_FILES) await verifyVisualBytes(file);
  await expect(
    verifyVisualBytes({
      ...SYNTHETIC_VISUAL_FILES[0],
      svg: SYNTHETIC_VISUAL_FILES[0].svg + " ",
    }),
  ).rejects.toThrow(/geometry/);
  await expect(
    verifyVisualBytes({
      ...SYNTHETIC_VISUAL_FILES[0],
      checksum: "0".repeat(64),
    }),
  ).rejects.toThrow(/checksum/);
  const assets = simulatedApprovedAssets(),
    files = simulatedApprovedFiles(),
    a = assets[0];
  expect(reviewedAsset(a, "gcse", "label", assets, files).assetId).toBe(
    reviewedAsset(a, "alevel", "label", assets, files).assetId,
  );
  expect(JSON.stringify(a)).not.toMatch(/OCR|H420|AQA|Edexcel/);
  expect(() =>
    reviewedAsset({ ...a, version: 2 }, "alevel", "label", assets, files),
  ).toThrow();
  expect(() =>
    reviewedAsset(a, "alevel", "label", [{ ...a, levels: ["gcse"] }], files),
  ).toThrow();
});
it("has complete fixture attribution, neutral public metadata and no production approvals", () => {
  expect(BIOLOGY_ASSET_LEDGER).toEqual([]);
  expect(APPROVED_VISUAL_FILES).toEqual([]);
  for (const file of SYNTHETIC_VISUAL_FILES) {
    expect(imageCredit(file.credit)).toContain("Examly");
    expect(file.credit.sourceUrl).toBeTruthy();
    expect(file.credit.licenceUrl).toBeTruthy();
    expect(file.credit.modifications.length).toBeGreaterThan(0);
    expect(JSON.stringify(file)).not.toMatch(
      /xylem|phloem|epithelial|muscle|connective|accepted|expected|answer_key/i,
    );
  }
});
it.each(["private_overlay", "accepted", "alt", "url"] as const)(
  "rejects extra answer-bearing public property %s",
  (property) => {
    const f = visualFixture();
    expect(() =>
      parseVisualResource({ ...f.resource, [property]: "xylem" }),
    ).toThrow();
    expect(() =>
      parseVisualResource({
        ...f.resource,
        panels: [{ ...f.resource.panels[0], [property]: "xylem" }],
      }),
    ).toThrow();
  },
);
it("rejects answer text in letters, invalid coordinates, duplicate panels and changed asset versions", () => {
  const r = visualFixture().resource;
  for (const bad of [
    { ...r, panels: [...r.panels, ...r.panels] },
    {
      ...r,
      panels: [{ ...r.panels[0], asset: { ...r.panels[0].asset, version: 2 } }],
    },
    {
      ...r,
      panels: [
        {
          ...r.panels[0],
          targets: [{ ...r.panels[0].targets[0], letter: "xylem" }],
        },
      ],
    },
    {
      ...r,
      panels: [
        { ...r.panels[0], targets: [{ ...r.panels[0].targets[0], x: 2 }] },
      ],
    },
  ])
    expect(() => parseVisualResource(bad)).toThrow();
});
it.each(["label", "compare", "observe"] as const)(
  "normalizes %s into independently marked existing fields and one capped total",
  async (role) => {
    const f = visualFixture(role),
      fields = Object.fromEntries(
        f.key.units.flatMap((u) =>
          u.targetIds.map((id) => [
            id,
            u.rule.kind === "text"
              ? "  " + u.rule.accepted[0].toUpperCase() + "  "
              : "Visible features support this identification.",
          ]),
        ),
      );
    const response = parseResponseEnvelope(
      {
        version: 1,
        questionId: "q",
        definitionRevision: f.definition.revision,
        kind: "fields",
        value: { fields },
      },
      f.definition,
      "q",
    );
    const marker = vi.fn(async (units) => ({
      units: units.map((u: any) => ({
        unitId: u.unitId,
        score: u.maxMarks,
        feedback: "Visible evidence correctly linked.",
      })),
    }));
    const result = await markResponse(
      {
        questionId: "q",
        marks: f.part.marks,
        definition: f.definition,
        key: f.key,
        response,
      },
      marker,
    );
    expect(result.score).toBe(f.part.marks);
    expect(result.maxMarks).toBe(f.part.marks);
    expect(result.units).toHaveLength(role === "compare" ? 4 : 2);
    expect(marker).toHaveBeenCalledTimes(role === "label" ? 0 : 1);
    const row = {
      id: "q",
      marks: f.part.marks,
      question_text: f.question_text,
      diagram_config: f.resource,
      correct_answer: JSON.stringify({
        format: "examly_response_v1",
        original_answer: "Private test rubric",
        definition: f.definition,
        key: f.key,
      }),
    };
    const payload = responseWritePayload(row);
    expect(payload.question.correct_answer).toBeNull();
    expect(responseResources(payload.question, f.definition)).toEqual([
      f.resource,
    ]);
    expect(JSON.stringify(studentQuestion(payload.question))).not.toContain(
      "accepted",
    );
  },
);
it("failed evidence marking stays ungraded rather than yielding a partially persisted zero", async () => {
  const f = visualFixture("compare");
  await expect(
    markResponse(
      {
        questionId: "q",
        marks: 4,
        definition: f.definition,
        key: f.key,
        response: {
          version: 1,
          questionId: "q",
          definitionRevision: f.definition.revision,
          kind: "fields",
          value: { fields: { evidence: "My evidence" } },
        },
      },
      async () => {
        throw new Error("Synthetic marking failure");
      },
    ),
  ).rejects.toThrow();
});
it.each(["full_mock", "short_practice"] as const)(
  "resolves all %s assets BEFORE any model callback; missing approvals fail closed",
  async (mode) => {
    expect(() => selectVisualAssessment(mode)).toThrow(
      /missing-approved-asset/,
    );
    const assets = simulatedApprovedAssets(),
      files = simulatedApprovedFiles(),
      saved = selectVisualAssessment(mode, assets, files),
      plan = applyVisualAssessment(
        buildOcrAlevelPaper3Plan(mode, "not_tiered"),
        saved,
        assets,
        files,
      )!;
    const rows = await seededVisualRows(plan, assets, files);
    expect(rows).toHaveLength(mode === "full_mock" ? 3 : 2);
    expect(plan.totalMarks).toBe(mode === "full_mock" ? 70 : 20);
    expect(plan.durationMinutes).toBe(mode === "full_mock" ? 90 : 26);
    expect(plan.parts.some((p) => p.responseType === "mcq_single")).toBe(false);
    for (const row of rows) {
      const p = plan.parts.find(
        (p) => p.questionNumber === row.question_number,
      ) as any;
      expect(visualPublicIssue(row, p.visualAssignment)).toBeNull();
      expect(
        visualPublicIssue(
          {
            ...row,
            question_text: row.question_text + " A chloroplast is visible.",
          },
          p.visualAssignment,
        ),
      ).toMatch(/claims/);
      expect(
        visualPublicIssue(
          { ...row, diagram_config: { ...row.diagram_config, panels: [] } },
          p.visualAssignment,
        ),
      ).toBeTruthy();
    }
    expect(() =>
      applyVisualAssessment(plan, { ...saved, assignments: [] }, assets, files),
    ).toThrow();
  },
);
it("releases the same private visual key only through the existing authorized projection", async () => {
  const f = visualFixture(),
    row = {
      id: "q",
      marks: 2,
      diagram_config: { type: "response_context", resources: [f.resource] },
      question_text: f.question_text,
    };
  const client = {
    from(table: string) {
      const q: any = {
        select: () => q,
        in: () => q,
        eq: () => q,
        then: (resolve: any) =>
          Promise.resolve({
            data:
              table === "question_response_contracts"
                ? [
                    {
                      id: "contract",
                      exam_question_id: "q",
                      definition: f.definition,
                      marking_key: f.key,
                    },
                  ]
                : [],
            error: null,
          }).then(resolve),
      };
      return q;
    },
  };
  const hidden = await projectResponseQuestions(
    client,
    "exam",
    [row],
    "user",
    () => false,
  );
  expect(hidden[0].response_key).toBeUndefined();
  expect(JSON.stringify(hidden)).not.toContain("xylem");
  const released = await projectResponseQuestions(
    client,
    "exam",
    [row],
    "user",
    () => true,
  );
  expect(released[0].response_key).toEqual(f.key);
  expect(released[0].response_resources).toEqual([f.resource]);
});
it("preserves ALL 50 existing Biology plans, definitions and prompt fingerprints", () => {
  expect(baseline.cases).toHaveLength(50);
  const sha = (v: any) =>
    createHash("sha256")
      .update(typeof v === "string" ? v : JSON.stringify(v))
      .digest("hex");
  for (const b of baseline.cases) {
    const pack = getBiologyPaperPack(b.courseId, b.paperId, b.contractVersion)!;
    const plan = pack.build(b.mode as any, b.tier as any)!;
    expect(sha(plan)).toBe(b.planHash);
    expect(sha(pack.definition(b.tier as any))).toBe(b.definitionHash);
    expect(sha(biologyPlanInstructions(plan))).toBe(b.promptHash);
  }
});
it("supports neutral blank targets and arrows without allowing hidden label text in field IDs", () => {
  const r = visualFixture().resource;
  const changed = structuredClone(r);
  changed.panels[0].targets[0] = {
    ...changed.panels[0].targets[0],
    style: "blank",
    letter: "",
  };
  changed.panels[0].targets[1].style = "arrow";
  expect(parseVisualResource(changed)).toEqual(changed);
  changed.panels[0].targets[0].fieldId = "xylem";
  expect(() => parseVisualResource(changed)).toThrow();
});
it("requires complete attribution/evidence and validated code geometry even with simulated review approvals", async () => {
  const a = simulatedApprovedAssets()[0];
  expect(assetReady({ ...a, creator: "" }, "alevel", "label")).toBe(false);
  expect(assetReady({ ...a, evidenceId: "" }, "alevel", "label")).toBe(false);
  expect(
    assetReady(
      { ...a, scientificReview: { ...a.scientificReview, evidence: [""] } },
      "alevel",
      "label",
    ),
  ).toBe(false);
  await expect(
    verifyVisualBytes({ ...SYNTHETIC_VISUAL_FILES[0], geometry: undefined }),
  ).rejects.toThrow(/validated geometry/);
});
it("rejects duplicate image stimuli and cannot fill comparison slots using repeated copies of one approved asset", () => {
  const r = visualFixture("compare").resource,
    changed = structuredClone(r);
  changed.panels[1].asset = structuredClone(changed.panels[0].asset);
  expect(() => parseVisualResource(changed)).toThrow(
    /Duplicate visual stimulus/,
  );
  const assets = simulatedApprovedAssets().slice(0, 2),
    files = simulatedApprovedFiles().slice(0, 2);
  const duplicate = { ...assets[1], assetId: "bio_va_duplicate" };
  const duplicateFile = {
    ...files[1],
    assetId: duplicate.assetId,
    credit: { ...files[1].credit, assetId: duplicate.assetId },
  };
  expect(() =>
    selectVisualAssessment(
      "full_mock",
      [...assets, duplicate],
      [...files, duplicateFile],
    ),
  ).toThrow(/missing-approved-asset/);
});
it("loads live marking annotations only from private server configuration and rejects committed annotations or changed reviewed hashes", async () => {
  const {
    privateReviewedLibrary,
    privateAnnotationRecord,
    verifyVisualAnnotations,
  } = await import("../functions/_shared/biology-visual-library");
  const assets = simulatedApprovedAssets(),
    metadata = assets.map(
      ({ features, identityAnswers, evidenceGuidance, ...rest }) => rest,
    ),
    secret = JSON.stringify({
      version: 1,
      assets: assets.map(privateAnnotationRecord),
    });
  expect(privateReviewedLibrary(metadata, secret)).toEqual(assets);
  expect(() => privateReviewedLibrary(assets, secret)).toThrow(
    /must not be committed/,
  );
  expect(() => privateReviewedLibrary(metadata, undefined)).toThrow(
    /missing-private-reviewed-annotations/,
  );
  expect(() =>
    privateReviewedLibrary(
      metadata,
      secret.replace('"version":1', '"version":99'),
    ),
  ).toThrow();
  await verifyVisualAnnotations(assets[0]);
  await expect(
    verifyVisualAnnotations({
      ...assets[0],
      identityAnswers: ["A modified unreviewed answer"],
    }),
  ).rejects.toThrow(/reviewed checksum/);
});
it("does not require private configuration for ordinary papers or quarantined candidates", async () => {
  const pending = testAssets()[0];
  const { features, identityAnswers, evidenceGuidance, ...metadata } = pending;
  BIOLOGY_ASSET_LEDGER.push(metadata);
  try {
    expect(
      await seededVisualRows(
        buildOcrAlevelPaper3Plan("full_mock", "not_tiered")!,
      ),
    ).toEqual([]);
    expect(() => selectVisualAssessment("full_mock")).toThrow(
      /missing-approved-asset/,
    );
    expect(
      applyVisualAssessment(
        buildOcrAlevelPaper3Plan("full_mock", "not_tiered"),
        null,
      ),
    ).toBeTruthy();
  } finally {
    BIOLOGY_ASSET_LEDGER.length = 0;
  }
});
it("rejects incomplete or incorrectly labelled public attribution despite simulated approvals", () => {
  const assets = simulatedApprovedAssets(),
    files = simulatedApprovedFiles();
  for (const change of [
    { description: "" },
    { licence: "CC BY 4.0" },
    { version: 99 },
    { creator: "" },
  ]) {
    const changed = structuredClone(files);
    Object.assign(changed[0].credit, change);
    expect(() =>
      reviewedAsset(assets[0], "alevel", "label", assets, changed),
    ).toThrow(/attribution/);
  }
});
it("requires the complete normalized private contract and rejects extra URLs or hidden resources on frozen visual parts", async () => {
  const { validateGeneratedResponses } = await import(
    "../functions/_shared/response-generation"
  );
  const f = visualFixture();
  const row = {
    marks: 2,
    question_text: f.question_text,
    diagram_config: f.resource,
    correct_answer: "An incomplete legacy answer",
  };
  expect(() => validateGeneratedResponses([row], {})).toThrow(
    /complete normalized private/,
  );
  for (const change of [
    { figure_urls: ["https://arbitrary.example/specimen.png"] },
    { table_data: "Hidden required measurements" },
    { question_latex: "An unreviewed alternative task" },
    { options: ["An unexpected answer hint"] },
  ])
    expect(visualPublicIssue({ ...row, ...change }, f.assignment)).toMatch(
      /hidden resources/,
    );
});
