import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import type { ProfileTemplate } from "../../../supabase/functions/_shared/profile-template";
import type { ProfileEvidence } from "../../../supabase/functions/_shared/profile-evidence";

const fieldNames: Record<string, string> = { marks: "Total marks", durationMinutes: "Time allowed",
  topics: "Syllabus topics", tier: "Assessment tier", calculator: "Calculator",
  formats: "Question formats", selection: "Question choices", mathsRequirement: "Mathematical skills",
  practicalRequirement: "Practical skills" };

export function AIProfileSource({ template, evidence, status, actions }: {
  template: ProfileTemplate; evidence: ProfileEvidence | null; status: ReactNode; actions: ReactNode;
}) {
  const identity = template.identity;
  const details = [
    ["Course / specification code", identity.course], ["Paper / assessment code", identity.component],
    ["Syllabus edition", identity.specificationVersion], ["Assessment tier", identity.tier === "not_tiered" ? "Untiered" : identity.tier ?? "Not established"],
    ["Country", identity.country], ["Education system", identity.educationSystem], ["Stage", identity.stage],
    ["Qualification", identity.qualification], ["Subject", identity.subject], ["Organisation", identity.organisation],
    ...(identity.institution ? [["Institution", identity.institution]] : []),
    ...(identity.module ? [["Module", identity.module]] : []),
  ];
  return <div className="space-y-5">
    <div>{status}</div>
    {evidence ? evidence.documents.map(document => <article key={document.id} className="rounded-xl border border-border bg-background/40 p-4">
      <p className="flex min-w-0 items-start gap-2 text-sm font-semibold">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 break-words">{document.url ? <a href={document.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{document.title}</a> : document.title}</span>
      </p>
      <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">{document.version} · {document.authority === "official_registered" ? "Reviewed official source" : "User-supplied course evidence"} · {document.state}</p>
      <p className="mt-1 break-words text-xs text-muted-foreground">{document.applicableCohort}</p>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer content-center text-xs font-medium">Assessment references</summary>
        <ul className="mt-2 space-y-3 border-t border-border pt-3 text-xs leading-relaxed">
          {evidence.claims.filter(claim => claim.documentId === document.id).map((claim, index) => {
            const location = document.locations.find(location => location.id === claim.locationId);
            return <li key={index} className="break-words">
              <p className="font-medium">{fieldNames[claim.field] ?? claim.field} · PDF page {location?.page}</p>
              <p className="text-muted-foreground">{location?.section} · {claim.rule}</p>
              <blockquote className="mt-1 border-l-2 border-border pl-3">{claim.quote}</blockquote>
            </li>;
          })}
        </ul>
      </details>
    </article>) : <p className="rounded-xl border border-border p-4 text-sm leading-relaxed text-muted-foreground">This profile was made without verified source evidence. Its topic names remain available; source pages and learning points cannot be recovered from model knowledge alone.</p>}
    <details className="rounded-xl border border-border p-4">
      <summary className="min-h-8 cursor-pointer content-center text-sm font-medium">Course details</summary>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">{details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
    </details>
    {evidence && <details className="rounded-xl border border-border p-4">
      <summary className="min-h-8 cursor-pointer content-center text-sm font-medium">Assessment details from the source</summary>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">{[
        ["Total marks", evidence.facts.marks ?? "Not established"],
        ["Time allowed", evidence.facts.durationMinutes === null ? "Not established" : `${evidence.facts.durationMinutes} minutes`],
        ["Calculator", evidence.facts.calculator === "unknown" ? "Not established" : evidence.facts.calculator === "allowed" ? "Allowed" : "Not allowed"],
        ["Question formats", evidence.facts.formats.map(format => ({ mcq_single: "Multiple choice", short_answer: "Short answer", long_form: "Extended response" })[format]).join(", ") || "Not established"],
        ["Question choices", evidence.facts.selection === "unknown" ? "Not established" : evidence.facts.selection === "all_compulsory" ? "All questions compulsory" : "Optional questions"],
        ...(evidence.facts.mathsRequirement ? [["Mathematical skills", evidence.facts.mathsRequirement]] : []),
        ...(evidence.facts.practicalRequirement ? [["Practical skills", evidence.facts.practicalRequirement]] : []),
      ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
    </details>}
    {!!template.warnings.length && <div className="rounded-xl border border-border p-4"><h4 className="text-sm font-medium">Profile notes</h4><ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">{template.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    {evidence && !!(evidence.unresolved.length || evidence.conflicts.length) && <div className="rounded-xl bg-warning-light p-4"><h4 className="text-sm font-medium">Source details to check</h4><ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed">{[...evidence.unresolved, ...evidence.conflicts].map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    <div className="space-y-3 border-t border-border pt-4">{actions}</div>
  </div>;
}
