// @vitest-environment node
import { expect, it } from "vitest";
import { build } from "esbuild";
import { resolvePaperSelection } from "../functions/_shared/course-selection";
import {
  resolveProfileContext,
  establishGenerationContext,
  toStoredGenerationContext,
} from "../functions/_shared/profile-context";
import { biologyPracticeCacheVersion } from "../functions/_shared/biology-practice";
import { selectVisualAssessment } from "../functions/_shared/biology-visual-assessment";
import { ocrPaper3Snapshot } from "./ocr-alevel-paper3-fixtures";
import {
  simulatedApprovedAssets,
  simulatedApprovedFiles,
} from "./biology-visual-fixtures";
const blueprint = (mode = "full_mock") => ({
  courseSelection: {
    courseId: "ocr_alevel_biology_a_h420",
    paperId: "paper_3",
  },
  paperContract: { ...ocrPaper3Snapshot().paper_contract, mode },
  visualAssessment: "ocr_h420_03_visual_v1",
});
it("requires an explicit guided Paper 3 selection and preserves it through JSON save/reopen", () => {
  const saved = JSON.parse(JSON.stringify(blueprint()));
  const lookup = {
    subject: "Biology",
    examBoard: "OCR",
    educationalTier: "A-Level",
  };
  const selection = resolvePaperSelection(lookup, "not_tiered", saved);
  expect(selection.visualPolicy).toBe("ocr_h420_03_visual_v1");
  expect(selection.responseFormats).toBe("interactive_v1");
  expect(selection.componentCode).toBe("H420/03");
  for (const mode of ["custom", "unrecognised"])
    expect(() =>
      resolvePaperSelection(lookup, "not_tiered", blueprint(mode)),
    ).toThrow();
  for (const paperId of ["paper_1", "paper_2"])
    expect(() =>
      resolvePaperSelection(lookup, "not_tiered", {
        ...saved,
        courseSelection: { ...saved.courseSelection, paperId },
        paperContract: { ...saved.paperContract, paperId },
      }),
    ).toThrow(/explicitly saved/);
});
it("resolves the owned profile, ignores browser metadata and fails before model use when assets lack review", async () => {
  const filters: any[] = [];
  const client = {
    from() {
      const q: any = {
        select: () => q,
        eq: (...v: any[]) => {
          filters.push(v);
          return q;
        },
        maybeSingle: async () => ({
          data: {
            id: "profile",
            user_id: "owner",
            subject_name: "Biology",
            exam_board: "OCR",
            educational_tier: "A-Level",
            assessment_tier: "not_tiered",
            paper_blueprint: blueprint(),
          },
          error: null,
        }),
      };
      return q;
    },
  };
  await expect(
    resolveProfileContext(client, {
      userId: "owner",
      subjectName: "Other",
      profileId: "profile",
      examBoard: "AQA",
      educationalTier: "GCSE",
      assessmentTier: "higher",
    }),
  ).rejects.toThrow(/missing-approved-asset/);
  expect(filters).toContainEqual(["user_id", "owner"]);
});
it("freezes exact asset references on retries after profile edits without re-reading or changing context", async () => {
  const saved = {
    ...ocrPaper3Snapshot("short_practice"),
    profile_id: "profile",
    visual_assets: selectVisualAssessment(
      "short_practice",
      simulatedApprovedAssets(),
      simulatedApprovedFiles(),
    ),
  };
  const row = { profile_id: "profile", generation_context: saved };
  const client = {
    from() {
      throw new Error(
        "An existing attempt must not re-read an edited profile.",
      );
    },
  };
  expect(await establishGenerationContext(client, "set", "owner", row)).toBe(
    saved,
  );
  expect(row.generation_context.visual_assets).toEqual(saved.visual_assets);
  const stored = toStoredGenerationContext({
    contextVersion: 2,
    subjectName: "Biology",
    profileId: "profile",
    profileName: "Original",
    examBoard: "OCR",
    educationalTier: "A-Level",
    assessmentTier: "not_tiered",
    assessmentTierSupported: false,
    courseId: saved.course_id,
    paperId: "paper_3",
    componentCode: "H420/03",
    paperContract: saved.paper_contract,
    visualAssets: saved.visual_assets,
  });
  expect(stored.visual_assets).toEqual(saved.visual_assets);
});
it("isolates practice caches by component, mode, version and checksum", () => {
  const short = {
    ...ocrPaper3Snapshot("short_practice"),
    visual_assets: selectVisualAssessment(
      "short_practice",
      simulatedApprovedAssets(),
      simulatedApprovedFiles(),
    ),
  };
  const full = {
    ...ocrPaper3Snapshot(),
    visual_assets: selectVisualAssessment(
      "full_mock",
      simulatedApprovedAssets(),
      simulatedApprovedFiles(),
    ),
  };
  expect(biologyPracticeCacheVersion(short)).not.toBe(
    biologyPracticeCacheVersion(full),
  );
  expect(biologyPracticeCacheVersion(short)).not.toBe(
    biologyPracticeCacheVersion(ocrPaper3Snapshot("short_practice")),
  );
  const changed = structuredClone(short);
  changed.visual_assets.assignments[0].resource.panels[0].asset.checksum =
    "0".repeat(64);
  expect(biologyPracticeCacheVersion(changed)).not.toBe(
    biologyPracticeCacheVersion(short),
  );
});
it("does not ship scientific annotations, internal approval/evidence ledgers or test fixtures in the frontend", async () => {
  const result = await build({
    entryPoints: ["src/main.tsx"],
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    tsconfig: "tsconfig.app.json",
    loader: { ".css": "empty" },
    logLevel: "silent",
  });
  expect(
    Object.keys(result.metafile!.inputs).filter((path) =>
      /biology-visual-(assessment|library|fixtures)|\/evidence\//.test(path),
    ),
  ).toEqual([]);
}, 30000);
