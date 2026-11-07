/** Resumable, owner-scoped source analysis. Provider work is never replayed implicitly. */
import { z } from "zod";
import {
  canonical,
  checksum,
  identitySchema,
  templateSchema,
  compileTemplate,
  type TemplateIdentity,
  type ProfileTemplate,
} from "./profile-template.ts";
import {
  modelEvidenceSchema,
  validateEvidence,
  validateEvidenceTemplate,
  evidenceFingerprint,
  EXTRACTION_SYSTEM,
  PROPOSAL_SYSTEM,
  type ProfileEvidence,
} from "./profile-evidence.ts";
import type { BuilderProposal } from "./profile-builder-service.ts";
import {
  DOCUMENT_INDEX_VERSION,
  indexDocumentPages,
  type DocumentSelection,
} from "./profile-document-index.ts";
import { assessmentMetadataCourses } from "./profile-assessment-options.ts";
import { getCourseOptions } from "./assessment-tier.ts";
import { biologyPaperOptions } from "./biology-course-packs.ts";
import {
  discoverSourceAssessments,
  normaliseAssessmentAlias,
} from "./profile-assessment-discovery.ts";
import {
  classifySpecificationVersion,
  isSpecificationVersionHint,
  specificationVersionsEquivalent,
} from "./profile-version-context.ts";
import { completeOwnedAssessmentEvidence } from "./profile-evidence-ingestion.ts";
import { resolveCatalogueTier } from "./profile-catalogue-evidence.ts";
import { resolveReviewedAssessmentRules } from "./profile-reviewed-assessment-rules.ts";
import {
  sourceValidationRecord,
  type SourceValidationIssue,
  type SourceValidationRecord,
} from "./profile-builder-diagnostics.ts";

const uuid = z.string().uuid();
const modeSchema = z.enum(["short_practice", "full_mock", "custom"]);
const uploadSchema = z
  .object({
    contentType: z.enum(["application/pdf", "text/plain"]),
    base64: z.string().min(1).max(4_000_000),
  })
  .strict();
export const sourceJobRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("prepare_source"),
      requestId: uuid,
      identity: identitySchema,
      mode: modeSchema,
      uploads: z.array(uploadSchema).min(1).max(3),
    })
    .strict(),
  z.object({ action: z.literal("advance_source"), jobId: uuid }).strict(),
  z.object({ action: z.literal("source_status"), jobId: uuid }).strict(),
  z
    .object({
      action: z.literal("confirm_source"),
      jobId: uuid,
      identity: identitySchema,
      mode: modeSchema,
    })
    .strict(),
]);
export type SourceJobRequest = z.infer<typeof sourceJobRequestSchema>;
export type SourceJobStage =
  | "reading"
  | "identifying"
  | "ready"
  | "drafting"
  | "complete"
  | "needs_details"
  | "failed";
export interface SourceAssessmentChoice {
  id: string;
  label: string;
  kind: "paper" | "unit" | "component" | "assessment";
  componentCode?: string;
}
export interface SourceJobView {
  jobId: string;
  stage: SourceJobStage;
  identity?: TemplateIdentity;
  mode: ProfileTemplate["mode"];
  progress: { completed: number; total: number };
  message: string;
  needs?: string[];
  assessmentChoices?: SourceAssessmentChoice[];
  validationIssues?: SourceValidationIssue[];
  reviewedFacts?: {
    tier?: {
      value: "not_tiered";
      source: "assessment_catalogue";
      courseId: string;
    };
    assessmentInstructions?: {
      rulePackId: string;
      selection: "all_compulsory";
      calculator: "allowed";
      sourceUrls: string[];
    };
  };
  proposalId?: string;
  proposal?: BuilderProposal;
  /** Legacy receipt status can be retrieved but cannot run a new source stage. */
  canAdvance?: boolean;
}
interface SourcePage {
  page: number;
  text: string;
}
interface SourceDocument {
  id: string;
  checksum: string;
  pages: SourcePage[];
}
interface SourceChunk {
  id: string;
  sources: Array<{ documentId: string; pages: SourcePage[] }>;
  characterCount: number;
}
export interface SourceJobData {
  version: 1;
  requestedIdentity: TemplateIdentity;
  identity: TemplateIdentity;
  mode: ProfileTemplate["mode"];
  documents: SourceDocument[];
  chunks: SourceChunk[];
  cursor: number;
  partials: ProfileEvidence[];
  evidence: ProfileEvidence | null;
  needs: string[];
  assessmentChoices?: SourceAssessmentChoice[];
  invalidDraft?: unknown;
  draftError?: string;
  invalidExtraction?: unknown;
  extractionError?: string;
  validationIssues?: SourceValidationRecord[];
  proposal?: BuilderProposal;
  /** Intake has a cheap receipt but no persisted raw file to replay. */
  intakePending?: boolean;
}
export interface SourceJobRecord {
  owner: string;
  id: string;
  stage: SourceJobStage;
  revision: number;
  leaseToken: string | null;
  quotaReserved: boolean;
  callIntents: number;
  activeMs: number;
  data: SourceJobData;
  leaseUntil?: string | null;
  createdAt?: string;
}
type Usage = {
  promptTokens: number;
  completionTokens: number;
  outcome: "provider_success" | "unknown_provider_cost";
};
interface Commit {
  stage: SourceJobStage;
  data: SourceJobData;
  elapsedMs: number;
  proposal?: BuilderProposal;
}
export interface SourceJobStore {
  create(
    owner: string,
    id: string,
    hash: string,
    key: string,
    data: SourceJobData,
    stage: SourceJobStage,
    elapsedMs: number,
  ): Promise<SourceJobRecord>;
  load(owner: string, id: string): Promise<SourceJobRecord | null>;
  cached(owner: string, key: string): Promise<ProfileEvidence | null>;
  acquire(owner: string, id: string): Promise<SourceJobRecord>;
  commit(record: SourceJobRecord, change: Commit): Promise<SourceJobRecord>;
  reserve(record: SourceJobRecord): Promise<void>;
  beginCall(record: SourceJobRecord): Promise<void>;
  finishCall(
    record: SourceJobRecord,
    change: Commit,
    usage: Usage,
  ): Promise<SourceJobRecord>;
}
/** The per-student build limit (3 builds per 10 minutes, 10 per day) refused a new paid call. */
export class SourceQuotaUnavailable extends Error {}
export const SOURCE_QUOTA_MESSAGE =
  "You have reached the build limit (3 new builds every 10 minutes, 10 per day). No AI call was made and nothing was charged. Wait about 10 minutes, then start a fresh build. Your saved profiles are unchanged.";
