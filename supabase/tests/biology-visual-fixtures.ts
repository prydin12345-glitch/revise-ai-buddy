import type {
  ReviewedBiologyAsset,
  Review,
  VisualAssignment,
} from "../functions/_shared/biology-visual-types";
import { SYNTHETIC_VISUAL_FILES } from "../functions/_shared/biology-visual-public";
import {
  SCIENTIFIC_CHECKS,
  LICENCE_CHECKS,
  privateAnnotationRecord,
} from "../functions/_shared/biology-visual-library";
import { createHash } from "node:crypto";
import { visualQuestion } from "../functions/_shared/biology-visual-assessment";
import { buildOcrAlevelPaper3Plan } from "../functions/_shared/ocr-alevel-biology-paper3-contract";
/** Every reviewer/approval below is a SYNTHETIC TEST record, never a real approval. */
export const testReview = (kind: "scientific" | "licence"): Review => ({
  status: "approved",
  reviewer: `synthetic-test-${kind}-reviewer`,
  reviewedAt: "2026-10-06T12:00:00Z",
  evidence: [
    "Original test-only geometry. Not a scientific or legal certification.",
  ],
  checks: Object.fromEntries(
    (kind === "scientific" ? SCIENTIFIC_CHECKS : LICENCE_CHECKS).map((k) => [
      k,
      true,
    ]),
  ),
});
export const testAssets = (): ReviewedBiologyAsset[] =>
  SYNTHETIC_VISUAL_FILES.map(
    (f, i) =>
      ({
        ...f,
        type: "deterministic_svg",
        origin: "original_code",
        concepts:
          i === 0
            ? [
                "plant_transport",
                "biotechnology_microorganisms",
                "gas_exchange",
                "disease",
              ]
            : ["biotechnology_microorganisms"],
        organisms: [],
        structures: [],
        levels: ["gcse", "alevel", "ap", "ib", "university", "international"],
        roles: ["label", "compare", "observe"],
        sourceUrl: "/image-credits",
        originalUrl: "/image-credits",
        creator: "Examly",
        licence: {
          name: "CC0",
          version: "1.0",
          url: "https://creativecommons.org/publicdomain/zero/1.0/",
          commercial: true,
          modification: true,
        },
        attribution: "Original synthetic fixture by Examly",
        retrievedAt: "2026-10-06",
        modifications: ["Original schematic generated with code."],
        scientificReview: {
          status: "pending",
          reviewer: null,
          reviewedAt: null,
          evidence: [],
          checks: {},
        },
        licenceReview: {
          status: "pending",
          reviewer: null,
          reviewedAt: null,
          evidence: [],
          checks: {},
        },
        state: "quarantined",
        replacement: null,
        printSuitable: true,
        identityDisclosure: "neutral",
        evidenceId: "synthetic_" + f.assetId,
        features:
          i === 0
            ? [
                { id: "feature_1", x: 0.35, y: 0.44, accepted: ["xylem"] },
                { id: "feature_2", x: 0.66, y: 0.4, accepted: ["phloem"] },
              ]
            : [],
        identityAnswers: [
          [
            "vascular tissue",
            "epithelial tissue",
            "muscle tissue",
            "connective tissue",
          ][i],
        ],
        evidenceGuidance: [
          "Visible grouped circular and rectangular compartments.",
          "Closely packed cells with an aligned free surface.",
          "Parallel elongated fibres with repeated striations.",
          "Dispersed cells among fibres and spaces.",
        ][i],
      }) as ReviewedBiologyAsset,
  );
export const simulatedApprovedAssets = () =>
  testAssets().map((a) => ({
    ...a,
    annotationsChecksum: createHash("sha256")
      .update(JSON.stringify(privateAnnotationRecord(a)))
      .digest("hex"),
    usage: "production" as const,
    state: "approved" as const,
    scientificReview: testReview("scientific"),
    licenceReview: testReview("licence"),
  }));
export const simulatedPublicLedger = () =>
  simulatedApprovedAssets().map(
    ({ features, identityAnswers, evidenceGuidance, ...metadata }) => metadata,
  );
export const simulatedPrivateAnnotationSecret = () =>
  JSON.stringify({
    version: 1,
    assets: simulatedApprovedAssets().map(privateAnnotationRecord),
  });
export const simulatedApprovedFiles = () =>
  SYNTHETIC_VISUAL_FILES.map((f, i) => {
    const a = simulatedApprovedAssets()[i];
    return {
      ...f,
      usage: "production" as const,
      credit: {
        ...f.credit,
        sourceUrl: a.sourceUrl,
        creator: a.creator,
        licence: "CC0 1.0",
        licenceUrl: a.licence.url,
        attribution: a.attribution,
        modifications: a.modifications,
      },
    };
  });
export function visualFixture(role: "label" | "compare" | "observe" = "label") {
  const assets = testAssets(),
    chosen = role === "compare" ? assets.slice(1) : [assets[0]],
    part = {
      ...buildOcrAlevelPaper3Plan("full_mock", "not_tiered")!.parts[0],
      marks: role === "compare" ? 4 : 2,
    };
  const assignment: VisualAssignment = {
    questionNumber: "2(a)",
    configId: "ocr_h420_03_visual_v1_" + role,
    resource: {
      id: "visual_fixture",
      type: "biology_visual",
      kind: "biology_visual",
      title: "Biological visual stimulus",
      version: 1,
      panels: chosen.map((a, i) => ({
        id: "ABC"[i],
        asset: { assetId: a.assetId, version: a.version, checksum: a.checksum },
        targets:
          role === "label"
            ? a.features!.map((f, j) => ({
                fieldId: `target_${j + 1}`,
                letter: "AB"[j],
                x: 0.08,
                y: 0.16 + j * 0.64,
                endX: f.x,
                endY: f.y,
              }))
            : [],
      })),
    },
  };
  const q = visualQuestion(assignment, part, assets);
  return { ...q, assignment, part, assets };
}
