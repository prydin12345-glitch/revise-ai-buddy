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

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  subjectName: string;
  examBoard?: string | null;
  educationalLevel?: string | null;
  onManual: () => void;
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
const initialIdentity = (
  subject: string,
  board?: string | null,
  level?: string | null,
): TemplateIdentity => ({
  country: "",
  educationSystem: "",
  stage: "Secondary",
  qualification:
    level === "level3"
      ? "A-level"
      : level === "level2"
        ? "GCSE"
        : (level ?? ""),
  subject,
  organisation: board ?? "",
  course: "",
  component: "",
  specificationVersion: "",
  tier: null,
});
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
  onManual,
  initialProfile,
  api = invokeProfileBuilder,
}: Props) {
  const catalogue = approvalCatalogue();
  const [step, setStep] = useState<"details" | "review">("details");
  const [identity, setIdentity] = useState<TemplateIdentity>(() =>
    initialIdentity(subjectName, examBoard, educationalLevel),
  );
  const [mode, setMode] = useState<ProfileTemplate["mode"]>("short_practice");
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
      setIdentity(initialIdentity(subjectName, examBoard, educationalLevel));
      setMode("short_practice");
      setPresetId("");
      setProposal(null);
      setProposalId("");
      setTemplate(null);
      setName(initialProfile?.profile_name ?? "");
      setStep("details");
    }
    setSourceId("");
    setSourceUrl("");
    setUpload(null);
    setSourceChoice("source");
    return () => {
      run.current++;
    };
  }, [open, initialProfile, subjectName, examBoard, educationalLevel]);
  const close = () => {
    run.current++;
    onOpenChange(false);
  };
  const changeIdentity = (
    key: keyof TemplateIdentity,
    value: string | null,
  ) => {
    setIdentity((v) => {
      const next = { ...v, [key]: value };
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
        "Complete the course details, including its specification version. Unknown tier is allowed for practice.",
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
      if (!name.trim())
        setName(t.identity.subject + " · " + t.identity.component);
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
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
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
            {["details", "review"].map((s, i) => (
              <button
                key={s}
                type="button"
                disabled={busy || (s === "review" && !template)}
                onClick={() => setStep(s as typeof step)}
                aria-current={step === s ? "step" : undefined}
                className={`min-h-9 flex-1 rounded text-xs ${step === s ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}
              >
                {i + 1} · {s === "details" ? "Your course" : "Review & save"}
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
          {notice && (
            <p role="status" className="rounded-md bg-muted p-3 text-sm">
              {notice}
            </p>
          )}
          {step === "details" ? (
            <>
              <Field label="Start from an Examly-approved preset">
                {select(
                  presetId,
                  choosePreset,
                  [
                    ["", "Choose your own course"],
                    ...catalogue.map(
                      (e) =>
                        [
                          e.id,
                          `${e.organisation} ${e.qualification} ${e.subject} · ${e.component} · ${e.tier === "not_tiered" ? "Untiered" : e.tier} · ${e.mode === "full_mock" ? "Full mock" : "Short practice"}`,
                        ] as [string, string],
                    ),
                  ],
                  "Approved preset",
                )}
              </Field>
              {presetId && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ExamlyApprovalBadge
                    approval={{
                      status: "approved",
                      entry: approvedPreset(presetId).entry,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    No AI call needed
                  </span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["country", "Country"],
                    ["educationSystem", "Education system"],
                    ["qualification", "Qualification"],
                    ["subject", "Subject"],
                    ["organisation", "Board or institution"],
                    ["course", "Course / specification code"],
                    ["component", "Paper / unit / module"],
                    ["specificationVersion", "Specification / cohort version"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <Input
                      aria-label={label}
                      className="h-11"
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
                <Field label="Assessment tier">
                  {select(
                    identity.tier ?? "unknown",
                    (v) => changeIdentity("tier", v === "unknown" ? null : v),
                    [
                      ["unknown", "Unknown / not recorded"],
                      ["not_tiered", "Not tiered"],
                      ["foundation", "Foundation"],
                      ["higher", "Higher"],
                    ],
                    "Assessment tier",
                  )}
                </Field>
                {identity.stage === "University" && (
                  <>
                    <Field label="Institution">
                      <Input
                        aria-label="Institution"
                        value={identity.institution ?? ""}
                        onChange={(e) =>
                          changeIdentity("institution", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Module">
                      <Input
                        aria-label="Module"
                        value={identity.module ?? ""}
                        onChange={(e) =>
                          changeIdentity("module", e.target.value)
                        }
                      />
                    </Field>
                  </>
                )}
              </div>
              <Field label="Assessment mode">
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
              {!presetId && (
                <section className="space-y-3 border-t border-border pt-4">
                  <h2 className="font-serif text-lg">What should we use?</h2>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["source", "Official source"],
                        ["upload", "Upload syllabus"],
                        ["unverified", "General practice"],
                      ] as const
                    ).map(([id, label]) => (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant={sourceChoice === id ? "default" : "outline"}
                        aria-pressed={sourceChoice === id}
                        onClick={() => {
                          setSourceChoice(id);
                          setError("");
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  {sourceChoice === "source" ? (
                    <>
                      <Field label="Registered source">
                        {select(
                          sourceId,
                          chooseSource,
                          [
                            ["", "Choose a source"],
                            ...PROFILE_SOURCE_REGISTRY.map(
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
                          }}
                          placeholder="https://…"
                        />
                      </Field>
                      <p className="text-xs text-muted-foreground">
                        URLs currently resolve reviewed registered documents
                        only. New domains need repository review; you can upload
                        a syllabus instead.
                      </p>
                    </>
                  ) : sourceChoice === "upload" ? (
                    <>
                      <Field label="Syllabus or assessment brief">
                        <Input
                          aria-label="Syllabus or assessment brief"
                          type="file"
                          accept=".pdf,.txt,application/pdf,text/plain"
                          onChange={(e) => {
                            void readUpload(e.target.files?.[0]);
                          }}
                        />
                      </Field>
                      <p className="text-xs text-muted-foreground">
                        PDF or text, up to 3 MB. Scanned PDFs need a text
                        version. Evidence stays in your account.
                      </p>
                    </>
                  ) : (
                    <p className="rounded-md bg-warning-light p-3 text-sm">
                      Create an unverified general-practice draft. It may not
                      match your real assessment; full mock is unavailable
                      without evidence.
                    </p>
                  )}
                </section>
              )}
            </>
          ) : template && proposal ? (
            <>
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
                {template.identity.organisation} ·{" "}
                {template.identity.qualification} · {template.identity.course} ·{" "}
                {template.identity.component}{" "}
                {template.identity.tier &&
                template.identity.tier !== "not_tiered"
                  ? `· ${template.identity.tier}`
                  : ""}
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
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    {section.groups.map((group, gi) => (
                      <details
                        key={group.id}
                        className="rounded-lg border border-border bg-card"
                      >
                        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm">
                          Question {gi + 1} · {group.parts.length}{" "}
                          {group.parts.length === 1 ? "part" : "parts"} ·{" "}
                          {group.parts.reduce((n, p) => n + p.marks, 0)} marks
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
                                        t.sections[si].groups[gi].parts.splice(
                                          pi,
                                          1,
                                        );
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
                                        ].response = v as typeof part.response;
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
                                        ].resource = v as typeof part.resource;
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
              {validation && (
                <p
                  role="alert"
                  className="rounded-md border border-danger-border bg-danger-muted p-3 text-sm"
                >
                  {validation}
                </p>
              )}
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
                                d.locations.find((l) => l.id === c.locationId)
                                  ?.page
                              }
                              ,{" "}
                              {
                                d.locations.find((l) => l.id === c.locationId)
                                  ?.section
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
            </>
          ) : null}
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-4 sm:px-6">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (step === "review") setStep("details");
              else {
                run.current++;
                onManual();
              }
            }}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {step === "review" ? "Course details" : "Manual editor"}
          </Button>
          {step === "details" ? (
            <Button
              disabled={
                busy ||
                (!presetId &&
                  sourceChoice === "unverified" &&
                  mode === "full_mock")
              }
              onClick={() => {
                void build();
              }}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {busy ? "Building…" : "Build profile for me"}
            </Button>
          ) : (
            <Button
              disabled={busy || !!validation || !name.trim()}
              onClick={() => {
                void save();
              }}
            >
              {busy ? "Saving…" : "Confirm & save"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
