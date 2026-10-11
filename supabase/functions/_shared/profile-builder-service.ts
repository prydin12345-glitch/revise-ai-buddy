import { z } from "zod";
import { fingerprint } from "./profile-fingerprint.ts";
import {
  approvalCatalogue,
  approvedPreset,
  evaluateApproval,
  profileSettingsCanonical,
} from "./preset-approval.ts";
import {
  canonical,
  checksum,
  compileTemplate,
  identitySchema,
  templateSchema,
  type ProfileTemplate,
  type SavedTemplateContext,
  type TemplateIdentity,
} from "./profile-template.ts";
import {
  validateEvidence,
  validateEvidenceTemplate,
  evidenceFingerprint,
  parseOwnerDocument,
  EXTRACTION_SYSTEM,
  PROPOSAL_SYSTEM,
  type ProfileEvidence,
  evidenceSchema,
} from "./profile-evidence.ts";
import { resolveRegisteredSource } from "./profile-source-registry.ts";
const id = z.string().uuid();
export const builderRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("propose"),
      requestId: id,
      identity: identitySchema,
      mode: z.enum(["full_mock", "short_practice", "custom"]),
      presetId: z.string().max(200).optional(),
      fromProposalId: id.optional(),
      sourceId: z.string().max(150).optional(),
      sourceUrl: z.string().max(2000).optional(),
      upload: z
        .object({
          contentType: z.enum(["application/pdf", "text/plain"]),
          base64: z.string().max(4_000_000),
        })
        .strict()
        .optional(),
      unverified: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      proposalId: id,
      profileName: z.string().trim().min(1).max(120),
      profileId: id.optional(),
      subjectName: z.string().trim().min(1).max(180).optional(),
      template: templateSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("duplicate"),
      requestId: id,
      profileId: id,
      profileName: z.string().trim().min(1).max(120),
    })
    .strict(),
]);
export interface BuilderProposal {
  proposalVersion: 1;
  promptVersion: 1;
  template: ProfileTemplate;
  origin: SavedTemplateContext["origin"];
  evidence: ProfileEvidence | null;
  evidenceVersion: string | null;
  presetId: string | null;
  profileSettings: Record<string, any> | null;
}
export interface BuilderDeps {
  providerReady?: () => void;
  claim: (
    owner: string,
    key: string,
    hash: string,
  ) => Promise<{
    state: "claimed" | "busy" | "complete" | "failed";
    result?: BuilderProposal;
  }>;
  reserve: (owner: string) => Promise<void>;
  beginCall: (owner: string, key: string) => Promise<void>;
  usage: (
    owner: string,
    key: string,
    usage: { promptTokens: number; completionTokens: number; outcome: string },
  ) => Promise<void>;
  finish: (
    owner: string,
    key: string,
    state: "complete" | "failed",
    result: BuilderProposal | null,
  ) => Promise<void>;
  model: (
    system: string,
    payload: unknown,
    budgetMs: number,
  ) => Promise<{
    value: unknown;
    promptTokens: number;
    completionTokens: number;
  }>;
  parsePdf: (b: Uint8Array) => Promise<string[]>;
  loadProposal?: (owner: string, id: string) => Promise<BuilderProposal>;
}
export function templateFromPreset(presetId: string): BuilderProposal {
  const { entry: e, plan, settings } = approvedPreset(presetId);
  return {
    proposalVersion: 1,
    promptVersion: 1,
    origin: "catalogue",
    presetId: e.id,
    evidence: null,
    evidenceVersion: null,
    profileSettings: settings,
    template: {
      schemaVersion: 1,
      identity: {
        country: e.country,
        educationSystem: e.educationSystem,
        stage: "Secondary",
        qualification: e.qualification,
        subject: e.subject,
        organisation: e.organisation,
        course: e.courseCode,
        component: e.component,
        specificationVersion: e.specificationVersion,
        tier: e.tier,
      },
      mode: e.mode,
      marks: plan.totalMarks,
      durationMinutes: plan.durationMinutes,
      topics: settings.topics,
      calculator: "allowed",
      sections: [
        {
          id: "paper",
          title: "Paper",
          groups: [...new Set(plan.parts.map((p) => p.parentId))].map(
            (parentId) => ({
              id: parentId,
              parts: plan.parts
                .filter((p) => p.parentId === parentId)
                .map((p) => ({
                  id: p.partId,
                  topic: p.topic,
                  marks: p.marks,
                  response: p.responseType,
                  demand: p.demand,
                  resource:
                    p.resource === "essay_choice" ? "passage" : p.resource,
                })),
            }),
          ),
        },
      ],
      warnings:
        e.status === "superseded"
          ? [
              "Older approved version; a current recommended version is available.",
            ]
          : [],
      designDecisions: [
        "Uses the existing reviewed Examly adapter; original resource and marking gates remain authoritative.",
      ],
    },
  };
}
function matchPreset(identity: TemplateIdentity, mode: string) {
  const matches = approvalCatalogue().filter(
    (e) =>
      e.mode === mode &&
      canonical(identity) ===
        canonical({
          country: e.country,
          educationSystem: e.educationSystem,
          stage: "Secondary",
          qualification: e.qualification,
          subject: e.subject,
          organisation: e.organisation,
          course: e.courseCode,
          component: e.component,
          specificationVersion: e.specificationVersion,
          tier: e.tier,
        }),
  );
  if (matches.length > 1)
    throw Error("Choose an exact approved preset version.");
  return matches[0]?.id;
}
export async function proposeProfile(
  owner: string,
  input: z.infer<typeof builderRequestSchema>,
  deps: BuilderDeps,
): Promise<BuilderProposal> {
  if (input.action !== "propose") throw Error("Expected a proposal request.");
  const presetId =
    input.presetId ??
    (!input.fromProposalId &&
    !input.sourceId &&
    !input.sourceUrl &&
    !input.upload
      ? matchPreset(input.identity, input.mode)
      : undefined);
  if (presetId) {
    const p = templateFromPreset(presetId);
    if (
      canonical(input.identity) !== canonical(p.template.identity) ||
      input.mode !== p.template.mode
    )
      throw Error(
        "Preset identity differs; choose the exact course/component/tier.",
      );
    const claim = await deps.claim(
      owner,
      input.requestId,
      await checksum(canonical(input)),
    );
    if (claim.state === "complete") return claim.result!;
    if (claim.state !== "claimed")
      throw Error(
        "Request already running or failed; reuse its result or explicitly start a new request.",
      );
    await deps.finish(owner, input.requestId, "complete", p);
    return p;
  }
  if (
    !input.sourceId &&
    !input.sourceUrl &&
    !input.upload &&
    !input.fromProposalId &&
    !input.unverified
  )
    throw Error(
      "Provide registered evidence or a syllabus; alternatively opt in to unverified general practice.",
    );
  if (
    (input.upload &&
      (input.sourceId || input.sourceUrl || input.fromProposalId)) ||
    (input.fromProposalId && (input.sourceId || input.sourceUrl)) ||
    (input.unverified && (input.sourceId || input.sourceUrl || input.upload))
  )
    throw Error("Choose one evidence origin.");
  if (input.unverified && input.mode === "full_mock")
    throw Error(
      "Unverified drafting is general practice, not an authentic full mock.",
    );
  const claim = await deps.claim(
    owner,
    input.requestId,
    await checksum(canonical(input)),
  );
  if (claim.state === "complete") return claim.result!;
  if (claim.state !== "claimed")
    throw Error(
      "Request already running or failed. Repeated requests cannot make another paid call.",
    );
  let evidence: ProfileEvidence | null = null,
    reserved = false,
    calls = 0;
  const started = Date.now();
  const model = async (system: string, payload: unknown) => {
    if (Date.now() - started >= 120000 || calls >= 3)
      throw Error("Builder call/time budget exhausted.");
    deps.providerReady?.();
    if (!reserved) {
      await deps.reserve(owner);
      reserved = true;
    }
    await deps.beginCall(owner, input.requestId);
    calls++;
    let result;
    try {
      result = await deps.model(
        system,
        payload,
        Math.max(1, Math.min(45000, 120000 - (Date.now() - started))),
      );
    } catch (e) {
      await deps.usage(owner, input.requestId, {
        promptTokens: 0,
        completionTokens: 0,
        outcome: "unknown_provider_cost",
      });
      throw e;
    }
    await deps.usage(owner, input.requestId, {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      outcome: "provider_success",
    });
    return result.value;
  };
  try {
    if (input.fromProposalId) {
      if (!deps.loadProposal) throw Error("Saved evidence lookup unavailable.");
      const p = await deps.loadProposal(owner, input.fromProposalId);
      if (
        p.origin === "catalogue" ||
        canonical(p.template.identity) !== canonical(input.identity) ||
        input.unverified !== (p.origin === "model_knowledge_ai")
      )
        throw Error("Saved proposal context differs from this request.");
      evidence = p.evidence ? validateEvidence(p.evidence) : null;
    }
    if (input.sourceId || input.sourceUrl) {
      evidence = resolveRegisteredSource(input.sourceId, input.sourceUrl);
      if (canonical(evidence.identity) !== canonical(input.identity))
        throw Error(
          "Select the source's exact course/component/version; ambiguous Biology A/B cannot be guessed.",
        );
    }
    if (input.upload) {
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.upload.base64))
        throw Error("Invalid document encoding.");
      const bytes = Uint8Array.from(atob(input.upload.base64), (c) =>
          c.charCodeAt(0),
        ),
        parsed = await parseOwnerDocument(
          bytes,
          input.upload.contentType,
          deps.parsePdf,
        );
      evidence = validateEvidence(
        await model(EXTRACTION_SYSTEM, {
          schema: z.toJSONSchema(evidenceSchema),
          identity: input.identity,
          checksum: parsed.checksum,
          pages: parsed.pages,
        }),
      );
      if (
        canonical(evidence.identity) !== canonical(input.identity) ||
        evidence.documents.length !== 1 ||
        evidence.documents[0].checksum !== parsed.checksum ||
        evidence.documents[0].authority !== "owner_supplied" ||
        evidence.documents[0].url !== null
      )
        throw Error("Uploaded identity/checksum/authority is invalid.");
      for (const loc of evidence.documents[0].locations) {
        const actual = parsed.pages.find((p) => p.page === loc.page)?.text;
        if (
          !actual ||
          !actual.replace(/\s+/g, " ").includes(loc.text.replace(/\s+/g, " "))
        )
          throw Error("Uploaded evidence location is not in the document.");
      }
    }
    if (
      evidence &&
      input.mode === "full_mock" &&
      (evidence.facts.marks === null ||
        evidence.facts.durationMinutes === null ||
        evidence.facts.tier === null)
    )
      throw Error(
        "Full-mock marks, duration or tier are unknown; review evidence or choose general practice.",
      );
    if (evidence?.conflicts.length)
      throw Error("Resolve conflicting source evidence before drafting.");
    const payload = {
      schema: z.toJSONSchema(templateSchema),
      identity: input.identity,
      mode: input.mode,
      evidence,
      unverified: input.unverified,
      limits: {
        maxParts: 50,
        supportedResources: ["none", "data_table", "graph"],
      },
    };
    let raw = await model(PROPOSAL_SYSTEM, payload),
      template: ProfileTemplate;
    const validate = (v: unknown) => {
      const t = templateSchema.parse(v);
      if (
        canonical(t.identity) !== canonical(input.identity) ||
        t.mode !== input.mode
      )
        throw Error("Draft changed requested identity/mode.");
      compileTemplate(t);
      if (evidence) validateEvidenceTemplate(t, evidence);
      return t;
    };
    try {
      template = validate(raw);
    } catch (e) {
      raw = await model(PROPOSAL_SYSTEM, {
        ...payload,
        invalidDraft: raw,
        validationError: (e as Error).message,
        instruction:
          "One bounded repair. Preserve evidence; never invent missing facts.",
      });
      template = validate(raw);
    }
    const proposal: BuilderProposal = {
      proposalVersion: 1,
      promptVersion: 1,
      template,
      origin: input.unverified ? "model_knowledge_ai" : "source_backed_ai",
      evidence,
      evidenceVersion: evidence ? await evidenceFingerprint(evidence) : null,
      presetId: null,
      profileSettings: null,
    };
    await deps.finish(owner, input.requestId, "complete", proposal);
    return proposal;
  } catch (e) {
    await deps.finish(owner, input.requestId, "failed", null);
    throw e;
  }
}
export function settingsForTemplate(t: ProfileTemplate) {
  const plan = compileTemplate(t),
    mcq = plan.parts.filter((p) => p.responseType === "mcq_single").length;
  return {
    topics: t.topics,
    assessment_tier: t.identity.tier,
    exam_board: t.identity.organisation,
    educational_tier: t.identity.qualification,
    question_count: plan.partCount,
    mcq_count: mcq,
    written_question_count: plan.partCount - mcq,
    time_limit_minutes: t.durationMinutes,
    mcq_options_count: 4,
    question_structure: "mixed",
    parent_question_count: plan.parentCount,
    max_parts_per_question: Math.max(
      ...plan.parts.map(
        (p) => plan.parts.filter((q) => q.parentId === p.parentId).length,
      ),
    ),
    mcq_position: "mixed",
    mark_distribution: {},
    include_extended: false,
    extended_marks: 0,
    difficulty_progression: "ascending",
    calculator_policy: t.calculator === "unknown" ? "allowed" : t.calculator,
    include_graphs: plan.parts.some((p) => p.resource === "graph"),
    include_tables: plan.parts.some((p) => p.resource === "data_table"),
    paper_blueprint: null,
  };
}
/** Only the owned persisted proposal supplies evidence/provenance/approval lineage. */
export function prepareProfileSave(proposal: BuilderProposal, edited: unknown) {
  if (
    proposal.origin === "source_backed_ai" &&
    (!proposal.evidence ||
      proposal.evidenceVersion !==
        fingerprint(canonical(validateEvidence(proposal.evidence))))
  )
    throw Error("Source-backed provenance requires checksum-bound evidence.");
  const t = templateSchema.parse(edited),
    unchanged =
      proposal.origin === "catalogue" &&
      !!proposal.presetId &&
      canonical(t) ===
        canonical(templateFromPreset(proposal.presetId).template);
  let settings: Record<string, any>;
  if (unchanged) {
    const p = approvedPreset(proposal.presetId!);
    settings = {
      ...p.settings,
      exam_board: p.entry.organisation,
      educational_tier:
        p.entry.qualification === "A-level" ? "level3" : "level2",
    };
  } else {
    compileTemplate(t);
    if (proposal.evidence) validateEvidenceTemplate(t, proposal.evidence);
    if (proposal.origin === "model_knowledge_ai" && t.mode === "full_mock")
      throw Error("An unverified profile cannot be an authentic full mock.");
    settings = settingsForTemplate(t);
  }
  const context: SavedTemplateContext = {
    version: 1,
    template: t,
    origin: proposal.origin,
    evidence: proposal.evidence,
    evidenceVersion: proposal.evidenceVersion,
    presetId: proposal.presetId,
    proposalVersion: 1,
    promptVersion: 1,
    resolved_by: "server",
    profileSettingsCanonical: profileSettingsCanonical(settings),
  };
  return {
    settings,
    context,
    approval: evaluateApproval(settings, proposal.presetId),
  };
}
