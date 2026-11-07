import { useEffect, useRef, useState } from "react";
import { useBuilderAttachments } from "@/hooks/useBuilderAttachments";
import { BuilderAttachments } from "./BuilderAttachments";
import { BuilderEvidenceDetails } from "./BuilderEvidenceDetails";
import type { AssessmentDiscoveryResult } from "../../../supabase/functions/_shared/profile-assessment-discovery";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  CheckCircle2,
  Clock3,
  BookOpen,
  FileText,
  Pencil,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  invokeProfileBuilder,
  type BuilderApi,
  type SourceJobView,
  readPendingBuilderJob,
  rememberPendingBuilderJob,
  clearPendingBuilderJob,
} from "@/lib/profile-builder-client";
import {
  approvalCatalogue,
  type ApprovalResult,
} from "../../../supabase/functions/_shared/preset-approval";
import {
  canonical,
  identitySchema,
  templateSchema,
  type ProfileTemplate,
  type TemplateIdentity,
  type SavedTemplateContext,
} from "../../../supabase/functions/_shared/profile-template";
import {
  prepareProfileSave,
  templateFromPreset,
  type BuilderProposal,
} from "../../../supabase/functions/_shared/profile-builder-service";
import { compareEvidenceVersions } from "../../../supabase/functions/_shared/profile-evidence";
import {
  SOURCE_REGISTRY as PROFILE_SOURCE_REGISTRY,
  resolveRegisteredSource,
} from "../../../supabase/functions/_shared/profile-source-registry";
import { ExamlyApprovalBadge } from "./ExamlyApprovalBadge";
import {
  builderInitialIdentity,
  builderCourses,
  builderSelectedCourse,
  builderPapers,
  builderNeedsTier,
  resolveBuilderChoice,
  builderAssessmentLabel,
  BUILDER_BOARDS,
  builderFindAssessment,
  builderAssessmentKind,
  builderBoardLabel,
  builderValidateComponentCode,
} from "@/lib/profile-builder-resolution";
import { ALL_LEVELS } from "@/lib/educational-levels";
import { classifySpecificationVersion } from "../../../supabase/functions/_shared/profile-version-context";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  subjectName: string;
  examBoard?: string | null;
  educationalLevel?: string | null;
  onManual: () => void;
  curriculumRegion?: string | null;
  courseId?: string | null;
  paperId?: string | null;
  assessmentTier?: string | null;
  initialMode?: ProfileTemplate["mode"];
  accountId?: string | null;
  initialProfile?: {
    id?: string;
    profile_name: string;
    profile_template?: unknown;
  };
  /** Explicit dependency injection for controlled tests; no browser-global bypass. */
  api?: BuilderApi;
}
const fieldClass =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
const uuid = () => crypto.randomUUID();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const proposalFromContext = (ctx: SavedTemplateContext): BuilderProposal => ({
  proposalVersion: 1,
  promptVersion: 1,
  template: ctx.template,
  origin: ctx.origin,
  evidence: ctx.evidence as BuilderProposal["evidence"],
  evidenceVersion: ctx.evidenceVersion,
  presetId: ctx.presetId,
  profileSettings: null,
});

