import type {
  BiologyVisualResource,
  SavedVisualAssessment,
  VisualAssignment,
  VisualRole,
  ReviewedBiologyAsset,
  PublicVisualFile,
} from "./biology-visual-types.ts";
import type { PaperPlan, PlannedPart } from "./paper-contract-types.ts";
import {
  reviewedLibrary,
  verifyVisualAnnotations,
  assetReady,
  reviewedAsset,
  verifyVisualBytes,
} from "./biology-visual-library.ts";
import {
  APPROVED_VISUAL_FILES,
  parseVisualResource,
  publicVisualFile,
} from "./biology-visual-public.ts";
import {
  parseResponseDefinition,
  parsePrivateResponseKey,
  type ResponseDefinition,
  type PrivateResponseKey,
} from "./response-contract.ts";
export const OCR_UNIFIED_VISUAL_CONFIG = "ocr_h420_03_visual_v1" as const;
export const VISUAL_CONFIGS = {
  full_mock: [
    { number: "2(a)", role: "label", concept: "plant_transport", panels: 1 },
    {
      number: "4(d)",
      role: "compare",
      concept: "biotechnology_microorganisms",
      panels: 3,
    },
    { number: "5(a)", role: "observe", concept: "gas_exchange", panels: 1 },
  ],
  short_practice: [
    { number: "1(a)", role: "label", concept: "plant_transport", panels: 1 },
    { number: "2(a)", role: "observe", concept: "disease", panels: 1 },
  ],
} as const;
export type VisualPlannedPart = PlannedPart & {
  visualAssignment?: VisualAssignment;
};
export function selectVisualAssessment(
  mode: "full_mock" | "short_practice",
  ledger = reviewedLibrary(),
  files = APPROVED_VISUAL_FILES,
): SavedVisualAssessment {
  const assignments: VisualAssignment[] = VISUAL_CONFIGS[mode].map(
    (config): VisualAssignment => {
      const identities = new Set<string>(),
        checksums = new Set<string>();
      const compatible = ledger
        .filter(
          (a) =>
            a.concepts.includes(config.concept) &&
            assetReady(a, "alevel", config.role),
        )
        .sort(
          (a, b) => a.assetId.localeCompare(b.assetId) || b.version - a.version,
        )
        .filter((a) => {
          if (identities.has(a.assetId) || checksums.has(a.checksum))
            return false;
          identities.add(a.assetId);
          checksums.add(a.checksum);
          return true;
        });
      if (compatible.length < config.panels)
        throw new Error(
          `missing-approved-asset: ${config.concept}, A-level ${config.role}, ${config.panels} panel(s). Licence and scientific approval are both required.`,
        );
      const panels = compatible.slice(0, config.panels).map((asset, i) => {
        reviewedAsset(asset, "alevel", config.role, ledger, files);
        const targets =
          config.role === "label"
            ? (asset.features ?? []).slice(0, 2).map((feature, j) => ({
                fieldId: `target_${j + 1}`,
                letter: "AB"[j],
                x: 0.08,
                y: 0.16 + j * 0.64,
                endX: feature.x,
                endY: feature.y,
              }))
            : [];
        if (
          (config.role === "label" && targets.length !== 2) ||
          (config.role !== "label" &&
            (!asset.identityAnswers?.length || !asset.evidenceGuidance))
        )
          throw new Error(
            "Approved asset is missing its separately reviewed assessment annotations.",
          );
        return {
          id: "ABC"[i],
          asset: {
            assetId: asset.assetId,
            version: asset.version,
            checksum: asset.checksum,
          },
          targets,
        };
      });
      return {
        questionNumber: config.number,
        configId: `${OCR_UNIFIED_VISUAL_CONFIG}_${config.role}`,
        resource: {
          id: `visual_${config.number.replace(/[^0-9a-z]/g, "")}`,
          type: "biology_visual",
          kind: "biology_visual",
          title: "Biological visual stimulus",
          version: 1,
          panels,
        },
      };
    },
  );
  return { version: 1, configId: OCR_UNIFIED_VISUAL_CONFIG, assignments };
}
export function applyVisualAssessment(
  plan: PaperPlan | null,
  saved: unknown,
  ledger: ReviewedBiologyAsset[] | undefined = undefined,
  files = APPROVED_VISUAL_FILES,
): PaperPlan | null {
  if (saved == null) return plan;
  ledger ??= reviewedLibrary();
  if (
    !plan ||
    plan.courseId !== "ocr_alevel_biology_a_h420" ||
    plan.paperId !== "paper_3" ||
    plan.tier !== "not_tiered" ||
    !["full_mock", "short_practice"].includes(plan.mode)
  )
    throw new Error("Visual assessment requires explicit guided H420/03.");
  const s = saved as SavedVisualAssessment;
  if (
    s.version !== 1 ||
    s.configId !== OCR_UNIFIED_VISUAL_CONFIG ||
    Object.keys(s).some(
      (k) => !["version", "configId", "assignments"].includes(k),
    )
  )
    throw new Error("Invalid saved visual assessment configuration.");
  const expected = VISUAL_CONFIGS[plan.mode as "full_mock" | "short_practice"];
  if (!Array.isArray(s.assignments) || s.assignments.length !== expected.length)
    throw new Error("Incomplete frozen visual assessment.");
  for (const [i, a] of s.assignments.entries()) {
    const config = expected[i];
    if (
      a.questionNumber !== config.number ||
      a.configId !== `${s.configId}_${config.role}` ||
      Object.keys(a).some(
        (k) => !["questionNumber", "configId", "resource"].includes(k),
      )
    )
      throw new Error("Changed frozen visual assignment.");
    parseVisualResource(a.resource);
    if (a.resource.panels.length !== config.panels)
      throw new Error("Wrong visual panel count.");
    for (const panel of a.resource.panels) {
      const asset = reviewedAsset(
        panel.asset,
        "alevel",
        config.role,
        ledger,
        files,
      );
      if (!asset.concepts.includes(config.concept))
        throw new Error(
          "Wrong biological identity or intended assessment role.",
        );
      if (
        config.role === "label" &&
        JSON.stringify(panel.targets) !==
          JSON.stringify(
            (asset.features ?? []).slice(0, 2).map((f, j) => ({
              fieldId: `target_${j + 1}`,
              letter: "AB"[j],
              x: 0.08,
              y: 0.16 + j * 0.64,
              endX: f.x,
              endY: f.y,
            })),
          )
      )
        throw new Error("Overlay does not match reviewed scientific anchors.");
      if (config.role !== "label" && panel.targets.length)
        throw new Error("Unplanned answer overlay.");
    }
  }
  return {
    ...plan,
    parts: plan.parts.map((p) => ({
      ...p,
      ...(s.assignments.find((a) => a.questionNumber === p.questionNumber)
        ? {
            visualAssignment: structuredClone(
              s.assignments.find((a) => a.questionNumber === p.questionNumber),
            ),
          }
        : {}),
    })),
  };
}
export function visualQuestion(
  assignment: VisualAssignment,
  part: PlannedPart,
  ledger = reviewedLibrary(),
): {
  question_text: string;
  definition: ResponseDefinition;
  key: PrivateResponseKey;
  resource: BiologyVisualResource;
} {
  const role = assignment.configId.split("_").at(-1) as VisualRole,
    resource = parseVisualResource(assignment.resource);
  const units: PrivateResponseKey["units"] = [],
    fields: any[] = [];
  const field = (id: string, label: string) =>
    fields.push({ id, label, required: true, input: "text" });
  const exact = (id: string, accepted: string[]) => {
    if (!accepted?.length)
      throw new Error("Missing approved private structure answers.");
    units.push({
      id: "unit_" + id,
      targetIds: [id],
      marks: 1,
      rule: { kind: "text", accepted, caseSensitive: false },
    });
  };
  for (const panel of resource.panels) {
    const asset = ledger.find(
      (a) =>
        a.assetId === panel.asset.assetId && a.version === panel.asset.version,
    );
    if (!asset) throw new Error("Missing reviewed private visual annotations.");
    if (role === "label")
      for (const target of panel.targets) {
        field(target.fieldId, `Identify structure ${target.letter}`);
        const feature = asset.features?.find(
          (f) => f.x === target.endX && f.y === target.endY,
        );
        exact(target.fieldId, feature?.accepted ?? []);
      }
    else {
      const id = "panel_" + panel.id.toLowerCase();
      field(id, `Identify the specimen in panel ${panel.id}`);
      exact(id, asset.identityAnswers ?? []);
    }
  }
  if (role !== "label") {
    field(
      "evidence",
      "Explain your identification using visible evidence from the supplied specimen(s)",
    );
    const remaining = part.marks - units.reduce((s, u) => s + u.marks, 0);
    if (remaining < 1)
      throw new Error("Visual task has no marks for evidence.");
    units.push({
      id: "unit_evidence",
      targetIds: ["evidence"],
      marks: remaining,
      rule: {
        kind: "rubric",
        guidance:
          resource.panels
            .map(
              (p) =>
                `Panel ${p.id}: ${ledger.find((a) => a.assetId === p.asset.assetId && a.version === p.asset.version)?.evidenceGuidance}`,
            )
            .join("\n") +
          ` Credit visible evidence and supported reasoning only; cap ${remaining}.`,
      },
    });
  }
  const definition = parseResponseDefinition({
      version: 1,
      revision: "visual_v1",
      resourceIds: [resource.id],
      kind: "fields",
      fields,
    }),
    key = parsePrivateResponseKey(
      {
        version: 1,
        definitionRevision: "visual_v1",
        maxMarks: part.marks,
        units,
      },
      definition,
      part.marks,
    );
  const question_text =
    role === "label"
      ? "Researchers examine the supplied biological section.\n\nIdentify the structures indicated by letters A and B."
      : role === "compare"
        ? "Researchers compare the three supplied biological specimens in one investigation.\n\nIdentify each specimen in panels A, B and C. Explain one identification using visible evidence."
        : "Researchers examine the supplied biological specimen.\n\nIdentify the specimen and explain your identification using visible evidence.";
  return { question_text, definition, key, resource };
}
export async function seededVisualRows(
  plan: PaperPlan,
  ledger: ReviewedBiologyAsset[] | undefined = undefined,
  files = APPROVED_VISUAL_FILES,
) {
  if (!plan.parts.some((p) => (p as VisualPlannedPart).visualAssignment))
    return [];
  ledger ??= reviewedLibrary();
  const rows: any[] = [];
  for (const part of plan.parts as VisualPlannedPart[]) {
    if (!part.visualAssignment) continue;
    for (const panel of part.visualAssignment.resource.panels) {
      await verifyVisualBytes(publicVisualFile(panel.asset, files));
      const asset = ledger.find(
        (a) =>
          a.assetId === panel.asset.assetId &&
          a.version === panel.asset.version,
      );
      if (!asset)
        throw new Error("Missing reviewed private scientific annotations.");
      await verifyVisualAnnotations(asset);
    }
    const q = visualQuestion(part.visualAssignment, part, ledger);
    rows.push({
      question_number: part.questionNumber,
      parent_question_number: part.parentId.slice(1),
      root_question_number: part.parentId.slice(1),
      marks: part.marks,
      topic_tag: part.topic,
      question_type: "short_answer",
      question_text: q.question_text,
      diagram_config: q.resource,
      options: null,
      correct_answer: JSON.stringify({
        format: "examly_response_v1",
        original_answer: q.key.units
          .map((u) => JSON.stringify(u.rule))
          .join("\n"),
        definition: q.definition,
        key: q.key,
      }),
    });
  }
  return rows;
}
export function visualAssignmentIssue(
  row: any,
  part: VisualPlannedPart,
): string | null {
  try {
    if (!part.visualAssignment) {
      if (row.diagram_config?.kind === "biology_visual")
        throw new Error("Unplanned visual asset.");
      return null;
    }
    const q = visualQuestion(part.visualAssignment, part);
    if (
      row.question_text !== q.question_text ||
      JSON.stringify(parseVisualResource(row.diagram_config)) !==
        JSON.stringify(q.resource)
    )
      throw new Error(
        "Visual wording, immutable asset or overlay changed; invented claims are forbidden.",
      );
    const carrier = JSON.parse(row.correct_answer);
    if (
      JSON.stringify(carrier.definition) !== JSON.stringify(q.definition) ||
      JSON.stringify(carrier.key) !== JSON.stringify(q.key)
    )
      throw new Error("Visual response/private marking contract changed.");
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
