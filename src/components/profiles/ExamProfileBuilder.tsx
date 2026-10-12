import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
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
import { Label } from "@/components/ui/label";
import {
  invokeProfileBuilder,
  type BuilderApi,
} from "@/lib/profile-builder-client";
import {
  approvalCatalogue,
  evaluateApproval,
  approvedPreset,
  type ApprovalResult,
} from "../../../supabase/functions/_shared/preset-approval";
import {
  canonical,
  compileTemplate,
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
import {
  validateEvidenceTemplate,
  compareEvidenceVersions,
} from "../../../supabase/functions/_shared/profile-evidence";
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
} from "@/lib/profile-builder-resolution";
import { ALL_LEVELS } from "@/lib/educational-levels";

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
  const [presetId, setPresetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceChoice, setSourceChoice] = useState<
    "source" | "upload" | "unverified"
  >("source");
  const [upload, setUpload] = useState<{
    contentType: string;
    base64: string;
  } | null>(null);
  const [proposal, setProposal] = useState<BuilderProposal | null>(null);
  const [proposalId, setProposalId] = useState("");
  const [template, setTemplate] = useState<ProfileTemplate | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const run = useRef(0),
    request = useRef<{ payload: string; id: string } | null>(null),
    duplicateId = useRef<string | null>(null);
  useEffect(() => {
    run.current++;
    setBusy(false);
    setError("");
    setNotice("");
    request.current = null;
    duplicateId.current = null;
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
    setUpload(null);
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
  ]);
  const close = () => {
    run.current++;
    onOpenChange(false);
  };
  const changeIdentity = (
    key: keyof TemplateIdentity,
    value: string | null,
  ) => {
    setError("");
    setSourceId("");
    setIdentity((v) => {
      const next = { ...v, [key]: value };
      if (["organisation", "qualification", "country"].includes(key)) {
        next.course = "";
        next.component = "";
        next.specificationVersion = "";
        next.tier = null;
      }
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
    setPresetId(id);
    setError("");
    if (!id) return;
    const p = templateFromPreset(id);
    setIdentity(p.template.identity);
    setMode(p.template.mode);
    setSourceId("");
    setSourceUrl("");
    setUpload(null);
    setSourceChoice("source");
    if (!name.trim())
      setName(
        p.template.identity.subject + " · " + p.template.identity.component,
      );
  };
  const chooseSource = (id: string) => {
    setSourceId(id);
    setSourceChoice("source");
    setSourceUrl("");
    setPresetId("");
    setUpload(null);
    setError("");
    if (id) {
      const e = resolveRegisteredSource(id);
      setIdentity(e.identity);
    }
  };
  const readUpload = async (file?: File) => {
    setError("");
    setUpload(null);
    const generation = run.current;
    if (!file) return;
    const contentType =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name)
        ? "application/pdf"
        : "text/plain";
    if (
      file.size > 3_000_000 ||
      (!/\.(pdf|txt)$/i.test(file.name) &&
        !["application/pdf", "text/plain"].includes(file.type))
    ) {
      setError("Upload a PDF or text syllabus up to 3 MB.");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      if (generation === run.current)
        setUpload({ contentType, base64: btoa(binary) });
    } catch {
      if (generation === run.current) setError("Could not read this document.");
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
      if (!upload) {
        setError("Choose a syllabus document first.");
        return;
      }
      payload.upload = upload;
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
    if (presetId && !regenerate) {
      const local = templateFromPreset(presetId);
      setProposal(local);
      setTemplate(clone(local.template));
      setProposalId("");
      setStep("review");
      if (!name.trim())
        setName(builderAssessmentLabel(local.template.identity));
    }
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
      if (
        sourceChoice === "upload" &&
        identity.tier === null &&
        !builderNeedsTier(identity)
      )
        throw Error(
          "Does everyone sit the same assessment? Confirm this from your brief, or use Advanced details for separate tiers.",
        );
      const resolved = resolveBuilderChoice(identity, mode);
      setIdentity(resolved.identity);
      setPresetId(resolved.presetId);
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
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent
        hideCloseButton
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 text-foreground sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogDescription className="mb-1 text-xs">
                {subjectName}
              </DialogDescription>
              <DialogTitle className="font-serif text-[25px]">
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
          <nav
            aria-label="Builder steps"
            className="!mt-4 flex gap-1 rounded-md bg-muted/50 p-1"
          >
            {["details", "confirm", "review"].map((s, i) => (
              <button
                key={s}
                type="button"
                disabled={busy || (s === "review" && !template)}
                onClick={() => {
                  if (s === "confirm") reviewChoice();
                  else setStep(s as typeof step);
                }}
                aria-current={step === s ? "step" : undefined}
                className={`min-h-9 flex-1 rounded text-xs ${step === s ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}
              >
                {i + 1} ·{" "}
                {s === "details"
                  ? "Choose"
                  : s === "confirm"
                    ? "Confirm"
                    : "Preview"}
              </button>
            ))}
          </nav>
        </DialogHeader>
        <div
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
              onClick={() => void build()}
            >
              Retry preparing profile
            </Button>
          )}
          {busy && (
            <p role="status" className="text-sm text-muted-foreground">
              {step === "review" && proposalId
                ? "Saving your profile…"
                : presetId
                  ? "Preparing your approved profile…"
                  : sourceChoice === "unverified"
                    ? "Building your unverified practice draft…"
                    : "Building your source-backed draft…"}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md bg-muted p-3 text-sm">
              {notice}
            </p>
          )}
          {step === "details" ? (
            <>
              <p className="text-sm text-muted-foreground">
                {identity.qualification
                  ? `Using your saved ${identity.qualification} level`
                  : "We’ll use your subject and saved Settings."}
                {identity.country
                  ? ` · ${identity.country === "GB" ? "UK" : identity.country}`
                  : ""}
                . Just fill in the missing choices.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-3 text-sm">
                <span>
                  {identity.organisation || "Exam board not selected"} ·{" "}
                  {subjectName}
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
                {(!educationalLevel || changeKnown) && (
                  <Field label="Educational level">
                    {select(
                      identity.qualification,
                      (v) => changeIdentity("qualification", v),
                      [
                        ["", "Choose your level"],
                        ["GCSE", "GCSE"],
                        ["A-level", "A Level"],
                        ...ALL_LEVELS.filter(
                          (l) => !["level2", "level3", "other"].includes(l.id),
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
                {(!examBoard || changeKnown) && (
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
                {courses.length > 1 && (!courseId || changeKnown) && (
                  <Field label="Which course do you study?">
                    {select(
                      selectedCourse?.id ?? "",
                      (v) =>
                        changeIdentity(
                          "course",
                          courses.find((c) => c.id === v)?.specificationCode ??
                            v,
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
                {(!paperId || changeKnown) && (
                  <Field
                    label={
                      identity.stage === "University" ? "Assessment" : "Paper"
                    }
                  >
                    {papers.length ? (
                      select(
                        papers.find(
                          (p) =>
                            p.id === identity.component ||
                            p.pack.definition(identity.tier ?? p.pack.tiers[0])
                              .componentCode === identity.component,
                        )?.id ?? "",
                        (v) => changeIdentity("component", v),
                        [
                          ["", "Choose your paper"],
                          ...papers.map(
                            (p) =>
                              [p.id, p.label.replace(/\s*\([^)]*\)/g, "")] as [
                                string,
                                string,
                              ],
                          ),
                        ],
                        "Paper",
                      )
                    ) : (
                      <Input
                        aria-label="Paper or assessment"
                        value={identity.component}
                        onChange={(e) =>
                          changeIdentity("component", e.target.value)
                        }
                        placeholder={
                          identity.stage === "University"
                            ? "e.g. Final assessment"
                            : "e.g. Paper 1"
                        }
                      />
                    )}
                  </Field>
                )}
                {needsTier && (!assessmentTier || changeKnown) && (
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
              {resolution && needEvidence && (
                <section className="space-y-3 border-t border-border pt-4">
                  <h2 className="text-base font-semibold">
                    We need a source for this course
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    There isn’t an exact approved preset or reviewed source for
                    these choices yet. Upload your syllabus or assessment brief
                    so the draft can follow it.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        sourceChoice === "upload" ? "default" : "outline"
                      }
                      onClick={() => {
                        setSourceChoice("upload");
                        setError("");
                      }}
                    >
                      Upload syllabus
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        sourceChoice === "unverified" ? "default" : "outline"
                      }
                      onClick={() => {
                        setSourceChoice("unverified");
                        setError("");
                      }}
                    >
                      General practice without a syllabus
                    </Button>
                  </div>
                  {sourceChoice === "upload" &&
                    !needsTier &&
                    !selectedCourse &&
                    identity.qualification !== "A-level" && (
                      <Field label="Does everyone sit the same assessment?">
                        {select(
                          identity.tier ?? "",
                          (v) => changeIdentity("tier", v || null),
                          [
                            ["", "Choose an answer"],
                            ["not_tiered", "Yes, one assessment for everyone"],
                          ],
                          "Does everyone sit the same assessment?",
                        )}
                        <p className="text-xs text-muted-foreground">
                          Check your brief. If it has separate tiers, record
                          them in Advanced details.
                        </p>
                      </Field>
                    )}
                  {sourceChoice === "upload" && (
                    <Field label="Syllabus or assessment brief">
                      <Input
                        aria-label="Syllabus or assessment brief"
                        type="file"
                        accept=".pdf,.txt,application/pdf,text/plain"
                        onChange={(e) => void readUpload(e.target.files?.[0])}
                      />
                      <span className="text-xs text-muted-foreground">
                        PDF or text, up to 3 MB. Scanned PDFs need a text
                        version. Evidence stays in your account.
                      </span>
                    </Field>
                  )}
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
                  We found a reviewed official source. We’ll use it to build an
                  editable AI draft.
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["educationSystem", "Education system"],
                        ["qualification", "Qualification"],
                        ["course", "Course / specification code"],
                        ["component", "Paper / component code"],
                        [
                          "specificationVersion",
                          "Specification / cohort version",
                        ],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <Input
                          aria-label={label}
                          value={String(identity[key] ?? "")}
                          onChange={(e) => changeIdentity(key, e.target.value)}
                        />
                      </Field>
                    ))}
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
                  {!selectedCourse && identity.qualification !== "A-level" && (
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
                            ...PROFILE_SOURCE_REGISTRY.filter(
                              (s) =>
                                s.evidence.identity.subject.toLowerCase() ===
                                subjectName.toLowerCase(),
                            ).map(
                              (s) =>
                                [s.id, s.evidence.documents[0].title] as [
                                  string,
                                  string,
                                ],
                            ),
                          ],
                          "Registered source",
                        )}
                      </Field>
                      <Field label="Official specification URL">
                        <Input
                          aria-label="Official specification URL"
                          type="url"
                          value={sourceUrl}
                          onChange={(e) => {
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
            </>
          ) : step === "confirm" ? (
            <div className="space-y-4 py-3">
              <h2 className="text-xl font-semibold leading-snug">
                We’ll build {builderAssessmentLabel(identity)}.
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
                  Your exact Examly-approved preset loads instantly, with no AI
                  call.
                </p>
              ) : sourceId ? (
                <p className="text-sm">
                  The AI draft will use the reviewed official source for this
                  course.
                </p>
              ) : sourceChoice === "unverified" ? (
                <p className="rounded-md bg-warning-light p-3 text-sm">
                  Unverified general practice. This is not an approved preset or
                  an authentic full mock.
                </p>
              ) : (
                <p className="text-sm">
                  The AI draft needs your syllabus or a reviewed source. Choose
                  one in Change details before building.
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
              <Field label="Profile name">
                <Input
                  aria-label="Profile name"
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                {builderAssessmentLabel(template.identity)}
              </p>
              <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <span>
                  <strong>
                    {
                      template.sections.flatMap((s) =>
                        s.groups.flatMap((g) => g.parts),
                      ).length
                    }
                  </strong>{" "}
                  parts
                </span>
                <span>
                  <strong>{template.marks}</strong> marks
                </span>
                <span>
                  <strong>{template.durationMinutes}</strong> minutes
                </span>
              </div>
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
              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Advanced details
                </summary>
                <div className="mt-4 space-y-5">
                  <p className="break-words text-xs text-muted-foreground">
                    {template.identity.qualification} ·{" "}
                    {template.identity.course} · {template.identity.component} ·{" "}
                    {template.identity.specificationVersion}
                  </p>
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
                      <h2 className="font-serif text-lg">Paper structure</h2>
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
                              {group.parts.length === 1 ? "part" : "parts"} ·{" "}
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
                                            ].marks = Number(e.target.value);
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
                                          ["long_form", "Extended response"],
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
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-4 sm:px-6">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (step === "confirm" || step === "review") {
                setChangeKnown(true);
                setStep("details");
              } else {
                run.current++;
                onManual();
              }
            }}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {step === "details" ? "Manual editor" : "Change details"}
          </Button>
          {step === "details" ? (
            <Button onClick={reviewChoice}>
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : step === "confirm" ? (
            <Button
              disabled={
                busy ||
                (!presetId &&
                  !sourceId &&
                  !sourceUrl.trim() &&
                  !(sourceChoice === "upload" && upload) &&
                  sourceChoice !== "unverified") ||
                (!presetId &&
                  sourceChoice === "unverified" &&
                  mode === "full_mock")
              }
              onClick={() => void build()}
            >
              {busy ? "Building…" : "Yes, build it"}
              <Sparkles className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button
              disabled={busy || !!validation || !name.trim() || !proposalId}
              onClick={() => void save()}
            >
              {busy ? (proposalId ? "Saving…" : "Preparing…") : "Save profile"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
