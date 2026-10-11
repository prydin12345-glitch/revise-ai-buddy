import { z } from "zod";
import type { PaperPlan, PlannedPart } from "./paper-contract-types.ts";

export const TEMPLATE_VERSION = 1;
const label = z.string().trim().min(1).max(180);
export const identitySchema = z
  .object({
    country: label,
    educationSystem: label,
    stage: label,
    qualification: label,
    subject: label,
    organisation: label,
    course: label,
    component: label,
    specificationVersion: label,
    tier: z.enum(["foundation", "higher", "not_tiered"]).nullable(),
    institution: label.optional(),
    module: label.optional(),
  })
  .strict();
const partSchema = z
  .object({
    id: label,
    topic: label,
    marks: z.number().int().min(1).max(30),
    response: z.enum(["mcq_single", "short_answer", "long_form"]),
    demand: z.enum(["AO1", "AO2", "AO3"]),
    resource: z.enum(["none", "data_table", "graph", "diagram", "passage"]),
  })
  .strict();
export const templateSchema = z
  .object({
    schemaVersion: z.literal(1),
    identity: identitySchema,
    mode: z.enum(["full_mock", "short_practice", "custom"]),
    marks: z.number().int().min(1).max(300),
    durationMinutes: z.number().int().min(1).max(360),
    topics: z.array(label).min(1).max(80),
    calculator: z.enum(["allowed", "not_allowed", "unknown"]),
    sections: z
      .array(
        z
          .object({
            id: label,
            title: label,
            answerCount: z.number().int().min(1).max(50).optional(),
            groups: z
              .array(
                z
                  .object({
                    id: label,
                    parts: z.array(partSchema).min(1).max(10),
                  })
                  .strict(),
              )
              .min(1)
              .max(50),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    warnings: z.array(z.string().max(500)).max(20),
    designDecisions: z.array(z.string().max(500)).max(20),
  })
  .strict();
export type ProfileTemplate = z.infer<typeof templateSchema>;
export type TemplateIdentity = z.infer<typeof identitySchema>;
export type TemplateOrigin =
  | "catalogue"
  | "source_backed_ai"
  | "model_knowledge_ai"
  | "manual";
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",") +
    "}"
  );
}
export async function checksum(value: string | Uint8Array): Promise<string> {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
/** Counts achievable marks, not every printed alternative. Unsupported formats fail closed. */
export function validateTemplate(raw: unknown) {
  const template = templateSchema.parse(raw),
    ids = new Set<string>(),
    unsupported: string[] = [];
  let effectiveMarks = 0,
    printedMarks = 0,
    parts = 0;
  for (const section of template.sections) {
    if (ids.has(section.id)) throw Error("Duplicate section identity.");
    ids.add(section.id);
    const totals: number[] = [];
    for (const group of section.groups) {
      if (ids.has(group.id)) throw Error("Duplicate group identity.");
      ids.add(group.id);
      let total = 0;
      for (const part of group.parts) {
        if (ids.has(part.id)) throw Error("Duplicate part identity.");
        ids.add(part.id);
        if (!template.topics.includes(part.topic))
          throw Error("A part is outside the saved topic scope.");
        if (part.response === "mcq_single" && part.marks !== 1)
          throw Error("Single-select MCQs require one mark.");
        if (part.resource === "diagram" || part.resource === "passage")
          unsupported.push(
            "Reviewed visual/passage assets need a supported course adapter.",
          );
        total += part.marks;
        parts++;
      }
      totals.push(total);
    }
    const take = section.answerCount ?? totals.length;
    if (take > totals.length)
      throw Error("Selection count exceeds available alternatives.");
    if (take !== totals.length && new Set(totals).size !== 1)
      throw Error("Optional alternatives must offer equal achievable marks.");
    if (take !== totals.length)
      unsupported.push(
        "Optional-group selection needs a reviewed selection/marking adapter.",
      );
    printedMarks += totals.reduce((a, b) => a + b, 0);
    effectiveMarks +=
      take === totals.length
        ? totals.reduce((a, b) => a + b, 0)
        : take * totals[0];
  }
  if (parts > 50)
    throw Error("Saved profiles support at most 50 scored parts.");
  if (effectiveMarks !== template.marks)
    throw Error("Achievable marks do not match the template total.");
  if (template.mode === "full_mock" && template.identity.tier === null)
    unsupported.push("Resolve unknown versus not-tiered before a full mock.");
  return {
    template,
    effectiveMarks,
    printedMarks,
    parts,
    unsupported: [...new Set(unsupported)],
  };
}
export function compileTemplate(raw: unknown): PaperPlan {
  const { template: t, unsupported } = validateTemplate(raw);
  if (unsupported.length) throw Error(unsupported.join(" "));
  let parent = 0;
  const parts: PlannedPart[] = t.sections.flatMap((s) =>
    s.groups.flatMap((g) => {
      parent++;
      return g.parts.map((p, i) => ({
        partId: p.id,
        parentId: String(parent),
        questionNumber:
          g.parts.length === 1
            ? String(parent)
            : `${parent}(${String.fromCharCode(97 + i)})`,
        topic: p.topic,
        marks: p.marks,
        responseType: p.response,
        demand: p.demand,
        resource: p.resource,
        ...(p.resource === "none" ? {} : { resourceId: p.id + "_resource" }),
      }));
    }),
  );
  return {
    courseId: "profile_template:" + t.identity.course,
    paperId: t.identity.component,
    mode: t.mode,
    contractVersion: TEMPLATE_VERSION,
    tier: t.identity.tier,
    parts,
    parentCount: parent,
    partCount: parts.length,
    totalMarks: t.marks,
    durationMinutes: t.durationMinutes,
    label: t.identity.subject + " · " + t.identity.component,
    componentCode: t.identity.component,
    specificationVersion: t.identity.specificationVersion,
  };
}
export const isGenericPlan = (plan?: PaperPlan | null) =>
  !!plan?.courseId.startsWith("profile_template:");
export function templateInstructions(plan: PaperPlan, batch = plan.parts) {
  return `USER-REVIEWED TEMPLATE. Layout is an Examly design, not an official fixed question count. Whole assessment: ${plan.totalMarks} marks, ${plan.durationMinutes} minutes. Write ONLY these parts: ${JSON.stringify(batch)}. Return JSON question rows with exact question_number, root_question_number, parent_question_number, context, separate assessed task, question_text, topic_tag, marks, question_type, private correct_answer. Single-select MCQs need four distinct options and one matching key. Required tables/graphs need consistent chart_data. Never reveal private answers in public resources.`;
}
export interface SavedTemplateContext {
  version: 1;
  template: ProfileTemplate;
  origin: TemplateOrigin;
  evidence: unknown;
  evidenceVersion: string | null;
  presetId: string | null;
  proposalVersion: 1;
  promptVersion: 1;
  resolved_by: "server";
  profileSettingsCanonical: string;
  proposalId?: string;
}