export const SOURCE_TOTAL_BUDGET_MS = 120_000;
export const SOURCE_READ_CALL_MS = 45_000;
export const SOURCE_DRAFT_CALL_MS = 95_000;
export const SOURCE_DRAFT_MIN_MS = 30_000;
/** Per-call time allowance; 0 means starting a paid call would be pointless. */
export function sourceCallBudgetMs(stage: string, activeMs: number): number {
  const remaining = Math.max(0, SOURCE_TOTAL_BUDGET_MS - activeMs);
  if (stage === "drafting") {
    const budget = Math.min(SOURCE_DRAFT_CALL_MS, remaining);
    return budget >= SOURCE_DRAFT_MIN_MS ? budget : 0;
  }
  return Math.min(SOURCE_READ_CALL_MS, remaining);
}
export interface SourceJobDeps {
  store: SourceJobStore;
  parsePdf(bytes: Uint8Array): Promise<string[]>;
  model(
    system: string,
    payload: unknown,
    timeoutMs: number,
  ): Promise<{
    value: unknown;
    promptTokens: number;
    completionTokens: number;
  }>;
  providerReady?(): void;
}
/** All RPCs are service-role only; handlers must authenticate before constructing this adapter. */
export function createProfileBuilderJobStore(
  rpc: (name: string, args: Record<string, unknown>) => Promise<any>,
): SourceJobStore {
  const args = (r: SourceJobRecord) => ({
    p_owner: r.owner,
    p_request: r.id,
    p_token: r.leaseToken,
    p_revision: r.revision,
  });
  const changeArgs = (c: Commit) => ({
    p_stage: c.stage,
    p_checkpoint: c.data,
    p_elapsed_ms: c.elapsedMs,
    p_proposal: c.proposal ?? null,
  });
  return {
    create: (owner, id, hash, key, data, stage, elapsedMs) =>
      rpc("create_profile_builder_job", {
        p_owner: owner,
        p_request: id,
        p_hash: hash,
        p_source_key: key,
        p_checkpoint: data,
        p_stage: stage,
        p_elapsed_ms: elapsedMs,
      }),
    load: (owner, id) =>
      rpc("read_profile_builder_job", { p_owner: owner, p_request: id }),
    cached: (owner, key) =>
      rpc("cached_profile_builder_source", {
        p_owner: owner,
        p_source_key: key,
      }),
    acquire: (owner, id) =>
      rpc("acquire_profile_builder_job", { p_owner: owner, p_request: id }),
    commit: (r, c) =>
      rpc("commit_profile_builder_job", { ...args(r), ...changeArgs(c) }),
    reserve: async (r) => {
      try {
        await rpc("reserve_profile_builder_job", args(r));
      } catch (error) {
        if ((error as { status?: number })?.status === 429)
          throw new SourceQuotaUnavailable();
        throw error;
      }
    },
    beginCall: async (r) => {
      await rpc("begin_profile_builder_job_call", args(r));
    },
    finishCall: (r, c, usage) =>
      rpc("finish_profile_builder_job_call", {
        ...args(r),
        ...changeArgs(c),
        p_usage: usage,
      }),
  };
}
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const terminal = new Set<SourceJobStage>([
  "complete",
  "failed",
  "needs_details",
]);
export function sourceJobView(r: SourceJobRecord): SourceJobView {
  const messages: Record<SourceJobStage, string> = {
    reading: "Reading your syllabus…",
    identifying: "Finding your assessment rules…",
    ready: "Your assessment is ready to confirm.",
    drafting: "Preparing your profile…",
    complete: "Your profile is ready to review.",
    needs_details: "We need a little more assessment information.",
    failed: "This build stopped safely. Your saved profiles are unchanged.",
  };
  const evidence = r.data.evidence;
  const tier = evidence?.catalogueFacts?.[0];
  const rules = evidence && resolveReviewedAssessmentRules(evidence.identity);
  const hasRules =
    rules &&
    evidence.facts.selection === rules.facts.selection &&
    evidence.facts.calculator === rules.facts.calculator &&
    !evidence.conflicts.length &&
    rules.documents.every((reviewed) =>
      evidence.documents.some(
        (document) =>
          document.id === reviewed.id &&
          document.checksum === reviewed.checksum &&
          document.url === reviewed.url,
      ),
    );
  return {
    jobId: r.id,
    stage: r.stage,
    identity: r.data.identity,
    mode: r.data.mode,
    progress: {
      completed: r.data.cursor + (r.stage === "complete" ? 1 : 0),
      total: r.data.chunks.length + 1,
    },
    message: messages[r.stage],
    canAdvance:
      !r.data.intakePending &&
      ["reading", "identifying", "drafting"].includes(r.stage),
    ...(r.data.needs.length ? { needs: r.data.needs } : {}),
    ...(r.data.validationIssues?.length
      ? {
          validationIssues: r.data.validationIssues.map(
            ({ attempt, stage, code, field, message }) => ({
              attempt,
              stage,
              code,
              ...(field ? { field } : {}),
              message,
            }),
          ),
        }
      : {}),
    ...(tier || hasRules
      ? {
          reviewedFacts: {
            ...(tier
              ? {
                  tier: {
                    value: tier.value,
                    source: tier.source,
                    courseId: tier.courseId,
                  },
                }
              : {}),
            ...(hasRules
              ? {
                  assessmentInstructions: {
                    rulePackId: rules.id,
                    ...rules.facts,
                    sourceUrls: rules.documents
                      .map((document) => document.url!)
                      .filter(Boolean),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(r.stage === "needs_details" && r.data.assessmentChoices?.length
      ? { assessmentChoices: r.data.assessmentChoices }
      : {}),
    ...(r.stage === "complete" && r.data.proposal
      ? { proposalId: r.id, proposal: r.data.proposal }
      : {}),
  };
}
const view = sourceJobView;
async function owned(owner: string, id: string, deps: SourceJobDeps) {
  const r = await deps.store.load(owner, id);
  if (!r || r.owner !== owner)
    throw Error("This profile build was not found in your account.");
  return r;
}
export async function getSourceJob(
  owner: string,
  id: string,
  deps: SourceJobDeps,
  existingRecord?: SourceJobRecord,
) {
  const r = existingRecord ?? (await owned(owner, id, deps));
  if (r.owner !== owner || r.id !== id)
    throw Error("This profile build was not found in your account.");
  const leaseExpired = r.leaseUntil
    ? Date.parse(r.leaseUntil) <= Date.now()
    : r.createdAt && Date.parse(r.createdAt) + 60_000 <= Date.now();
  // A status check can safely close an abandoned, uncharged intake. It never
  // starts parsing/provider work and cannot replay the vanished browser file.
  if (r.data.intakePending && r.stage === "reading" && leaseExpired)
    return advanceSourceJob(owner, id, deps);
  return view(r);
}

function packChunks(chunks: SourceChunk[]): SourceChunk[] {
  // Each extraction call receives complete page-addressed snippets, never the first N characters.
  const out: SourceChunk[] = [];
  for (const c of chunks) {
    const previous = out.at(-1);
    if (previous && previous.characterCount + c.characterCount <= 18_000) {
      for (const source of c.sources) {
        const found = previous.sources.find(
          (s) => s.documentId === source.documentId,
        );
        if (found) found.pages.push(...source.pages);
        else previous.sources.push(structuredClone(source));
      }
      previous.characterCount += c.characterCount;
    } else out.push({ ...c, sources: structuredClone(c.sources) });
  }
  return out;
}

/** Human headings come only from explicit catalogue identity, never a client alias. */
export function trustedDocumentSelection(
  identity: TemplateIdentity,
): DocumentSelection {
  const key = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ""),
    aliases = new Set<string>(),
    excludedCodes = new Set<string>();
  let component = identity.component;
  for (const course of assessmentMetadataCourses(identity)) {
    if (
      ![course.id, course.courseCode].some(
        (value) => key(value) === key(identity.course),
      )
    )
      continue;
    const aliasKey = (value: string) =>
      normaliseAssessmentAlias(value.replace(/_/g, " "));
    const paper = course.papers.find((paper) => {
      const option = paper.requiredOptions?.find((option) =>
        [option.id, option.label].some(
          (value) => aliasKey(value) === aliasKey(identity.module ?? ""),
        ),
      );
      return [
        paper.id,
        paper.componentCode,
        ...paper.aliases,
        ...(option?.componentCodes ?? []),
      ].some((value) => aliasKey(value) === aliasKey(identity.component));
    });
    if (!paper || identity.tier !== "not_tiered") continue;
    const sameVersion =
      isSpecificationVersionHint(identity.specificationVersion) ||
      specificationVersionsEquivalent(
        identity.specificationVersion,
        course.specificationVersion,
      );
    const option = paper.requiredOptions?.find((option) =>
      [option.id, option.label].some(
        (value) => aliasKey(value) === aliasKey(identity.module ?? ""),
      ),
    );
    const exactSection =
      /\//.test(identity.component) &&
      key(identity.component) !== key(paper.componentCode);
    // A numbered heading identifies the selected component, not its edition.
    // A real version constraint is checked against literal source evidence later.
    for (const alias of [paper.label, ...paper.aliases])
      if (
        !exactSection &&
        (sameVersion || /^(?:paper|unit|component)\s*\d+$/i.test(alias))
      )
        aliases.add(alias);
    if (option && sameVersion) {
      aliases.add(option.label);
      for (const code of option.componentCodes ?? []) aliases.add(code);
      if (!exactSection && paper.componentCode === "7408/3")
        aliases.add("7408/3A");
    }
    if (option) {
      for (const other of paper.requiredOptions ?? [])
        if (other.id !== option.id)
          for (const code of other.componentCodes ?? [])
            excludedCodes.add(code);
    }
    // Legacy wrapped names are canonicalised only inside this exact course.
    if (!/\//.test(identity.component)) component = paper.componentCode;
  }
  if (["GB", "UK", "United Kingdom"].includes(identity.country)) {
    const course = getCourseOptions({
      subject: identity.subject,
      examBoard: identity.organisation,
      educationalTier: identity.qualification,
    }).find((course) =>
      [course.id, course.specificationCode].some(
        (value) => value && key(value) === key(identity.course),
      ),
    );
    if (course && identity.tier && course.tiers.includes(identity.tier)) {
      const matches = biologyPaperOptions(course.id).filter(
        (pack) =>
          pack.curriculum.qualification === identity.qualification &&
          pack.tiers.includes(identity.tier!) &&
          [pack.paperId, pack.definition(identity.tier).componentCode].some(
            (value) => value && key(value) === key(identity.component),
          ),
      );
      if (matches.length === 1) {
        const definition = matches[0].definition(identity.tier),
          numbered = definition.displayName.match(
            /\b(?:Paper|Unit|Component)\s+\d+\b.*$/i,
          )?.[0],
          named = definition.displayName.match(
            /\b(?:Breadth|Depth|Unified)\s+(?:in\s+)?biology\b/i,
          )?.[0];
        if (numbered) aliases.add(numbered);
        if (named) aliases.add(named);
        if (numbered)
          aliases.add(numbered.match(/^(?:Paper|Unit|Component)\s+\d+\b/i)![0]);
      }
    }
  }
  return {
    component,
    componentAliases: [...aliases].sort(),
    ...(excludedCodes.size
      ? { excludedComponentCodes: [...excludedCodes].sort() }
      : {}),
    subject: identity.subject,
    course: identity.course,
    qualification: identity.qualification,
  };
}

function requiredModuleProblem(identity: TemplateIdentity): string | null {
  const key = (value: string) =>
    normaliseAssessmentAlias(value.replace(/_/g, " "));
  for (const course of assessmentMetadataCourses(identity)) {
    if (
      ![course.id, course.courseCode].some(
        (value) => key(value) === key(identity.course),
      )
    )
      continue;
    const paper = course.papers.find((paper) =>
      [
        paper.id,
        paper.componentCode,
        ...paper.aliases,
        ...(paper.requiredOptions?.flatMap((option) => [
          ...(option.componentCodes ?? []),
        ]) ?? []),
      ].some((value) => key(value) === key(identity.component)),
    );
    if (!paper?.requiredOptions?.length) return null;
    const option = paper.requiredOptions.find((option) =>
      [option.id, option.label].some(
        (value) => key(value) === key(identity.module ?? ""),
      ),
    );
    if (!option)
      return `Which optional topic do you study for ${paper.label}? Choose it before reading this assessment.`;
    if (
      /\//.test(identity.component) &&
      key(identity.component) !== key(paper.componentCode) &&
      !option.componentCodes?.some(
        (value) => key(value) === key(identity.component),
      )
    )
      return "The selected paper section does not match your optional topic. Choose the matching section or option.";
  }
  return null;
}

function sameSelectedModule(
  identity: TemplateIdentity,
  value: string,
): boolean {
  const key = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, "");
  const previous = identity.module ?? "";
  if (key(previous) === key(value)) return true;
  for (const course of assessmentMetadataCourses(identity)) {
    if (
      ![course.id, course.courseCode].some(
        (course) => key(course) === key(identity.course),
      )
    )
      continue;
    for (const paper of course.papers) {
      const option = paper.requiredOptions?.find((option) =>
        [option.id, option.label].some((alias) => key(alias) === key(previous)),
      );
      if (
        option &&
        [option.id, option.label].some((alias) => key(alias) === key(value))
      )
        return true;
    }
  }
  return false;
}

export async function prepareSourceJob(
  owner: string,
  input: Extract<SourceJobRequest, { action: "prepare_source" }>,
  deps: SourceJobDeps,
): Promise<SourceJobView> {
  const started = Date.now();
  const parsedInput = sourceJobRequestSchema.parse(input) as typeof input;
  const hash = await checksum(canonical(parsedInput));
  const existing = await deps.store.load(owner, input.requestId);
  if (existing) {
    // create verifies the original request hash atomically, including completed requests.
    const same = await deps.store.create(
      owner,
      input.requestId,
      hash,
      "",
      existing.data,
      existing.stage,
      0,
    );
    return view(same);
  }
  let aggregate = 0;
  const documents: SourceDocument[] = [];
  for (let i = 0; i < input.uploads.length; i++) {
    const u = input.uploads[i];
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(u.base64))
      throw Error(
        "This document could not be read. Choose a readable PDF or text file.",
      );
    const bytes = Uint8Array.from(atob(u.base64), (c) => c.charCodeAt(0));
    aggregate += bytes.length;
    if (!bytes.length || bytes.length > 3_000_000 || aggregate > 6_000_000)
      throw Error(
        "Choose up to three documents, no larger than 3 MB each or 6 MB together.",
      );
    const digest = await checksum(bytes);
    if (documents.some((d) => d.checksum === digest))
      throw Error(
        "The same document was selected twice. Choose each source once.",
      );
    if (
      u.contentType === "application/pdf" &&
      new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
    )
      throw Error("Choose a readable PDF or text syllabus.");
    documents.push({ id: `upload-${i + 1}`, checksum: digest, pages: [] });
  }
  const sourceKey = await checksum(
    canonical({
      version: 1,
      indexVersion: DOCUMENT_INDEX_VERSION,
      provenancePolicyVersion: 1,
      catalogueTier: resolveCatalogueTier(input.identity),
      reviewedRules: (() => {
        const rules = resolveReviewedAssessmentRules(input.identity);
        return rules
          ? {
              id: rules.id,
              version: rules.version,
              checksums: rules.documents.map((document) => document.checksum),
            }
          : null;
      })(),
      selection: trustedDocumentSelection(input.identity),
      identity: input.identity,
      documents: documents.map((d, i) => ({
        checksum: d.checksum,
        type: input.uploads[i].contentType,
      })),
    }),
  );
  const data: SourceJobData = {
    version: 1,
    requestedIdentity: input.identity,
    identity: {
      ...input.identity,
      organisation:
        input.identity.organisation.trim().toLowerCase() === "aqa"
          ? "AQA"
          : input.identity.organisation,
      component: trustedDocumentSelection(input.identity).component,
      specificationVersion:
        classifySpecificationVersion(input.identity.specificationVersion)
          .kind === "timeline"
          ? "Not verified"
          : input.identity.specificationVersion,
    },
    mode: input.mode,
    documents,
    chunks: [],
    cursor: 0,
    partials: [],
    evidence: null,
    needs: [],
    intakePending: true,
  };
  // Claim the existing cheap 120/day receipt before any PDF parser/index work.
  // Concurrent prepares then see the same owned intake rather than reparsing.
  const intake = await deps.store.create(
    owner,
    input.requestId,
    hash,
    sourceKey,
    data,
    "reading",
    Math.max(0, Date.now() - started),
  );
  if (!intake.data.intakePending || intake.stage !== "reading")
    return view(intake);
  const leased = await deps.store.acquire(owner, input.requestId);
  if (!leased.leaseToken || leased.stage !== "reading") return view(leased);
  const processingStarted = Date.now();
  try {
    const cached = await deps.store.cached(owner, sourceKey);
    let stage: SourceJobStage = "identifying";
    if (cached) {
      data.evidence = validateEvidence(cached);
      data.identity = data.evidence.identity;
      data.needs = missingRequirements(data);
      stage = data.needs.length ? "needs_details" : "ready";
    } else {
      for (let i = 0; i < input.uploads.length; i++) {
        const u = input.uploads[i],
          bytes = Uint8Array.from(atob(u.base64), (c) => c.charCodeAt(0));
        let pages: string[];
        if (u.contentType === "text/plain")
          pages = [new TextDecoder("utf-8", { fatal: true }).decode(bytes)];
        else if (new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-")
          pages = await deps.parsePdf(bytes.slice());
        else throw Error("Choose a readable PDF or text syllabus.");
        if (
          !pages.length ||
          pages.length > 240 ||
          pages.reduce((n, p) => n + p.length, 0) > 600_000
        )
          throw Error(
            "This document exceeds the supported reading limits. Try the assessment specification or brief instead.",
          );
        if (!pages.some((p) => p.trim()))
          throw Error(
            "This PDF has no readable text. Please choose a text-based syllabus or brief.",
          );
        documents[i].pages = pages.map((text, n) => ({ page: n + 1, text }));
      }
      let componentMissing = false,
        qualificationAmbiguous = false;
      for (const doc of documents) {
        const index = indexDocumentPages(
          doc.pages.map((p) => p.text),
          trustedDocumentSelection(input.identity),
        );
        if (!index.coverage.complete) {
          componentMissing ||=
            /Choose which paper|could not locate this assessment/i.test(
              index.coverage.reason ?? "",
            );
          qualificationAmbiguous ||= /\bAS\b|A-level|qualification/i.test(
            index.coverage.reason ?? "",
          );
          data.needs.push(
            index.coverage.reason ??
              "We could not identify all the pages for this assessment. Add its assessment brief.",
          );
        }
        data.chunks.push(
          ...index.chunks.map((c) => ({
            id: `${doc.id}-${c.id}`,
            sources: [{ documentId: doc.id, pages: c.pages }],
            characterCount: c.characterCount,
          })),
        );
      }
      data.chunks = packChunks(data.chunks);
      if (data.chunks.length > 2)
        data.needs.push(
          "The selected assessment information needs more processing than this build allows. Add a focused assessment brief alongside the specification.",
        );
      if (!data.chunks.length && !data.needs.length)
        data.needs.push(
          "Your documents were read, but no assessment rules could be located. Add the assessment overview or brief.",
        );
      if (componentMissing && !qualificationAmbiguous) {
        const found = await discoverSourceAssessments(
          documents.map((doc) => ({
            id: doc.id,
            checksum: doc.checksum,
            pages: doc.pages.map((page) => page.text),
          })),
          input.identity,
        );
        if (!found.ambiguous && found.candidates.length) {
          data.assessmentChoices = found.candidates
            .filter(
              (candidate) =>
                !requiredModuleProblem({
                  ...input.identity,
                  component: candidate.componentCode ?? candidate.label,
                }),
            )
            .map(({ id, label, kind, componentCode }) => ({
              id,
              label,
              kind,
              ...(componentCode ? { componentCode } : {}),
            }));
          if (data.assessmentChoices.length)
            data.needs = [
              "Which assessment in your source are you preparing for?",
            ];
        }
      }
      data.needs = [...new Set(data.needs)];
      const moduleProblem = requiredModuleProblem(input.identity);
      if (moduleProblem) {
        data.needs = [moduleProblem];
        delete data.assessmentChoices;
      }
      if (data.needs.length) stage = "needs_details";
    }
    // Full pages are parsed and scanned locally, not retained in the job. Only
    // bounded literal retrieval excerpts are needed for source validation/resume.
    data.documents = documents.map((doc) => ({ ...doc, pages: [] }));
    if (new TextEncoder().encode(JSON.stringify(data)).length > 2_200_000)
      throw Error(
        "These sources exceed the supported reading size. Choose the assessment specification and a concise brief.",
      );
    delete data.intakePending;
    const r = await deps.store.commit(leased, {
      stage,
      data,
      elapsedMs: Math.max(0, Date.now() - processingStarted),
    });
    return view(r);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    data.documents = documents.map((doc) => ({ ...doc, pages: [] }));
    data.chunks = [];
    delete data.intakePending;
    data.needs = [
      /password|encrypt/i.test(reason)
        ? "This PDF is protected. Choose an unlocked, text-based syllabus or assessment brief."
        : /no readable|no text|scanned|OCR/i.test(reason)
          ? "This PDF has no readable text. Choose a text-based syllabus or assessment brief."
          : /time|deadline/i.test(reason)
            ? "Reading this document took too long. Choose the assessment specification or a concise brief."
            : /limit|size|too large|too many|exceed/i.test(reason)
              ? "This document exceeds the supported reading limits. Choose the assessment specification or a concise brief."
              : "This document could not be read. Choose a readable PDF or UTF-8 text syllabus.",
    ];
    return view(
      await deps.store.commit(leased, {
        stage: "failed",
        data,
        elapsedMs: Math.max(0, Date.now() - processingStarted),
      }),
    );
  }
}

const identityClaimSchema = z
  .object({
    field: z.enum([
      "course",
      "component",
      "specificationVersion",
      "tier",
      "institution",
      "module",
    ]),
    documentId: z.string(),
    locationId: z.string(),
    quote: z.string().min(1).max(200),
  })
  .strict();
const extractionSchema = z
  .object({
    evidence: modelEvidenceSchema,
    identityClaims: z.array(identityClaimSchema).max(20),
  })
  .strict();
class SourceIdentityConflict extends Error {}
function checkExtracted(
  raw: unknown,
  data: SourceJobData,
  chunk: SourceChunk,
): ProfileEvidence {
  const parsed = extractionSchema.parse(raw),
    uploaded = parsed.evidence;
  const suppliedIds = new Set(chunk.sources.map((s) => s.documentId));
  if (
    uploaded.documents.length !== suppliedIds.size ||
    uploaded.documents.some((d) => !suppliedIds.has(d.id))
  )
    throw Error(
      "Every supplied document must be represented in the assessment evidence.",
    );
  for (const document of uploaded.documents) {
    const doc = data.documents.find((d) => d.id === document.id);
    const suppliedPages = chunk.sources
      .filter((s) => s.documentId === document.id)
      .flatMap((s) => s.pages);
    if (
      !doc ||
      !suppliedPages.length ||
      document.checksum !== doc.checksum ||
      document.authority !== "owner_supplied" ||
      document.url !== null
    )
      throw Error("Source identity or ownership changed during reading.");
    for (const l of document.locations) {
      if (
        !suppliedPages.some(
          (p) => p.page === l.page && norm(p.text).includes(norm(l.text)),
        )
      )
        throw Error(
          "A source reference could not be matched to its supplied page.",
        );
    }
  }
  const batches = data.chunks.length;
  if (
    uploaded.claims.length > Math.floor(60 / batches) ||
    uploaded.documents.some(
      (d) => d.locations.length > Math.floor(40 / batches),
    )
  )
    throw Error("The evidence needs fewer, more precise source references.");
  const e = completeOwnedAssessmentEvidence(uploaded);
  const mutable = new Set([
    "course",
    "component",
    "specificationVersion",
    "tier",
    "institution",
    "module",
  ]);
  const identityKeys = [
    ...new Set([...Object.keys(data.identity), ...Object.keys(e.identity)]),
  ] as Array<keyof TemplateIdentity>;
  for (const key of identityKeys) {
    const previous = data.identity[key],
      next = e.identity[key];
    if (previous === next) continue;
    if (
      key === "tier" &&
      previous === null &&
      next === "not_tiered" &&
      e.catalogueFacts?.length &&
      resolveCatalogueTier(e.identity)
    )
      continue;
    if (next === undefined)
      throw Error("A saved assessment detail was removed during reading.");
    if (!mutable.has(key) || (key === "tier" && previous !== null))
      throw Error(
        "The document describes a different course. Check your assessment choices.",
      );
    const c = parsed.identityClaims.find((claim) => claim.field === key);
    const l =
      c &&
      e.documents
        .find((doc) => doc.id === c.documentId)
        ?.locations.find((loc) => loc.id === c.locationId);
    if (!c || !l || !norm(l.text).includes(norm(c.quote)))
      throw Error(
        "A discovered course detail needs a matching source reference.",
      );
    const identityValue =
      next === "not_tiered"
        ? /untiered|not[ -]tiered|no tiers/i.test(c.quote)
        : typeof next === "string" &&
          norm(c.quote).toLowerCase().includes(norm(next).toLowerCase());
    if (!identityValue)
      throw Error("A discovered course detail does not match its source.");
    if (
      key === "course" &&
      ![
        "",
        "Not verified",
        `${data.requestedIdentity.qualification} ${data.requestedIdentity.subject}`,
      ].includes(String(data.requestedIdentity.course)) &&
      next !== data.requestedIdentity.course
    )
      throw Error(
        "The document's course differs from your selected qualification.",
      );
    if (
      key === "specificationVersion" &&
      !isSpecificationVersionHint(
        data.requestedIdentity.specificationVersion,
      ) &&
      !specificationVersionsEquivalent(
        data.requestedIdentity.specificationVersion,
        String(next),
      )
    )
      throw new SourceIdentityConflict(
        `Your PDF is an older or different edition of this specification (${String(next)}), but Examly checks against ${data.requestedIdentity.specificationVersion}. It is the same course, but details can change between editions, so the build stopped. Upload the current specification from the exam board's website. Your saved profiles are unchanged.`,
      );
    if (
      key === "module" &&
      data.requestedIdentity.module &&
      !sameSelectedModule(data.requestedIdentity, String(next))
    )
      throw new SourceIdentityConflict(
        "The source describes a different optional topic or module. Check the selected option and source.",
      );
    if (key === "component") {
      const requested = data.requestedIdentity.component,
        found = String(next);
      const number = (v: string) =>
        v.match(/(?:paper|unit|component)\s*0*(\d+)\b/i)?.[1] ??
        v.match(/\/0*(\d+)[a-z]?$/i)?.[1];
      const a = number(requested),
        b = number(found);
      if (
        (a && b && Number(a) !== Number(b)) ||
        (/\//.test(requested) &&
          !/^(?:paper|unit)/i.test(requested) &&
          requested.toLowerCase() !== found.toLowerCase())
      )
        throw Error(
          "The document describes a different paper. Check your component choice.",
        );
    }
    if (
      data.partials.length &&
      previous !== data.requestedIdentity[key] &&
      !(
        key === "specificationVersion" &&
        specificationVersionsEquivalent(String(previous), String(next))
      )
    )
      throw Error(
        "The documents disagree about the course version or component.",
      );
  }
  for (const document of e.documents) {
    // Reviewed server documents keep stable references across reading chunks.
    if (document.authority === "official_registered") continue;
    const aliases = new Map(
      document.locations.map((l, i) => [l.id, `${chunk.id}-loc-${i + 1}`]),
    );
    for (const claim of e.claims)
      if (claim.documentId === document.id)
        claim.locationId = aliases.get(claim.locationId)!;
    document.locations.forEach((loc) => (loc.id = aliases.get(loc.id)!));
  }
  return e;
}
function mergeEvidence(
  parts: ProfileEvidence[],
  identity: TemplateIdentity,
): ProfileEvidence {
  const e = structuredClone(parts[0]);
  e.identity = identity;
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    for (const d of p.documents) {
      const existing = e.documents.find((x) => x.id === d.id);
      if (existing) {
        for (const l of d.locations) {
          const collision = existing.locations.find((x) => x.id === l.id);
          if (collision && canonical(collision) !== canonical(l))
            throw Error("Source locations disagree between reading batches.");
          if (!collision) existing.locations.push(l);
        }
      } else e.documents.push(d);
    }
    e.claims.push(
      ...p.claims.filter(
        (c) => !e.claims.some((old) => canonical(old) === canonical(c)),
      ),
    );
    e.unresolved = [...new Set([...e.unresolved, ...p.unresolved])];
    e.conflicts = [...new Set([...e.conflicts, ...p.conflicts])];
    for (const key of Object.keys(p.facts) as Array<
      keyof ProfileEvidence["facts"]
    >) {
      const old = e.facts[key],
        next = p.facts[key];
      if (Array.isArray(old) && Array.isArray(next))
        (e.facts as any)[key] = [...new Set([...old, ...next])];
      else if (old === null || old === "unknown") (e.facts as any)[key] = next;
      else if (
        next !== null &&
        next !== "unknown" &&
        canonical(old) !== canonical(next)
      )
        throw Error(
          "The documents disagree about an assessment rule. Check that they describe the same paper and version.",
        );
    }
  }
  return validateEvidence(e);
}
function missingRequirements(data: SourceJobData): string[] {
  const e = data.evidence!;
  const needs: string[] = [];
  if (!e.facts.topics.length)
    needs.push("Add the syllabus page listing this paper's topics.");
  if (e.identity.tier !== e.facts.tier)
    needs.push(
      "The source must confirm the tier selected for this assessment, or explicitly say it is untiered.",
    );
  if (e.conflicts.length)
    needs.push(
      "The source contains conflicting or unsupported assessment requirements. Review its assessment structure.",
    );
  if (e.facts.selection === "optional")
    needs.push(
      "This assessment uses question choices that need a reviewed Examly adapter.",
    );
  if (data.mode === "full_mock") {
    if (e.facts.marks === null)
      needs.push(
        "Add the paper cover or assessment page showing the total marks.",
      );
    if (e.facts.durationMinutes === null)
      needs.push("Add the assessment page showing the duration.");
    if (e.facts.tier === null)
      needs.push(
        "Add a source confirming the assessment tier, or that it is untiered.",
      );
    if (e.facts.selection === "unknown" || !e.facts.formats.length)
      needs.push(
        "Add the assessment instructions showing question formats and which questions to answer.",
      );
  }
  return needs;
}
export async function confirmSourceJob(
  owner: string,
  id: string,
  choice: { identity: TemplateIdentity; mode: ProfileTemplate["mode"] },
  deps: SourceJobDeps,
): Promise<SourceJobView> {
  const snapshot = await owned(owner, id, deps);
  if (snapshot.stage === "drafting" || snapshot.stage === "complete")
    return view(snapshot);
  if (snapshot.stage !== "ready" || !snapshot.data.evidence)
    throw Error("Read the assessment source before confirming this build.");
  if (
    canonical(choice.identity) !== canonical(snapshot.data.identity) ||
    choice.mode !== snapshot.data.mode
  )
    throw Error(
      "These choices differ from the source you reviewed. Change details and read the source again.",
    );
  const r = await deps.store.acquire(owner, id);
  if (r.stage !== "ready" || !r.leaseToken) return view(r);
  return view(
    await deps.store.commit(r, {
      stage: "drafting",
      data: r.data,
      elapsedMs: 0,
    }),
  );
}
export async function advanceSourceJob(
  owner: string,
  id: string,
  deps: SourceJobDeps,
): Promise<SourceJobView> {
  const snapshot = await owned(owner, id, deps);
  if (terminal.has(snapshot.stage) || snapshot.stage === "ready")
    return view(snapshot);
  const r = await deps.store.acquire(owner, id);
  if (!r.leaseToken || terminal.has(r.stage) || r.stage === "ready")
    return view(r);
  const started = Date.now(),
    data = structuredClone(r.data);
  if (data.intakePending) {
    delete data.intakePending;
    data.needs = [
      "The document upload was interrupted before reading finished. Choose your source again to start a new build. No AI call was made.",
    ];
    return view(
      await deps.store.commit(r, { stage: "failed", data, elapsedMs: 0 }),
    );
  }
  // Reading a chunk is short; drafting a full template (up to 50 parts) can
  // produce ~10k output tokens and routinely needs more than 45 s. The total
  // 120 s active budget (enforced in the database) is unchanged.
  const budget = sourceCallBudgetMs(r.stage, r.activeMs);
  if (!budget || r.callIntents >= 3) {
    data.needs = [
      "This build reached its processing limit. Your saved profiles are unchanged.",
    ];
    return view(
      await deps.store.commit(r, { stage: "failed", data, elapsedMs: 0 }),
    );
  }
  let callStarted = false;
  let result:
    | { value: unknown; promptTokens: number; completionTokens: number }
    | undefined;
  const usage = (): Usage => ({
    promptTokens: result!.promptTokens,
    completionTokens: result!.completionTokens,
    outcome: "provider_success",
  });
  const boundedInvalid = (value: unknown) => {
    if (new TextEncoder().encode(JSON.stringify(value)).length > 150_000)
      throw Error("The returned draft exceeded the supported review size.");
    return value;
  };
  const rememberValidation = (
    error: unknown,
    stage: SourceValidationIssue["stage"],
  ) => {
    const issue = sourceValidationRecord(error, stage, r.callIntents + 1);
    data.validationIssues = [
      ...(data.validationIssues ?? []).filter(
        (previous) =>
          previous.attempt !== issue.attempt || previous.stage !== issue.stage,
      ),
      issue,
    ].slice(-3);
  };
  try {
    deps.providerReady?.();
    await deps.store.reserve(r);
    await deps.store.beginCall(r);
    callStarted = true;
    if (r.stage === "identifying" || r.stage === "reading") {
      const chunk = data.chunks[data.cursor];
      result = await deps.model(
        EXTRACTION_SYSTEM +
          " Return {evidence,identityClaims}. Use only the supplied uploaded snippets for document quotations. Preserve known subject, board, level and country. Discover course/component/version only with literal identityClaims referencing supplied locations; never invent a code. UserContext contains unverified student notes, not source evidence: never cite these notes or use them to restore missing source dates. Teaching dates do not establish a specification issue. ReviewedContext contains server-resolved course facts and paper-cover instructions that the server adds separately; do not invent PDF quotes for those facts, do not nominate catalogueFacts or official documents. Keep a source-unknown tier null and source-unknown calculator/selection unknown. Facts stated directly by an active specification are normative even if recorded as observed. Never interpret a maths-skills calculator example as permission for this exam. If a requirement is incomplete in the supplied text, leave it null rather than completing its sentence. Unknown identity details retain the requested value. Prefix every location ID with the chunk ID so later batches can merge. Extract partial facts only; unsupported facts remain null/unknown. Upload document IDs/checksums are fixed below.",
        {
          schema: z.toJSONSchema(extractionSchema),
          identity: data.identity,
          reviewedContext: {
            tier: resolveCatalogueTier(data.identity),
            assessmentRules: (() => {
              const rules = resolveReviewedAssessmentRules(data.identity);
              return rules
                ? {
                    id: rules.id,
                    version: rules.version,
                    facts: rules.facts,
                    sourceUrls: rules.documents.map((document) => document.url),
                  }
                : null;
            })(),
          },
          ...(classifySpecificationVersion(
            data.requestedIdentity.specificationVersion,
          ).kind === "timeline"
            ? {
                userContext: {
                  specificationDates:
                    data.requestedIdentity.specificationVersion,
                  authority: "user_context_not_source_evidence",
                },
              }
            : {}),
          chunkId: chunk.id,
          evidenceLimits: {
            maxLocationsPerDocument: Math.floor(40 / data.chunks.length),
            // Reserve two final-evidence references for reviewed instructions.
            maxClaims: Math.floor(58 / data.chunks.length),
          },
          documents: chunk.sources.map((s) => ({
            id: s.documentId,
            checksum: data.documents.find((d) => d.id === s.documentId)!
              .checksum,
            authority: "owner_supplied",
            url: null,
            pages: s.pages,
          })),
          ...(data.invalidExtraction !== undefined
            ? {
                invalidExtraction: data.invalidExtraction,
                validationError: data.extractionError,
                instruction:
                  "One bounded evidence repair. Use exact supplied page text and preserve all known identity and authority.",
              }
            : {}),
        },
        budget,
      );
      let evidence: ProfileEvidence;
      try {
        evidence = checkExtracted(result.value, data, chunk);
      } catch (error) {
        rememberValidation(error, "extraction");
        if (error instanceof SourceIdentityConflict) throw error;
        if (
          data.chunks.length === 1 &&
          r.callIntents === 0 &&
          data.invalidExtraction === undefined
        ) {
          data.invalidExtraction = boundedInvalid(result.value);
          data.extractionError = (error as Error).message.slice(0, 500);
          return view(
            await deps.store.finishCall(
              r,
              { stage: "identifying", data, elapsedMs: Date.now() - started },
              usage(),
            ),
          );
        }
        throw error;
      }
      delete data.invalidExtraction;
      delete data.extractionError;
      data.identity = evidence.identity;
      data.partials.push(evidence);
      data.cursor++;
      let stage: SourceJobStage = "identifying";
      if (data.cursor === data.chunks.length) {
        data.evidence = mergeEvidence(data.partials, data.identity);
        data.needs = missingRequirements(data);
        stage = data.needs.length ? "needs_details" : "ready";
      }
      return view(
        await deps.store.finishCall(
          r,
          { stage, data, elapsedMs: Date.now() - started },
          usage(),
        ),
      );
    }
    if (r.stage !== "drafting" || !data.evidence)
      throw Error("The source is not ready for drafting.");
    result = await deps.model(
      PROPOSAL_SYSTEM,
      {
        schema: z.toJSONSchema(templateSchema),
        identity: data.identity,
        mode: data.mode,
        evidence: data.evidence,
        limits: {
          maxParts: 50,
          supportedResources: ["none", "data_table", "graph"],
        },
        ...(data.invalidDraft !== undefined
          ? {
              invalidDraft: data.invalidDraft,
              validationError: data.draftError,
              instruction:
                "One bounded repair. Preserve the confirmed identity and evidence.",
            }
          : {}),
      },
      budget,
    );
    let template: ProfileTemplate;
    try {
      template = templateSchema.parse(result.value);
      if (
        canonical(template.identity) !== canonical(data.identity) ||
        template.mode !== data.mode
      )
        throw Error("The draft changed the assessment you confirmed.");
      compileTemplate(template);
      validateEvidenceTemplate(template, data.evidence);
    } catch (error) {
      rememberValidation(error, "draft");
      if (r.callIntents + 1 < 3 && data.invalidDraft === undefined) {
        data.invalidDraft = boundedInvalid(result.value);
        data.draftError = (error as Error).message.slice(0, 500);
        return view(
          await deps.store.finishCall(
            r,
            { stage: "drafting", data, elapsedMs: Date.now() - started },
            usage(),
          ),
        );
      }
      throw error;
    }
    const proposal: BuilderProposal = {
      proposalVersion: 1,
      promptVersion: 1,
      origin: "source_backed_ai",
      template,
      evidence: data.evidence,
      evidenceVersion: await evidenceFingerprint(data.evidence),
      presetId: null,
      profileSettings: null,
    };
    data.proposal = proposal;
    return view(
      await deps.store.finishCall(
        r,
        { stage: "complete", data, elapsedMs: Date.now() - started, proposal },
        usage(),
      ),
    );
  } catch (error) {
    if (
      result &&
      !data.validationIssues?.some(
        (issue) => issue.attempt === r.callIntents + 1,
      )
    )
      rememberValidation(
        error,
        r.stage === "drafting" ? "draft" : "extraction",
      );
    data.needs = [
      error instanceof SourceIdentityConflict
        ? error.message
        : error instanceof SourceQuotaUnavailable
          ? SOURCE_QUOTA_MESSAGE
          : result
          ? (data.validationIssues?.at(-1)?.message ??
            "We could not verify the assessment details returned from this source.")
          : callStarted
            ? "The source service could not finish. This request will not repeat a possibly charged call. Your saved profiles are unchanged."
            : "The AI service is unavailable. Your saved profiles are unchanged.",
    ];
    const change: Commit = {
      stage:
        error instanceof SourceIdentityConflict ? "needs_details" : "failed",
      data,
      elapsedMs: Date.now() - started,
    };
    const failed = callStarted
      ? await deps.store.finishCall(
          r,
          change,
          result
            ? {
                promptTokens: result.promptTokens,
                completionTokens: result.completionTokens,
                outcome: "provider_success",
              }
            : {
                promptTokens: 0,
                completionTokens: 0,
                outcome: "unknown_provider_cost",
              },
        )
      : await deps.store.commit(r, change);
    return view(failed);
  }
}
