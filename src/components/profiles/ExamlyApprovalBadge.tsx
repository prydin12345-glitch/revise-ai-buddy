import { Star } from "lucide-react";
import {
  evaluateApproval,
  APPROVAL_REGISTRY,
  approvedPreset,
  type ApprovalResult,
} from "../../../supabase/functions/_shared/preset-approval";
import type { TemplateOrigin } from "../../../supabase/functions/_shared/profile-template";

export const ORIGIN_LABELS: Record<TemplateOrigin, string> = {
  catalogue: "Examly catalogue",
  source_backed_ai: "Source-backed AI draft",
  model_knowledge_ai: "Unverified AI draft",
  manual: "Custom profile",
};
const meaning =
  "Reviewed and approved by Examly's founder. This is not exam-board endorsement or a guarantee about every generated question.";
export function ExamlyApprovalBadge({
  approval,
  origin,
  focusable = true,
}: {
  approval: ApprovalResult;
  origin?: TemplateOrigin;
  focusable?: boolean;
}) {
  if (approval.status === "approved" || approval.status === "superseded")
    return (
      <span
        tabIndex={focusable ? 0 : undefined}
        title={meaning}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-warning-light px-2 py-1 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Star
          role="img"
          aria-label="Examly-approved preset"
          className="h-3.5 w-3.5 shrink-0 fill-warning text-warning"
        />
        <span>
          {approval.status === "superseded"
            ? "Older Examly-approved preset"
            : "Examly-approved preset"}
        </span>
        <span className="sr-only">{meaning}</span>
      </span>
    );
  const text =
    approval.status === "customised"
      ? "Customised from an Examly-approved preset"
      : approval.status === "revoked"
        ? "Preset approval revoked"
        : origin
          ? ORIGIN_LABELS[origin]
          : "Custom profile";
  return <span className="text-xs text-muted-foreground">{text}</span>;
}
export function ProfileApprovalBadge({
  profile,
  focusable = true,
}: {
  profile: unknown;
  focusable?: boolean;
}) {
  const p = profile as Record<string, any>;
  return (
    <ExamlyApprovalBadge
      approval={evaluateApproval(p, p.profile_template?.presetId)}
      origin={p.profile_template?.origin}
      focusable={focusable}
    />
  );
}
/** Only an exact component, tier, mode and version can display a star. */
export function PresetOptionBadge({
  courseId,
  paperId,
  tier,
  mode,
  contractVersion,
}: {
  courseId?: string | null;
  paperId?: string | null;
  tier?: string | null;
  mode?: string;
  contractVersion?: number;
}) {
  const entry = APPROVAL_REGISTRY.find(
    (e) =>
      e.course === courseId &&
      e.paper === paperId &&
      e.tier === tier &&
      e.mode === mode &&
      (contractVersion !== undefined
        ? e.contractVersion === contractVersion
        : e.recommended),
  );
  if (
    !entry ||
    !["approved", "superseded"].includes(entry.status) ||
    !entry.approvalRecord
  )
    return null;
  try {
    approvedPreset(entry.id);
  } catch {
    return null;
  }
  return (
    <ExamlyApprovalBadge
      approval={{ status: entry.status as "approved" | "superseded", entry }}
    />
  );
}