export function ExamProfileBuilder({
  open,
  onOpenChange,
  subjectName,
  examBoard,
  educationalLevel,
  curriculumRegion,
  courseId,
  paperId,
  assessmentTier,
  initialMode,
  accountId,
  onManual,
  initialProfile,
  api = invokeProfileBuilder,
}: Props) {
  const catalogue = approvalCatalogue();
  const [step, setStep] = useState<"details" | "confirm" | "review">("details");
  const [identity, setIdentity] = useState<TemplateIdentity>(() =>
    builderInitialIdentity({
      subject: subjectName,
      board: examBoard,
      level: educationalLevel,
      region: curriculumRegion,
      courseId,
      paperId,
      tier: assessmentTier,
    }),
  );
  const [mode, setMode] = useState<ProfileTemplate["mode"]>("short_practice");
  const [changeKnown, setChangeKnown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [presetId, setPresetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceChoice, setSourceChoice] = useState<
    "source" | "upload" | "unverified"
  >("source");
  const attachments = useBuilderAttachments({ accountId, subjectName });
  const uploads = attachments.files.map(({ contentType, base64 }) => ({
    contentType,
    base64,
  }));
  const attachmentIds = attachments.files.map((file) => file.id).join(":");
  const [discovery, setDiscovery] = useState<AssessmentDiscoveryResult | null>(
    null,
  );
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [assessmentName, setAssessmentName] = useState("");
  const [manualAssessment, setManualAssessment] = useState(false);
  const [componentCode, setComponentCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [sourceJob, setSourceJob] = useState<SourceJobView | null>(null);
  const clarificationPanel = useRef<HTMLDivElement>(null);
  const builderBody = useRef<HTMLDivElement>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const sourceRequest = useRef<{ payload: string; id: string } | null>(null);
  const [proposal, setProposal] = useState<BuilderProposal | null>(null);
  const [proposalId, setProposalId] = useState("");
  const [template, setTemplate] = useState<ProfileTemplate | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const panel = clarificationPanel.current,
      body = builderBody.current;
    if (
      !open ||
      busy ||
      !(
        sourceJob?.stage === "needs_details" ||
        (sourceJob?.stage === "failed" && sourceJob.validationIssues?.length)
      ) ||
      !panel ||
      !body
    )
      return;
    panel.focus({ preventScroll: true });
    const padding =
      Number.parseFloat(window.getComputedStyle(body).paddingTop) || 0;
    body.scrollTo?.({
      top: Math.max(
        0,
        body.scrollTop +
          panel.getBoundingClientRect().top -
          body.getBoundingClientRect().top -
          padding,
      ),
      behavior: "auto",
    });
  }, [
    open,
    busy,
    sourceJob?.jobId,
    sourceJob?.stage,
    sourceJob?.validationIssues?.length,
  ]);
  const previousAccount = useRef(accountId);
  const run = useRef(0),
    request = useRef<{ payload: string; id: string } | null>(null),
    duplicateId = useRef<string | null>(null);
  useEffect(() => {
    run.current++;
    setBusy(false);
    setError("");
    setNotice("");
    setEditing(false);
    setSourceJob(null);
    setPendingJobId(null);
    sourceRequest.current = null;
    request.current = null;
    duplicateId.current = null;
    if (previousAccount.current !== accountId) {
      previousAccount.current = accountId;
      setProposal(null);
      setProposalId("");
      setTemplate(null);
      setName("");
      setAssessmentId("");
      setAssessmentName("");
      setComponentCode("");
      setManualAssessment(false);
      setSourceId("");
      setPresetId("");
      setIdentity(builderInitialIdentity({ subject: subjectName }));
      setStep("details");
      onOpenChange(false);
      return;
    }
    if (!open) return;
    setSourceId("");
    const ctx = initialProfile?.profile_template as
      | SavedTemplateContext
      | undefined;
    if (ctx?.version === 1 && ctx.resolved_by === "server") {
      setProposal(proposalFromContext(ctx));
      setProposalId(ctx.proposalId ?? "");
      setTemplate(clone(ctx.template));
      setIdentity(ctx.template.identity);
      const selected = builderFindAssessment(
        ctx.template.identity,
        ctx.template.identity.component,
      );
      setAssessmentId(selected?.id ?? "");
      setAssessmentName(selected?.label ?? ctx.template.identity.component);
      setComponentCode(selected?.componentCode ?? "");
      setCodeEdited(false);
      setManualAssessment(!selected);
      setMode(ctx.template.mode);
      setPresetId(ctx.presetId ?? "");
      setName(initialProfile!.profile_name);
      setStep("review");
    } else {
      setIdentity(
        builderInitialIdentity({
          subject: subjectName,
          board: examBoard,
          level: educationalLevel,
          region: curriculumRegion,
          courseId,
          paperId,
          tier: assessmentTier,
        }),
      );
      setMode(initialMode === "full_mock" ? "full_mock" : "short_practice");
      setChangeKnown(false);
      setPresetId("");
      setProposal(null);
      setProposalId("");
      setTemplate(null);
      setName(initialProfile?.profile_name ?? "");
      const seed = builderInitialIdentity({
        subject: subjectName,
        board: examBoard,
        level: educationalLevel,
        region: curriculumRegion,
        courseId,
        paperId,
        tier: assessmentTier,
      });
      const selected = builderFindAssessment(seed, seed.component);
      setAssessmentId(selected?.id ?? "");
      setAssessmentName(selected?.label ?? seed.component);
      setComponentCode(selected?.componentCode ?? "");
      setCodeEdited(false);
      setManualAssessment(!!seed.component && !selected);
      try {
        const resolved = resolveBuilderChoice(
          seed,
          initialMode === "full_mock" ? "full_mock" : "short_practice",
        );
        setIdentity(resolved.identity);
        setPresetId(resolved.presetId);
        setSourceId(resolved.sourceId);
        setStep(resolved.presetId || resolved.sourceId ? "confirm" : "details");
      } catch {
        setStep("details");
      }
    }
    // Preserve source identity resolved from saved selections.
    if (ctx?.version === 1 && ctx.resolved_by === "server") setSourceId("");
    setSourceUrl("");

    setSourceChoice("source");
    return () => {
      run.current++;
    };
  }, [
    open,
    initialProfile,
    subjectName,
    examBoard,
    educationalLevel,
    curriculumRegion,
    courseId,
    paperId,
    assessmentTier,
    initialMode,
    accountId,
  ]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const generation = run.current;
    void readPendingBuilderJob(subjectName)
      .then((pending) => {
        if (!cancelled && generation === run.current)
          setPendingJobId(pending?.jobId ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, subjectName, accountId]);
  useEffect(() => {
    if (sourceJob?.stage === "ready" || sourceJob?.stage === "complete") return;
    if (!open || !attachments.files.length) {
      setDiscovery(null);
      setDiscoveryBusy(false);
      setDiscoveryError("");
      return;
    }
    let cancelled = false;
    const files = attachments.files;
    const recheck = files.some((file) => file.status === "needs_recheck");
    setDiscoveryBusy(true);
    setDiscoveryError("");
    attachments.setStatus("reading");
    void import("@/lib/inspect-profile-attachments")
      .then(({ inspectProfileAttachments }) =>
        inspectProfileAttachments(files, {
          country: identity.country,
          qualification: identity.qualification,
          organisation: identity.organisation,
          subject: subjectName,
          course:
            builderSelectedCourse(identity)?.specificationCode ??
            identity.course,
        }),
      )
      .then((result) => {
        if (cancelled) return;
        setDiscovery(result);
        attachments.setStatus(recheck ? "needs_recheck" : "attached");
      })
      .catch((error) => {
        if (cancelled) return;
        setDiscovery(null);
        setDiscoveryError(
          error instanceof Error
            ? error.message
            : "Could not read assessment names. Your files are still attached.",
        );
        attachments.setStatus("error");
      })
      .finally(() => {
        if (!cancelled) setDiscoveryBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // File bytes are immutable; status-only updates must not repeat parsing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    accountId,
    subjectName,
    attachmentIds,
    identity.country,
    identity.qualification,
    identity.organisation,
    identity.course,
  ]);
  const close = () => {
    run.current++;
    onOpenChange(false);
  };
  const invalidatePreview = () => {
    run.current++;
    setBusy(false);
    setProposal(null);
    setProposalId("");
    setTemplate(null);
    setEditing(false);
    setNotice("");
    attachments.markForRecheck();
    setSourceJob(null);
    if (pendingJobId)
      void clearPendingBuilderJob(subjectName, pendingJobId).catch(() => {});
    setPendingJobId(null);
    sourceRequest.current = null;
  };
  const changeIdentity = (
    key: keyof TemplateIdentity,
    value: string | null,
  ) => {
    setError("");
    setSourceId("");
    invalidatePreview();
    if (["organisation", "qualification", "country", "course"].includes(key)) {
      setAssessmentId("");
      setAssessmentName("");
      setComponentCode("");
      setCodeEdited(false);
      setManualAssessment(false);
    }
    setIdentity((v) => {
      const oldPaper = builderFindAssessment(v, v.component);
      const next = { ...v, [key]: value };
      if (key === "tier" && oldPaper) next.component = oldPaper.id;
      if (["organisation", "qualification", "country"].includes(key)) {
        next.course = "";
        next.component = "";
        next.specificationVersion = "";
        next.tier = null;
      }
      if (key === "qualification") {
        const level = ALL_LEVELS.find(
          (l) =>
            l.id === value ||
            l.label === value ||
            Object.values(l.aliases).includes(value ?? ""),
        );
        next.stage =
          level && ["undergrad", "postgrad", "doctoral"].includes(level.id)
            ? "University"
            : level && !level.id.startsWith("level")
              ? "Other"
              : "Secondary";
        if (
          next.stage === "University" &&
          (BUILDER_BOARDS.some(
            (board) => board.toLowerCase() === next.organisation.toLowerCase(),
          ) ||
            next.organisation.toLowerCase() === "edexcel")
        )
          next.organisation = "";
      }
      if (key === "country") next.educationSystem = value || "";
      if (key === "course") {
        next.component = "";
        next.specificationVersion = "";
        next.tier = null;
      }
      if (
        builderSelectedCourse(next)?.tierMode === "untiered" ||
        next.qualification === "A-level"
      )
        next.tier = "not_tiered";
      if ((key === "institution" || key === "module") && !value)
        delete next[key];
      return next;
    });
    setPresetId("");
  };
  const choosePreset = (id: string) => {
    invalidatePreview();
    setPresetId(id);
    setError("");
    if (!id) return;
    const p = templateFromPreset(id);
    setIdentity(p.template.identity);
    const selected = builderFindAssessment(
      p.template.identity,
      p.template.identity.component,
    );
    setAssessmentId(selected?.id ?? "");
    setAssessmentName(selected?.label ?? p.template.identity.component);
    setComponentCode(selected?.componentCode ?? "");
    setCodeEdited(false);
    setManualAssessment(!selected);
    setMode(p.template.mode);
    setSourceId("");
    setSourceUrl("");

    setSourceChoice("source");
    if (!name.trim())
      setName(
        p.template.identity.subject + " · " + p.template.identity.component,
      );
  };
  const chooseSource = (id: string) => {
    invalidatePreview();
    setSourceId(id);
    setSourceChoice("source");
    setSourceUrl("");
    setPresetId("");

    setError("");
    if (id) {
      const e = resolveRegisteredSource(id);
      setIdentity(e.identity);
      const selected = builderFindAssessment(e.identity, e.identity.component);
      setAssessmentId(selected?.id ?? "");
      setAssessmentName(selected?.label ?? e.identity.component);
      setComponentCode(selected?.componentCode ?? "");
      setCodeEdited(false);
      setManualAssessment(!selected);
    }
  };
  const readUpload = async (files?: FileList | File[]) => {
    const changed = await attachments.selectFiles(files);
    if (!changed) return;
    invalidatePreview();
    setSourceChoice("upload");
    setSourceId("");
    setSourceUrl("");
    setError("");
  };
  const removeAttachment = (id: string) => {
    if (sourceChoice === "upload" && step !== "review") {
      invalidatePreview();
      setStep("details");
    }
    attachments.remove(id);
  };
  const clearAttachments = () => {
    if (sourceChoice === "upload" && step !== "review") {
      invalidatePreview();
      setStep("details");
    }
    attachments.clear();
  };
  const acceptJob = (job: SourceJobView) => {
    setSourceJob(job);
    setPendingJobId(job.jobId);
    setMode(job.mode);
    if (job.stage === "ready" && job.identity) {
      attachments.setStatus("checked");
      setIdentity(job.identity);
      setStep("confirm");
    }
    if (job.stage === "complete" && job.proposal && job.proposalId) {
      const next = templateSchema.parse(job.proposal.template);
      prepareProfileSave(job.proposal, next);
      setProposal(job.proposal);
      setProposalId(job.proposalId);
      setTemplate(clone(next));
      setIdentity(next.identity);
      setStep("review");
      setEditing(false);
      setName((previous) =>
        previous.trim() ? previous : builderAssessmentLabel(next.identity),
      );
    }
    if (job.stage === "failed" || job.stage === "needs_details")
      attachments.setStatus("error");
    if (job.stage === "failed") setError(job.message);
  };
  const advanceJob = async (job: SourceJobView, generation: number) => {
    let current = job;
    for (let count = 0; count < 6; count++) {
      if (generation !== run.current) return;
      acceptJob(current);
      if (
        current.canAdvance === false ||
        !["reading", "identifying", "drafting"].includes(current.stage)
      )
        return;
      const response = await api({
        action: "advance_source",
        jobId: current.jobId,
      });
      if (generation !== run.current) return;
      if (!response.job)
        throw Error(
          "We could not retrieve the source-processing status. Use Resume to check the same request.",
        );
      current = response.job;
    }
    acceptJob(current);
    if (["reading", "identifying", "drafting"].includes(current.stage))
      setNotice(
        "Your source is still processing. Continue this request when you are ready.",
      );
  };
  const prepareSource = async (resolvedIdentity: TemplateIdentity) => {
    const payload = {
      action: "prepare_source",
      identity: resolvedIdentity,
      mode,
      uploads,
    };
    const signature = canonical(payload);
    if (!sourceRequest.current || sourceRequest.current.payload !== signature)
      sourceRequest.current = { payload: signature, id: uuid() };
    const jobId = sourceRequest.current.id;
    const generation = ++run.current;
    setBusy(true);
    setError("");
    setNotice("Reading your syllabus…");
    attachments.setStatus("reading");
    setPendingJobId(jobId);
    await rememberPendingBuilderJob(subjectName, jobId).catch(() => {});
    if (generation !== run.current) return;
    try {
      const response = await api({ ...payload, requestId: jobId });
      if (generation !== run.current) return;
      if (!response.job)
        throw Error(
          "We could not retrieve the source-processing status. Use Resume to check the same request.",
        );
      setNotice("");
      await advanceJob(response.job, generation);
    } catch (e) {
      if (generation === run.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not read this syllabus. Resume the same request to check its status.",
        );
    } finally {
      if (generation === run.current) setBusy(false);
    }
  };
  const resumeSource = async (advance = false) => {
    const jobId = sourceJob?.jobId ?? pendingJobId;
    if (!jobId) return;
    const generation = ++run.current;
    setBusy(true);
    setError("");
    try {
      const response = await api({ action: "source_status", jobId });
      if (generation !== run.current) return;
      if (!response.job)
        throw Error("No source-processing status was returned.");
      acceptJob(response.job);
      if (advance && response.job.canAdvance !== false)
        await advanceJob(response.job, generation);
    } catch (e) {
      if (generation === run.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not check this request. Try Resume again.",
        );
    } finally {
      if (generation === run.current) setBusy(false);
    }
  };
  const confirmSource = async () => {
    if (!sourceJob?.identity || sourceJob.stage !== "ready") return;
    const generation = ++run.current;
    setBusy(true);
    setError("");
    try {
      const response = await api({
        action: "confirm_source",
        jobId: sourceJob.jobId,
        identity: sourceJob.identity,
        mode: sourceJob.mode,
      });
      if (generation !== run.current) return;
      if (!response.job)
        throw Error(
          "We could not confirm this source. Resume the same request to check its status.",
        );
      await advanceJob(response.job, generation);
    } catch (e) {
      if (generation === run.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not build this profile. Your saved profiles are unchanged.",
        );
    } finally {
      if (generation === run.current) setBusy(false);
    }
  };
  const build = async (regenerate = false, useCurrentSource = false) => {
    setError("");
    setNotice("");
    let parsedIdentity: TemplateIdentity;
    try {
      parsedIdentity = identitySchema.parse(identity);
    } catch {
      setError(
        "Check the course choices. Technical details can be reviewed in Advanced details.",
      );
      return;
    }
    const payload: Record<string, unknown> = {
      action: "propose",
      identity: parsedIdentity,
      mode,
    };
    if (regenerate && proposalId && !useCurrentSource) {
      payload.fromProposalId = proposalId;
      payload.unverified = proposal?.origin === "model_knowledge_ai";
    } else if (presetId) payload.presetId = presetId;
    else if (sourceChoice === "unverified") payload.unverified = true;
    else if (sourceChoice === "upload") {
      if (!uploads.length) {
        setError("Choose a syllabus document first.");
        return;
      }
      setStep("details");
      setError(
        "Your attached files need to be checked before building. Choose Read syllabus to continue.",
      );
      return;
    } else if (sourceId) payload.sourceId = sourceId;
    else if (sourceUrl.trim()) payload.sourceUrl = sourceUrl.trim();
    else {
      setError(
        "Choose a registered source, upload a syllabus, or explicitly choose general practice.",
      );
      return;
    }
    const signature = canonical(payload);
    if (regenerate || !request.current || request.current.payload !== signature)
      request.current = { payload: signature, id: uuid() };
    payload.requestId = request.current.id;
    const generation = ++run.current;
    setBusy(true);
    setSourceJob(null);
    if (presetId && !regenerate) {
      const local = templateFromPreset(presetId);
      setProposal(local);
      setTemplate(clone(local.template));
      setProposalId("");
      setStep("review");
      if (!name.trim())
        setName(builderAssessmentLabel(local.template.identity));
    }
    const pendingId = request.current.id;
    setPendingJobId(pendingId);
    await rememberPendingBuilderJob(subjectName, pendingId).catch(() => {});
    if (generation !== run.current) return;
    try {
      const result = await api(payload);
      if (generation !== run.current) return;
      if (!result.proposal || !result.proposalId)
        throw Error("The builder returned no saved proposal.");
      const t = templateSchema.parse(result.proposal.template);
      prepareProfileSave(result.proposal, t); // Structural/evidence review only; server repeats it.
      setProposal(result.proposal);
      setProposalId(result.proposalId);
      setTemplate(clone(t));
      setStep("review");
      setEditing(false);
      setName((previous) =>
        previous.trim() ? previous : builderAssessmentLabel(t.identity),
      );
    } catch (e) {
      if (generation === run.current)
        setError(
          e instanceof Error ? e.message : "Could not build this profile.",
        );
    } finally {
      if (generation === run.current) setBusy(false);
    }
  };
  const edit = (fn: (value: ProfileTemplate) => void) => {
    if (!template) return;
    const value = clone(template);
    fn(value);
    setTemplate(value);
    setError("");
  };
  let validation = "";
  let approval: ApprovalResult | null = proposal
    ? { status: "not_approved", entry: null }
    : null;
  if (proposal && template) {
    try {
      approval = prepareProfileSave(proposal, template).approval;
    } catch (e) {
      validation = e instanceof Error ? e.message : "Invalid template.";
    }
  }
  const restore = () => {
    if (!proposal?.presetId) return;
    try {
      const p = templateFromPreset(proposal.presetId);
      setTemplate(clone(p.template));
      setError("");
      setNotice("Approved settings restored. Save to keep them.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = async () => {
    if (!proposal || !template || validation || !name.trim() || busy) return;
    if (!proposalId) {
      setError(
        "This older built profile has no proposal receipt. Build a fresh reviewed proposal before saving.",
      );
      return;
    }
    const generation = ++run.current;
    setBusy(true);
    setError("");
    try {
      const result = await api({
        action: "save",
        proposalId,
        profileName: name.trim(),
        subjectName,
        ...(initialProfile?.id ? { profileId: initialProfile.id } : {}),
        template,
      });
      if (generation !== run.current) return;
      if (!result.profile) throw Error("Save was not confirmed.");
      window.dispatchEvent(new Event("examly-profiles-updated"));
      const savedReceipt = sourceJob?.jobId ?? pendingJobId ?? proposalId;
      if (savedReceipt)
        void clearPendingBuilderJob(subjectName, savedReceipt).catch(() => {});
      close();
    } catch (e) {
      if (generation === run.current) setError((e as Error).message);
    } finally {
      if (generation === run.current) setBusy(false);
    }
  };
  const duplicate = async () => {
    if (!initialProfile?.id || busy) return;
    const generation = ++run.current;
    setBusy(true);
    setError("");
    duplicateId.current ??= uuid();
    try {
      const result = await api({
        action: "duplicate",
        requestId: duplicateId.current,
        profileId: initialProfile.id,
        profileName: (name.trim() || initialProfile.profile_name) + " copy",
      });
      if (generation !== run.current) return;
      if (!result.profile) throw Error("Copy was not confirmed.");
      window.dispatchEvent(new Event("examly-profiles-updated"));
      setNotice(
        "Saved a copy of the stored profile. Unsaved edits were not copied.",
      );
    } catch (e) {
      if (generation === run.current) setError((e as Error).message);
    } finally {
      if (generation === run.current) setBusy(false);
    }
  };
  const evidence = proposal?.evidence;
  let updateSource: string | null = null;
  if (evidence?.documents.some((d) => d.authority === "official_registered")) {
    const registered = PROFILE_SOURCE_REGISTRY.find(
      (s) =>
        s.evidence.identity.course === evidence.identity.course &&
        s.evidence.identity.component === evidence.identity.component,
    );
    if (registered) {
      try {
        const current = resolveRegisteredSource(registered.id);
        if (compareEvidenceVersions(evidence, current).changed)
          updateSource = registered.id;
      } catch {
        /* No automatic changes to saved evidence. */
      }
    }
  }
  const courses = builderCourses(identity),
    selectedCourse = builderSelectedCourse(identity),
    papers = builderPapers(identity);
  const needsTier = builderNeedsTier(identity);
  const selectedPaper = builderFindAssessment(
    identity,
    assessmentId || identity.component,
  );
  const selectedDocument = discovery?.candidates.find(
    (candidate) => candidate.id === assessmentId,
  );
  const assessmentKind = papers.length
    ? builderAssessmentKind(identity)
    : selectedDocument
      ? selectedDocument.kind[0].toUpperCase() + selectedDocument.kind.slice(1)
      : "Assessment";
  const chooseAssessment = (value: string, preserveModule = false) => {
    invalidatePreview();
    setError("");
    if (value === "__manual") {
      setManualAssessment(true);
      setAssessmentId("");
      setAssessmentName("");
      setComponentCode("");
      setCodeEdited(false);
      setIdentity((previous) => ({ ...previous, component: "" }));
      return;
    }
    const known = papers.find((paper) => paper.id === value);
    const found = discovery?.candidates.find(
      (candidate) => candidate.id === value,
    );
    setManualAssessment(false);
    setAssessmentId(value);
    setAssessmentName(known?.label ?? found?.label ?? "");
    setComponentCode(known?.componentCode ?? found?.componentCode ?? "");
    setCodeEdited(false);
    setIdentity((previous) => ({
      ...previous,
      component: known?.id ?? found?.componentCode ?? found?.label ?? "",
      module: preserveModule ? previous.module : undefined,
    }));
  };
  const chooseSourceRecoveryAssessment = (value: string) => {
    const choice = sourceJob?.assessmentChoices?.find(
      (candidate) => candidate.id === value,
    );
    if (!choice) return;
    const discovered = discovery?.candidates.find(
      (candidate) =>
        candidate.id === choice.id ||
        (choice.componentCode
          ? candidate.componentCode === choice.componentCode
          : candidate.label === choice.label),
    );
    let known = builderFindAssessment(
      identity,
      choice.componentCode || choice.label,
    );
    if (!known && choice.componentCode) {
      const matchingOptions = papers.filter((paper) =>
        paper.requiredOptions?.some(
          (option) =>
            (option.id === identity.module ||
              option.label === identity.module) &&
            option.componentCodes.some(
              (code) =>
                code.replace(/\s/g, "").toLowerCase() ===
                choice.componentCode?.replace(/\s/g, "").toLowerCase(),
            ),
        ),
      );
      if (matchingOptions.length === 1) known = matchingOptions[0];
    }
    if (!known && !choice.componentCode) {
      for (const alias of discovered?.aliases ?? []) {
        known = builderFindAssessment(identity, alias);
        if (known) break;
      }
      const numbered = choice.label.match(/^(Paper|Unit|Component)\s+\d+\b/i);
      if (!known && numbered?.[1].toLowerCase() === choice.kind)
        known = builderFindAssessment(identity, numbered[0]);
    }
    if (papers.length && !known) {
      setError(
        "This assessment does not match your selected course. Check the course or source document.",
      );
      return;
    }
    if (known) {
      chooseAssessment(known.id, selectedPaper?.id === known.id);
    } else {
      const candidate = discovered ?? {
        ...choice,
        aliases: [
          choice.label,
          ...(choice.componentCode ? [choice.componentCode] : []),
        ],
        references: [],
      };
      invalidatePreview();
      setDiscovery((previous) => ({
        version: 1,
        candidates: [
          ...(previous?.candidates ?? []).filter(
            (item) => item.id !== candidate.id,
          ),
          candidate,
        ],
        warnings: previous?.warnings ?? [],
        ambiguous: previous?.ambiguous ?? false,
        needsManualEntry: false,
      }));
      setManualAssessment(false);
      setAssessmentId(candidate.id);
      setAssessmentName(candidate.label);
      setComponentCode(candidate.componentCode ?? "");
      setCodeEdited(false);
      setIdentity((previous) => ({
        ...previous,
        component: candidate.componentCode ?? candidate.label,
        module:
          previous.component === (candidate.componentCode ?? candidate.label)
            ? previous.module
            : undefined,
      }));
      setError("");
    }
    setSourceChoice("upload");
    setStep("details");
  };
  const effectiveCode = codeEdited
    ? componentCode
    : (selectedPaper?.componentCode ??
      selectedDocument?.componentCode ??
      componentCode);
  const codeError = effectiveCode.trim()
    ? selectedPaper
      ? builderValidateComponentCode(identity, selectedPaper.id, effectiveCode)
      : selectedDocument?.componentCode &&
          effectiveCode.replace(/\s/g, "").toLowerCase() !==
            selectedDocument.componentCode.replace(/\s/g, "").toLowerCase()
        ? "This code does not match the selected assessment in your source. Choose the matching assessment or restore its code."
        : selectedDocument && !selectedDocument.componentCode
          ? "This source does not give a code for the selected assessment. Clear the optional code; we will resolve it during source checks."
          : !manualAssessment
            ? "Choose the assessment before changing its technical code."
            : null
    : null;
  const confirmationLabel = builderAssessmentLabel({
    ...identity,
    component: selectedPaper?.id ?? (assessmentName || identity.component),
  });
  const sourceChoicesReady =
    !!identity.qualification &&
    !!identity.country &&
    !!identity.organisation &&
    (courses.length <= 1 || !!selectedCourse);

  let resolution: ReturnType<typeof resolveBuilderChoice> | null = null;
  try {
    resolution = resolveBuilderChoice(identity, mode);
  } catch {
    /* Missing choices stay visible. */
  }
  const exactPreset = resolution?.presetId || presetId;
  const exactSource = resolution?.sourceId || sourceId;
  const needEvidence = !exactPreset && !exactSource;
  const reviewChoice = () => {
    try {
      if (attachments.busy || discoveryBusy)
        throw Error(
          "Wait for your attached files to finish reading before continuing.",
        );
      if (!identity.qualification.trim())
        throw Error("Choose your educational level.");
      if (!identity.organisation.trim())
        throw Error(
          identity.stage === "University"
            ? "Which institution runs your course?"
            : "Which exam board do you study?",
        );
      if (courses.length > 1 && !selectedCourse)
        throw Error(
          "Choose which course you study; we won’t guess between course variants.",
        );
      if (!identity.country.trim())
        throw Error("Which country or education system is your course in?");
      if (codeError) throw Error(codeError);
      if (
        !papers.length &&
        !selectedDocument &&
        !manualAssessment &&
        !sourceJob
      )
        throw Error(
          "Choose an assessment found in your syllabus, or explicitly enter a name manually.",
        );
      if (manualAssessment && !assessmentName.trim())
        throw Error("Enter the assessment name from your syllabus.");
      if (
        sourceJob?.stage === "ready" &&
        sourceJob.identity &&
        canonical(sourceJob.identity) === canonical(identity) &&
        sourceJob.mode === mode
      ) {
        setError("");
        setStep("confirm");
        return;
      }
      const requested = {
        ...identity,
        component:
          selectedPaper?.id ??
          (manualAssessment && effectiveCode.trim()
            ? effectiveCode.trim()
            : identity.component),
      };
      const resolved = resolveBuilderChoice(requested, mode);
      const hasEvidence =
        resolved.presetId ||
        resolved.sourceId ||
        sourceId ||
        sourceUrl.trim() ||
        (sourceChoice === "upload" && uploads.length);
      if (!hasEvidence && sourceChoice !== "unverified")
        throw Error(
          "Add your syllabus or assessment brief so we can identify this assessment.",
        );
      if (
        !resolved.presetId &&
        sourceChoice === "unverified" &&
        mode === "full_mock"
      )
        throw Error(
          "Choose Short practice for an unverified draft, or add a source for a Full mock.",
        );
      if (!resolved.presetId && sourceChoice === "upload") {
        void prepareSource({
          ...resolved.identity,
          // A date hint belongs to this request's source context. It must not
          // become an exact catalogue version or be lost on source resolution.
          specificationVersion:
            classifySpecificationVersion(identity.specificationVersion).kind ===
            "timeline"
              ? identity.specificationVersion
              : resolved.identity.specificationVersion,
        });
        return;
      }
      setIdentity(resolved.identity);
      setPresetId(resolved.presetId);
      if (resolved.presetId) setSourceChoice("source");
      setSourceId(resolved.sourceId || sourceId);
      setError("");
      setStep("confirm");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const select = (
    value: string,
    onChange: (v: string) => void,
    options: [string, string][],
    label: string,
  ) => (
    <select
      aria-label={label}
      className={fieldClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([id, text]) => (
        <option key={id} value={id}>
          {text}
        </option>
      ))}
    </select>
  );
  const legacyRunning =
    sourceJob?.canAdvance === false && sourceJob.stage === "drafting";
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && !restartOpen) close();
        }}
      >
        <DialogContent
          hideCloseButton
          onInteractOutside={(event) => {
            if (restartOpen) event.preventDefault();
          }}
          className="profile-builder flex max-h-[90dvh] w-[calc(100%_-_1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-foreground sm:max-w-2xl"
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-5 text-left sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogDescription className="mb-1 text-xs">
                  {subjectName}
                </DialogDescription>
                <DialogTitle className="font-serif text-[25px] leading-tight">
                  Build your exam profile
                </DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close profile builder"
                onClick={close}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div
            ref={builderBody}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
            aria-busy={busy}
          >
            {error && (
              <p
                role="alert"
                className="rounded-md border border-danger-border bg-danger-muted p-3 text-sm"
              >
                {error}
              </p>
            )}
            {error && step === "review" && !proposalId && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void (pendingJobId ? resumeSource() : build())}
              >
                {pendingJobId ? "Check progress" : "Retry preparing profile"}
              </Button>
            )}
            {busy && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
                />
                {step === "review" && proposalId
                  ? "Saving your profile…"
                  : presetId
                    ? "Preparing your approved profile…"
                    : sourceChoice === "unverified"
                      ? "Building your unverified practice draft…"
                      : sourceChoice === "upload" && step === "details"
                        ? "Reading your syllabus…"
                        : "Building your source-backed draft…"}
              </p>
            )}
            {pendingJobId && !sourceJob && !busy && step !== "review" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm">
                  You have an unfinished syllabus request.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRestartOpen(true)}
                  >
                    Start again
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void resumeSource()}
                  >
                    Resume request
                  </Button>
                </div>
              </div>
            )}
            {sourceJob && step !== "review" && (
              <div
                ref={clarificationPanel}
                tabIndex={
                  ["needs_details", "failed"].includes(sourceJob.stage)
                    ? -1
                    : undefined
                }
                role={
                  ["needs_details", "failed"].includes(sourceJob.stage)
                    ? "group"
                    : undefined
                }
                aria-label={
                  ["needs_details", "failed"].includes(sourceJob.stage)
                    ? "Assessment clarification"
                    : undefined
                }
                className="space-y-2 rounded-xl border border-border bg-muted/35 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-live="polite"
              >
                <p className="text-sm font-medium">
                  {sourceJob.assessmentChoices?.length
                    ? (sourceJob.needs?.[0] ??
                      "Which assessment in this source are you preparing for?")
                    : sourceJob.message}
                </p>
                {sourceJob.progress.total > 0 &&
                  sourceJob.stage !== "needs_details" && (
                    <progress
                      className="h-1.5 w-full accent-primary"
                      aria-label="Syllabus processing progress"
                      max={sourceJob.progress.total}
                      value={sourceJob.progress.completed}
                    />
                  )}
                {sourceJob.assessmentChoices?.length ? (
                  <Field label="Assessment found in your source">
                    {select(
                      "",
                      chooseSourceRecoveryAssessment,
                      [
                        ["", "Choose an assessment"],
                        ...sourceJob.assessmentChoices.map(
                          (choice) =>
                            [choice.id, choice.label] as [string, string],
                        ),
                      ],
                      "Assessment found in your source",
                    )}
                  </Field>
                ) : sourceJob.needs?.length ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {sourceJob.needs.map((need) => (
                      <li key={need}>{need}</li>
                    ))}
                  </ul>
                ) : null}
                <BuilderEvidenceDetails job={sourceJob} />
                {!busy &&
                  ["reading", "identifying", "drafting"].includes(
                    sourceJob.stage,
                  ) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void resumeSource(sourceJob.canAdvance !== false)
                      }
                    >
                      {sourceJob.canAdvance === false
                        ? "Check progress"
                        : "Continue processing"}
                    </Button>
                  )}
                {!busy &&
                  ["needs_details", "failed"].includes(sourceJob.stage) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        invalidatePreview();
                        setStep("details");
                        setChangeKnown(true);
                      }}
                    >
                      Change details or documents
                    </Button>
                  )}
              </div>
            )}
            {notice && (
              <p role="status" className="rounded-md bg-muted p-3 text-sm">
                {notice}
              </p>
            )}
            <BuilderAttachments
              files={attachments.files}
              busy={attachments.busy}
              error={attachments.readError}
              active={sourceChoice === "upload" && !exactPreset}
              showPicker={step === "details" && sourceChoice === "upload"}
              disabled={busy}
              onSelect={readUpload}
              onRemove={removeAttachment}
              onClear={clearAttachments}
            />
            {attachments.files.length > 0 &&
              sourceChoice !== "upload" &&
              !exactPreset &&
              step === "details" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    invalidatePreview();
                    setSourceChoice("upload");
                    setSourceId("");
                    setSourceUrl("");
                    setError("");
                  }}
                >
                  Use attached files
                </Button>
              )}
            {discoveryBusy && (
              <p role="status" className="text-sm text-muted-foreground">
                Finding assessment names in your attached files…
              </p>
            )}
            {discoveryError && (
              <p role="alert" className="text-sm text-destructive">
                {discoveryError} Your files are still attached.
              </p>
            )}
            {discovery?.warnings.length && step === "details" ? (
              <p className="text-xs text-muted-foreground">
                {discovery.warnings[0]}
              </p>
            ) : null}
            {legacyRunning ? null : step === "details" ? (
              <fieldset disabled={busy} className="min-w-0 space-y-5">
                <p className="text-sm text-muted-foreground">
                  {identity.qualification
                    ? `Using your saved ${identity.qualification} settings`
                    : "We’ll use your subject and saved Settings."}
                  {identity.country
                    ? ` · ${identity.country === "GB" ? "UK" : identity.country}`
                    : ""}
                  . Just fill in the missing choices.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-3 text-sm">
                  <span>
                    {builderBoardLabel(identity.organisation) ||
                      "Exam board not selected"}{" "}
                    · {subjectName}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setChangeKnown(!changeKnown)}
                  >
                    {changeKnown ? "Hide saved details" : "Change details"}
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(!identity.qualification ||
                    !educationalLevel ||
                    changeKnown) && (
                    <Field label="Educational level">
                      {select(
                        identity.qualification,
                        (v) => changeIdentity("qualification", v),
                        [
                          ["", "Choose your level"],
                          ["GCSE", "GCSE"],
                          ["A-level", "A Level"],
                          ...ALL_LEVELS.filter(
                            (l) =>
                              !["level2", "level3", "other"].includes(l.id),
                          ).map((l) => [l.label, l.label] as [string, string]),
                        ],
                        "Educational level",
                      )}
                    </Field>
                  )}
                  {(!identity.country || changeKnown) && (
                    <Field label="Country or education system">
                      <Input
                        aria-label="Country or education system"
                        value={identity.country}
                        onChange={(e) =>
                          changeIdentity("country", e.target.value)
                        }
                        placeholder="e.g. UK, US, IB"
                      />
                    </Field>
                  )}
                  {(!identity.organisation || !examBoard || changeKnown) && (
                    <Field
                      label={
                        identity.stage === "University"
                          ? "Institution"
                          : "Exam board"
                      }
                    >
                      {identity.stage === "University" ||
                      !["GB", "UK"].includes(identity.country) ? (
                        <Input
                          aria-label="Institution or exam board"
                          value={identity.organisation}
                          onChange={(e) =>
                            changeIdentity("organisation", e.target.value)
                          }
                          placeholder="Your institution or awarding organisation"
                        />
                      ) : (
                        select(
                          identity.organisation,
                          (v) => changeIdentity("organisation", v),
                          [
                            ["", "Choose your board"],
                            ...Array.from(
                              new Set([
                                ...BUILDER_BOARDS,
                                ...(identity.organisation
                                  ? [identity.organisation]
                                  : []),
                              ]),
                            ).map((b) => [b, b] as [string, string]),
                          ],
                          "Exam board",
                        )
                      )}
                    </Field>
                  )}
                  {courses.length > 1 &&
                    (!selectedCourse || !courseId || changeKnown) && (
                      <Field label="Which course do you study?">
                        {select(
                          selectedCourse?.id ?? "",
                          (v) =>
                            changeIdentity(
                              "course",
                              courses.find((c) => c.id === v)
                                ?.specificationCode ?? v,
                            ),
                          [
                            ["", "Choose your course"],
                            ...courses.map(
                              (c) =>
                                [
                                  c.id,
                                  c.label.replace(
                                    /\s*\((?:7402|1BI0|J247|J257)\)/g,
                                    "",
                                  ),
                                ] as [string, string],
                            ),
                          ],
                          "Course variant",
                        )}
                      </Field>
                    )}
                  <Field label={assessmentKind}>
                    {select(
                      manualAssessment
                        ? "__manual"
                        : (selectedPaper?.id ?? assessmentId),
                      chooseAssessment,
                      [
                        [
                          "",
                          papers.length
                            ? `Choose your ${assessmentKind.toLowerCase()}`
                            : discoveryBusy
                              ? "Reading assessment names…"
                              : "Choose an assessment from your syllabus",
                        ],
                        ...papers.map(
                          (paper) =>
                            [paper.id, paper.label] as [string, string],
                        ),
                        ...(!papers.length
                          ? (discovery?.candidates ?? []).map(
                              (candidate) =>
                                [candidate.id, candidate.label] as [
                                  string,
                                  string,
                                ],
                            )
                          : []),
                        ...(!papers.length
                          ? [
                              [
                                "__manual",
                                "Enter an assessment name manually",
                              ] as [string, string],
                            ]
                          : []),
                      ],
                      assessmentKind,
                    )}
                    {!papers.length &&
                      !discovery?.candidates.length &&
                      !discoveryBusy &&
                      !manualAssessment && (
                        <p className="text-xs text-muted-foreground">
                          Attach your syllabus below to find its assessment
                          names. This uses no AI credits.
                        </p>
                      )}
                    {manualAssessment && (
                      <Input
                        aria-label="Assessment name (manual)"
                        value={assessmentName}
                        placeholder="Name shown on your syllabus"
                        onChange={(event) => {
                          invalidatePreview();
                          setAssessmentName(event.target.value);
                          setIdentity((previous) => ({
                            ...previous,
                            component: event.target.value,
                          }));
                        }}
                      />
                    )}
                    {manualAssessment && (
                      <p className="text-xs text-muted-foreground">
                        Entered manually. The source will still be checked
                        before a profile can be built.
                      </p>
                    )}
                  </Field>
                  {!!selectedPaper?.requiredOptions?.length && (
                    <Field label="Paper option">
                      {select(
                        selectedPaper.requiredOptions.find(
                          (option) =>
                            option.id === identity.module ||
                            option.label === identity.module,
                        )?.id ?? "",
                        (value) => changeIdentity("module", value || null),
                        [
                          ["", "Choose your option"],
                          ...selectedPaper.requiredOptions.map(
                            (option) =>
                              [option.id, option.label] as [string, string],
                          ),
                        ],
                        "Paper option",
                      )}
                    </Field>
                  )}
                  {needsTier &&
                    (!identity.tier || !assessmentTier || changeKnown) && (
                      <Field label="Tier">
                        {select(
                          identity.tier ?? "",
                          (v) => changeIdentity("tier", v || null),
                          [
                            ["", "Choose your tier"],
                            ["foundation", "Foundation"],
                            ["higher", "Higher"],
                          ],
                          "Tier",
                        )}
                      </Field>
                    )}
                  <Field label="What would you like to practise?">
                    {select(
                      mode,
                      (v) => {
                        invalidatePreview();
                        setMode(v as typeof mode);
                        setPresetId("");
                      },
                      [
                        ["short_practice", "Short practice"],
                        ["full_mock", "Full mock"],
                        ["custom", "Custom assessment"],
                      ],
                      "Assessment mode",
                    )}
                  </Field>
                </div>
                {sourceChoicesReady && needEvidence && (
                  <section className="space-y-3 border-t border-border pt-4">
                    <h2 className="text-base font-semibold">
                      {sourceChoice === "upload" && uploads.length
                        ? "Assessment source"
                        : "We need a source for this course"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {sourceChoice === "upload" && uploads.length
                        ? sourceJob?.stage === "needs_details"
                          ? "Your files are still attached. Check the assessment details above."
                          : "Your files are attached and ready to check."
                        : "Upload your full specification or assessment brief. We’ll find the relevant assessment details for you."}
                    </p>
                    {!(sourceChoice === "upload" && uploads.length) && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            sourceChoice === "upload" ? "default" : "outline"
                          }
                          onClick={() => {
                            invalidatePreview();
                            setSourceChoice("upload");
                            setError("");
                          }}
                        >
                          Upload syllabus
                        </Button>
                      </div>
                    )}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Other options
                      </summary>
                      <div className="mt-3">
                        {" "}
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            sourceChoice === "unverified"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => {
                            invalidatePreview();
                            setSourceChoice("unverified");
                            setError("");
                          }}
                        >
                          General practice without a syllabus
                        </Button>
                      </div>
                    </details>
                    {sourceChoice === "unverified" && (
                      <p className="rounded-md bg-warning-light p-3 text-sm">
                        Create an unverified general-practice draft. It may not
                        match your real assessment; full mock is unavailable
                        without evidence.
                      </p>
                    )}
                  </section>
                )}
                {resolution?.presetId && (
                  <p className="text-sm text-muted-foreground">
                    An exact Examly-approved preset is available. No AI call is
                    needed.
                  </p>
                )}
                {resolution?.sourceId && (
                  <p className="text-sm text-muted-foreground">
                    We found a reviewed official source. We’ll use it to build
                    an editable AI draft.
                  </p>
                )}
                <details className="rounded-md border border-border p-3">
                  <summary className="min-h-6 cursor-pointer text-sm font-medium">
                    Advanced details
                  </summary>
                  <div className="mt-4 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Optional technical overrides. Changing these can remove
                      preset approval or require additional evidence.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Document limits: 240 pages and 600,000 extracted text
                      characters per file. Documents that cannot be read need a
                      readable alternative.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          ["educationSystem", "Education system"],
                          ["qualification", "Qualification"],
                          ["course", "Course / specification code"],
                          [
                            "specificationVersion",
                            "Specification version / teaching dates (optional)",
                          ],
                        ] as const
                      ).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <Input
                            aria-label={label}
                            value={String(identity[key] ?? "")}
                            onChange={(e) =>
                              changeIdentity(key, e.target.value)
                            }
                            placeholder={
                              key === "specificationVersion"
                                ? "Leave blank to resolve from your source"
                                : undefined
                            }
                            aria-describedby={
                              key === "specificationVersion"
                                ? "builder-version-context-hint"
                                : undefined
                            }
                          />
                          {key === "specificationVersion" && (
                            <p
                              id="builder-version-context-hint"
                              className="text-xs text-muted-foreground"
                            >
                              Dates help identify your course. Examly verifies
                              the specification version from its catalogue or
                              your source.
                            </p>
                          )}
                        </Field>
                      ))}
                      <Field label="Paper / component code">
                        <Input
                          aria-label="Paper / component code"
                          value={effectiveCode}
                          placeholder="Resolved from your assessment"
                          onChange={(event) => {
                            invalidatePreview();
                            setComponentCode(event.target.value);
                            setCodeEdited(true);
                            setError("");
                          }}
                        />
                        {codeError && (
                          <p role="alert" className="text-xs text-destructive">
                            {codeError}
                          </p>
                        )}
                      </Field>
                      <Field label="Education stage">
                        {select(
                          identity.stage,
                          (v) => changeIdentity("stage", v),
                          [
                            ["Secondary", "School / sixth form"],
                            ["University", "University / college"],
                            ["Other", "Other course"],
                          ],
                          "Education stage",
                        )}
                      </Field>
                    </div>
                    {!selectedCourse &&
                      identity.qualification !== "A-level" && (
                        <Field label="Assessment tier">
                          {select(
                            identity.tier ?? "",
                            (v) => changeIdentity("tier", v || null),
                            [
                              ["", "Unknown"],
                              ["not_tiered", "Not tiered"],
                              ["foundation", "Foundation"],
                              ["higher", "Higher"],
                            ],
                            "Assessment tier",
                          )}
                        </Field>
                      )}
                    <Field label="Approved preset">
                      {select(
                        presetId,
                        choosePreset,
                        [
                          ["", "Resolve from my choices"],
                          ...catalogue
                            .filter((e) =>
                              builderCourses(identity).some(
                                (c) => c.id === e.course,
                              ),
                            )
                            .map(
                              (e) =>
                                [
                                  e.id,
                                  `${e.component} · ${e.tier} · ${e.mode === "full_mock" ? "Full mock" : "Short practice"}`,
                                ] as [string, string],
                            ),
                        ],
                        "Approved preset",
                      )}
                    </Field>
                    {!exactPreset && (
                      <>
                        <Field label="Registered source">
                          {select(
                            sourceId,
                            chooseSource,
                            [
                              ["", "Resolve from my choices"],
                              ...PROFILE_SOURCE_REGISTRY.filter((s) => {
                                const id = s.evidence.identity;
                                const same = (a?: string, b?: string) =>
                                  !b ||
                                  (a ?? "").toLowerCase() === b.toLowerCase();
                                // Only offer sources for the chosen subject,
                                // qualification and course (never GCSE for A-level).
                                return (
                                  same(id.subject, subjectName) &&
                                  same(id.qualification, identity.qualification) &&
                                  (!identity.course ||
                                    !/^\w*\d/.test(identity.course) ||
                                    same(id.course, identity.course))
                                );
                              }).map((s) => {
                                const id = s.evidence.identity;
                                const tier =
                                  id.tier && id.tier !== "not_tiered"
                                    ? ` · ${id.tier[0].toUpperCase()}${id.tier.slice(1)}`
                                    : "";
                                return [
                                  s.id,
                                  `${s.evidence.documents[0].title} · ${id.component}${tier}`,
                                ] as [string, string];
                              }),
                            ],
                            "Registered source",
                          )}
                        </Field>
                        <Field label="Registered official specification URL">
                          <Input
                            aria-label="Official specification URL"
                            type="url"
                            value={sourceUrl}
                            onChange={(e) => {
                              invalidatePreview();
                              setSourceUrl(e.target.value);
                              setSourceId("");
                              setSourceChoice("source");
                            }}
                            placeholder="https://…"
                          />
                        </Field>
                        <p className="text-xs text-muted-foreground">
                          Only reviewed registered URLs resolve automatically.
                          Upload a syllabus for a new source; model knowledge is
                          never a silent fallback.
                        </p>
                      </>
                    )}
                  </div>
                </details>
              </fieldset>
            ) : step === "confirm" ? (
              <div className="space-y-4 py-3">
                <h2 className="text-xl font-semibold leading-snug">
                  We’ll build {confirmationLabel}.
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "full_mock"
                    ? "Full mock"
                    : mode === "short_practice"
                      ? "Short practice"
                      : "Custom assessment"}
                  {educationalLevel
                    ? ` using your saved ${identity.qualification} level`
                    : ""}
                  . You can edit the completed profile before saving.
                </p>
                {presetId ? (
                  <p className="text-sm">
                    Your exact Examly-approved preset loads instantly, with no
                    AI call.
                  </p>
                ) : sourceJob?.stage === "ready" ? (
                  <p className="text-sm">
                    We found this assessment in your syllabus. The AI draft will
                    follow its supported rules.
                  </p>
                ) : sourceId ? (
                  <p className="text-sm">
                    The AI draft will use the reviewed official source for this
                    course.
                  </p>
                ) : sourceChoice === "unverified" ? (
                  <p className="rounded-md bg-warning-light p-3 text-sm">
                    Unverified general practice. This is not an approved preset
                    or an authentic full mock.
                  </p>
                ) : (
                  <p className="text-sm">
                    The AI draft needs your syllabus or a reviewed source.
                    Choose one in Change details before building.
                  </p>
                )}
              </div>
            ) : template && proposal ? (
              <fieldset disabled={busy || !proposalId} className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ExamlyApprovalBadge
                    approval={approval!}
                    origin={proposal.origin}
                  />
                  {proposal.presetId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={restore}
                      disabled={busy}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Restore approved settings
                    </Button>
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-background/45 p-4 sm:p-5">
                  <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                    <div className="min-w-0">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <CheckCircle2
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                        {proposalId
                          ? "Your profile is ready"
                          : "Preparing your profile"}
                      </p>
                      <h2 className="break-words font-serif text-xl font-semibold leading-snug">
                        {name || builderAssessmentLabel(template.identity)}
                      </h2>
                      {!!name.trim() &&
                        name.trim() !==
                          builderAssessmentLabel(template.identity) && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {builderAssessmentLabel(template.identity)}
                          </p>
                        )}
                      <span className="mt-2 inline-flex rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {template.mode === "full_mock"
                          ? "Full mock"
                          : template.mode === "short_practice"
                            ? "Short practice"
                            : "Custom assessment"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start sm:shrink-0"
                      aria-pressed={editing}
                      onClick={() => setEditing(!editing)}
                    >
                      <Pencil
                        aria-hidden="true"
                        className="mr-1.5 h-3.5 w-3.5"
                      />
                      {editing ? "Done editing" : "Edit profile"}
                    </Button>
                  </div>
                  <dl className="grid grid-cols-3 divide-x divide-border rounded-xl bg-muted/55 py-3">
                    <div className="px-2 text-center">
                      <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <FileText aria-hidden="true" className="h-3 w-3" />
                        Parts
                      </dt>
                      <dd className="mt-1 text-lg font-semibold">
                        <strong>
                          {
                            template.sections.flatMap((section) =>
                              section.groups.flatMap((group) => group.parts),
                            ).length
                          }
                        </strong>
                      </dd>
                    </div>
                    <div className="px-2 text-center">
                      <dt className="text-[11px] text-muted-foreground">
                        Marks
                      </dt>
                      <dd className="mt-1 text-lg font-semibold">
                        <strong>{template.marks}</strong>
                      </dd>
                    </div>
                    <div className="px-2 text-center">
                      <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 aria-hidden="true" className="h-3 w-3" />
                        Minutes
                      </dt>
                      <dd className="mt-1 text-lg font-semibold">
                        <strong>{template.durationMinutes}</strong>
                      </dd>
                    </div>
                  </dl>
                  <p className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
                    {template.topics.length} topics
                  </p>
                  <div
                    className="flex flex-wrap gap-1.5"
                    aria-label="Included topics"
                  >
                    {template.topics.slice(0, 6).map((topic) => (
                      <span
                        key={topic}
                        className="max-w-full rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        {topic}
                      </span>
                    ))}
                    {template.topics.length > 6 && (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        +{template.topics.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
                {editing && (
                  <div className="space-y-4 rounded-xl border border-border p-4">
                    <Field label="Profile name">
                      <Input
                        aria-label="Profile name"
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11"
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Total marks">
                        <Input
                          aria-label="Total marks"
                          type="number"
                          min={1}
                          max={300}
                          value={template.marks}
                          onChange={(e) =>
                            edit((t) => {
                              t.marks = Number(e.target.value);
                            })
                          }
                        />
                      </Field>
                      <Field label="Time limit (minutes)">
                        <Input
                          aria-label="Time limit (minutes)"
                          type="number"
                          min={1}
                          max={360}
                          value={template.durationMinutes}
                          onChange={(e) =>
                            edit((t) => {
                              t.durationMinutes = Number(e.target.value);
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Topics — one per line">
                      <textarea
                        aria-label="Topics — one per line"
                        className={`${fieldClass} min-h-24`}
                        value={template.topics.join("\n")}
                        onChange={(e) =>
                          edit((t) => {
                            t.topics = e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean);
                          })
                        }
                      />
                    </Field>
                  </div>
                )}
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Advanced details
                  </summary>
                  <div className="mt-4 space-y-5">
                    <p className="break-words text-xs text-muted-foreground">
                      {template.identity.qualification} ·{" "}
                      {template.identity.course} · {template.identity.component}{" "}
                      · {template.identity.specificationVersion}
                    </p>
                    {!editing && (
                      <p className="text-xs text-muted-foreground">
                        Choose Edit profile to adjust these settings.
                      </p>
                    )}
                    <fieldset disabled={!editing} className="space-y-5">
                      <Field label="Calculator">
                        {select(
                          template.calculator,
                          (v) =>
                            edit((t) => {
                              t.calculator = v as ProfileTemplate["calculator"];
                            }),
                          [
                            ["allowed", "Allowed"],
                            ["not_allowed", "Not allowed"],
                            ["unknown", "Unknown"],
                          ],
                          "Calculator",
                        )}
                      </Field>
                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="font-serif text-lg">
                            Paper structure
                          </h2>
                          <span className="text-xs text-muted-foreground">
                            Examly layout choices
                          </span>
                        </div>
                        {template.sections.map((section, si) => (
                          <div key={section.id} className="space-y-2">
                            <h3 className="text-sm font-semibold">
                              {section.title}
                            </h3>
                            {section.groups.map((group, gi) => (
                              <details
                                key={group.id}
                                className="rounded-lg border border-border bg-card"
                              >
                                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm">
                                  Question {gi + 1} · {group.parts.length}{" "}
                                  {group.parts.length === 1 ? "part" : "parts"}{" "}
                                  ·{" "}
                                  {group.parts.reduce((n, p) => n + p.marks, 0)}{" "}
                                  marks
                                </summary>
                                <div className="space-y-3 border-t border-border p-3">
                                  {group.parts.map((part, pi) => (
                                    <div
                                      key={part.id}
                                      className="space-y-2 rounded-md bg-muted/30 p-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold">
                                          Part {String.fromCharCode(97 + pi)}
                                        </span>
                                        {group.parts.length > 1 && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            aria-label={`Remove part ${gi + 1}${String.fromCharCode(97 + pi)}`}
                                            onClick={() =>
                                              edit((t) => {
                                                t.sections[si].groups[
                                                  gi
                                                ].parts.splice(pi, 1);
                                              })
                                            }
                                          >
                                            Remove
                                          </Button>
                                        )}
                                      </div>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <Field label="Topic">
                                          {select(
                                            part.topic,
                                            (v) =>
                                              edit((t) => {
                                                t.sections[si].groups[gi].parts[
                                                  pi
                                                ].topic = v;
                                              }),
                                            template.topics.map((t) => [t, t]),
                                            `Topic ${gi + 1}${String.fromCharCode(97 + pi)}`,
                                          )}
                                        </Field>
                                        <Field label="Marks">
                                          <Input
                                            aria-label={`Marks ${gi + 1}${String.fromCharCode(97 + pi)}`}
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={part.marks}
                                            onChange={(e) =>
                                              edit((t) => {
                                                t.sections[si].groups[gi].parts[
                                                  pi
                                                ].marks = Number(
                                                  e.target.value,
                                                );
                                              })
                                            }
                                          />
                                        </Field>
                                        <Field label="Response">
                                          {select(
                                            part.response,
                                            (v) =>
                                              edit((t) => {
                                                t.sections[si].groups[gi].parts[
                                                  pi
                                                ].response =
                                                  v as typeof part.response;
                                              }),
                                            [
                                              ["mcq_single", "Tick one box"],
                                              ["short_answer", "Short answer"],
                                              [
                                                "long_form",
                                                "Extended response",
                                              ],
                                            ],
                                            `Response ${gi + 1}${String.fromCharCode(97 + pi)}`,
                                          )}
                                        </Field>
                                        <Field label="Resource">
                                          {select(
                                            part.resource,
                                            (v) =>
                                              edit((t) => {
                                                t.sections[si].groups[gi].parts[
                                                  pi
                                                ].resource =
                                                  v as typeof part.resource;
                                              }),
                                            [
                                              ["none", "No resource"],
                                              ["data_table", "Data table"],
                                              ["graph", "Graph"],
                                              [
                                                "diagram",
                                                "Reviewed diagram (adapter required)",
                                              ],
                                              [
                                                "passage",
                                                "Reviewed passage (adapter required)",
                                              ],
                                            ],
                                            `Resource ${gi + 1}${String.fromCharCode(97 + pi)}`,
                                          )}
                                        </Field>
                                      </div>
                                    </div>
                                  ))}
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={group.parts.length >= 10}
                                      onClick={() =>
                                        edit((t) => {
                                          t.sections[si].groups[gi].parts.push({
                                            id: uuid(),
                                            topic: t.topics[0],
                                            marks: 1,
                                            response: "short_answer",
                                            demand: "AO1",
                                            resource: "none",
                                          });
                                        })
                                      }
                                    >
                                      Add part
                                    </Button>
                                    {section.groups.length > 1 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          edit((t) => {
                                            t.sections[si].groups.splice(gi, 1);
                                          })
                                        }
                                      >
                                        Remove question
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </details>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                edit((t) => {
                                  t.sections[si].groups.push({
                                    id: uuid(),
                                    parts: [
                                      {
                                        id: uuid(),
                                        topic: t.topics[0],
                                        marks: 1,
                                        response: "short_answer",
                                        demand: "AO1",
                                        resource: "none",
                                      },
                                    ],
                                  });
                                })
                              }
                            >
                              Add question
                            </Button>
                          </div>
                        ))}
                      </section>
                    </fieldset>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        invalidatePreview();
                        setChangeKnown(true);
                        setStep("details");
                      }}
                    >
                      Change assessment
                    </Button>
                    {template.warnings.length > 0 && (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {template.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                    {evidence && (
                      <details className="rounded-lg border border-border p-3">
                        <summary className="cursor-pointer text-sm">
                          Sources & unresolved details
                        </summary>
                        <div className="mt-3 space-y-3 text-xs">
                          {evidence.documents.map((d) => (
                            <div key={d.id}>
                              <p className="font-medium">
                                {d.url ? (
                                  <a
                                    className="underline"
                                    href={d.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {d.title}
                                  </a>
                                ) : (
                                  d.title
                                )}{" "}
                                · {d.version}
                              </p>
                              <p className="text-muted-foreground">
                                {d.authority === "official_registered"
                                  ? "Reviewed official source"
                                  : "User-supplied course evidence"}{" "}
                                · {d.state}
                              </p>
                              {evidence.claims
                                .filter((c) => c.documentId === d.id)
                                .map((c, i) => (
                                  <p key={i} className="mt-1">
                                    {c.field} — p.{" "}
                                    {
                                      d.locations.find(
                                        (l) => l.id === c.locationId,
                                      )?.page
                                    }
                                    ,{" "}
                                    {
                                      d.locations.find(
                                        (l) => l.id === c.locationId,
                                      )?.section
                                    }
                                    : {c.quote} ({c.rule})
                                  </p>
                                ))}
                            </div>
                          ))}
                          {[...evidence.unresolved, ...evidence.conflicts].map(
                            (w, i) => (
                              <p key={i}>{w}</p>
                            ),
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </details>
                {validation && (
                  <p
                    role="alert"
                    className="rounded-md border border-danger-border bg-danger-muted p-3 text-sm"
                  >
                    {validation}
                  </p>
                )}
                {updateSource && (
                  <div className="rounded-md bg-warning-light p-3 text-sm">
                    <p>
                      A newer registered source is available. Your saved profile
                      is unchanged.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        const current = resolveRegisteredSource(updateSource);
                        setIdentity(current.identity);
                        setSourceId(updateSource);
                        setSourceChoice("source");
                        setPresetId("");
                        setStep("details");
                        setNotice(
                          "Review the new source details, then build a separate proposal.",
                        );
                      }}
                    >
                      Compare / use current source
                    </Button>
                  </div>
                )}
                {proposal.origin !== "catalogue" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void build(true);
                    }}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Regenerate draft
                  </Button>
                )}
                {initialProfile?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void duplicate();
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Duplicate saved profile
                  </Button>
                )}
              </fieldset>
            ) : null}
          </div>
          <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-4 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-2 sm:space-x-0 sm:px-6 sm:[&>button]:flex-none sm:[&>button]:px-4">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (legacyRunning) {
                  close();
                } else if (step === "review") {
                  const discardedReceipt =
                    sourceJob?.jobId ?? pendingJobId ?? proposalId;
                  if (discardedReceipt)
                    void clearPendingBuilderJob(
                      subjectName,
                      discardedReceipt,
                    ).catch(() => {});
                  close();
                } else if (step === "confirm") {
                  setChangeKnown(true);
                  setStep("details");
                } else {
                  run.current++;
                  onManual();
                }
              }}
            >
              {legacyRunning
                ? "Close"
                : step === "details"
                  ? "Manual editor"
                  : step === "review"
                    ? "Cancel"
                    : "Change details"}
            </Button>
            {legacyRunning ? null : step === "details" ? (
              <Button
                disabled={
                  busy ||
                  attachments.busy ||
                  discoveryBusy ||
                  sourceJob?.stage === "needs_details"
                }
                onClick={reviewChoice}
              >
                {sourceChoice === "upload" && uploads.length
                  ? "Read syllabus"
                  : "Continue"}
              </Button>
            ) : step === "confirm" ? (
              <Button
                disabled={
                  busy ||
                  attachments.busy ||
                  discoveryBusy ||
                  !!codeError ||
                  (!sourceJob?.identity &&
                    !presetId &&
                    !sourceId &&
                    !sourceUrl.trim() &&
                    !(sourceChoice === "upload" && uploads.length) &&
                    sourceChoice !== "unverified") ||
                  (!presetId &&
                    sourceChoice === "unverified" &&
                    mode === "full_mock")
                }
                onClick={() =>
                  void (sourceJob?.stage === "ready"
                    ? confirmSource()
                    : build())
                }
              >
                {busy ? "Building…" : "Yes, build it"}
                <Sparkles className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                disabled={busy || !!validation || !name.trim() || !proposalId}
                onClick={() => void save()}
              >
                {busy
                  ? proposalId
                    ? "Saving…"
                    : "Preparing…"
                  : "Save profile"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new build?</AlertDialogTitle>
            <AlertDialogDescription>
              Your saved profiles and attached files will stay. The current
              build will no longer be selected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current build</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                invalidatePreview();
                setStep("details");
                setRestartOpen(false);
              }}
            >
              Start again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
