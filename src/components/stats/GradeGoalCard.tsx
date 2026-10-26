import { useEffect, useId, useState } from "react";
import { Check, Pencil } from "lucide-react";
import "@/styles/stats-grade-goal.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALL_SCALES, boundariesFor, getScale, projectGrade, type GradeScaleId } from "@/lib/grade-scales";
import { availableGoalGrades, goalForScale, sanitiseSubjectGradeGoal, subjectGradeGoalError, type SubjectGradeGoal } from "@/lib/subject-grade-goals";
import { useSubjectGradeGoals } from "@/hooks/useSubjectGradeGoals";
import { useGradeSettings } from "@/hooks/useGradeSettings";

const pct = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
const display = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

export function GoalFields({ value, onChange, compact = false, fixedScaleId, fixedTierId }: {
  value: SubjectGradeGoal;
  onChange: (value: SubjectGradeGoal) => void;
  compact?: boolean;
  fixedScaleId?: GradeScaleId;
  fixedTierId?: string;
}) {
  const id = useId();
  const scaleId = value.scaleId ?? "percentage";
  const scale = getScale(scaleId);
  const grades = availableGoalGrades(scaleId, value.tierId);
  const updateNumber = (key: "startingPercentage" | "targetPercentage", raw: string) => {
    const number = raw === "" ? undefined : Number(raw);
    onChange({ ...value, [key]: number });
  };
  return <div className="stats-goal-fields space-y-4">
    <div className={compact ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "space-y-4"}>
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold" htmlFor={`${id}-starting`}>Starting {scale.grades.length ? "grade" : "percentage"} <span className="font-normal text-muted-foreground">(optional)</span></label>
        {scale.grades.length ? <select id={`${id}-starting`} className="stats-goal-select w-full min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" value={value.startingGrade ?? ""} onChange={event => onChange({ ...value, startingGrade: event.target.value || undefined })}>
          <option value="">Not sure yet</option>{scale.grades.map(grade => <option key={grade} value={grade}>{grade}</option>)}
        </select> : <Input id={`${id}-starting`} type="number" min="0" max="100" step="0.1" value={value.startingPercentage ?? ""} placeholder="Not set" onChange={event => updateNumber("startingPercentage", event.target.value)} />}
        <p className="text-[11px] leading-relaxed text-muted-foreground">Your baseline, set by you.</p>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold" htmlFor={`${id}-target`}>Target {scale.grades.length ? "grade" : "percentage"} <span className="font-normal text-muted-foreground">(optional)</span></label>
        {scale.grades.length ? <select id={`${id}-target`} className="stats-goal-select w-full min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" value={value.targetGrade ?? ""} onChange={event => onChange({ ...value, targetGrade: event.target.value || undefined, targetPercentage: undefined })}>
          <option value="">Choose a target</option>{grades.map(grade => <option key={grade} value={grade}>{grade}</option>)}
        </select> : <Input id={`${id}-target`} type="number" min="0" max="100" step="0.1" value={value.targetPercentage ?? ""} placeholder="For example, 80" onChange={event => updateNumber("targetPercentage", event.target.value)} />}
      </div>
    </div>
    <details className="rounded-lg border border-border px-3 text-xs">
      <summary className="cursor-pointer py-3 font-medium text-primary">Grade scale & boundaries</summary>
      <div className="space-y-4 pb-4">
        <div className="space-y-1.5"><label htmlFor={`${id}-scale`} className="block font-semibold">Grade scale</label><select id={`${id}-scale`} className="stats-goal-select w-full min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" value={scaleId} disabled={!!fixedScaleId} onChange={event => onChange(goalForScale(value, event.target.value as GradeScaleId))}>{ALL_SCALES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{fixedScaleId && <p className="text-[11px] text-muted-foreground">Uses the selected course’s grade scale.</p>}</div>
        {scale.tiers && <div className="space-y-1.5"><label htmlFor={`${id}-tier`} className="block font-semibold">Tier</label><select id={`${id}-tier`} className="stats-goal-select w-full min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" value={value.tierId ?? ""} disabled={!!fixedTierId} onChange={event => onChange(goalForScale(value, scaleId, event.target.value || undefined))}><option value="">Not set</option>{scale.tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.label}</option>)}</select>{fixedTierId && <p className="text-[11px] text-muted-foreground">The selected exam profile sets this tier.</p>}</div>}
        {scale.grades.length > 0 && <>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Indicative boundaries · Saved on this browser</p>
          <div className="grid grid-cols-3 gap-3">{grades.filter(grade => scale.defaultBoundaries[grade] !== undefined).map(grade => <div key={grade}><label htmlFor={`${id}-boundary-${grade}`} className="mb-1 block text-[11px]">{grade} minimum %</label><Input id={`${id}-boundary-${grade}`} type="number" min="0" max="100" step="0.1" placeholder={String(scale.defaultBoundaries[grade])} value={value.boundaries?.[grade] ?? ""} onChange={event => {
            const next = { ...(value.boundaries ?? {}) };
            if (event.target.value === "") delete next[grade];
            else next[grade] = Number(event.target.value);
            onChange({ ...value, boundaries: next });
          }} /></div>)}</div>
        </>}
      </div>
    </details>
  </div>;
}

export interface GradeGoalCardProps {
  ownerId: string | null;
  subjectId: string;
  subject: string;
  averageScore: number | null;
  defaultScaleId?: GradeScaleId;
  defaultTierId?: string;
  profileLabel?: string;
  targetPercentage?: number | null;
}

export function GradeGoalCard({ ownerId, subjectId, subject, averageScore, defaultScaleId, defaultTierId, profileLabel, targetPercentage }: GradeGoalCardProps) {
  const { goal: stored, save } = useSubjectGradeGoals(ownerId, subjectId);
  const legacy = useGradeSettings();
  const oldBrowser = legacy.get(subject);
  const canImport = Object.keys(oldBrowser).length > 0 && !stored.targetGrade && pct(stored.targetPercentage) === null;
  const incompatibleScale = !!defaultScaleId && !!stored.scaleId && defaultScaleId !== stored.scaleId;
  const goal: SubjectGradeGoal = {
    ...stored,
    ...(incompatibleScale ? { startingGrade: undefined, startingPercentage: undefined, targetGrade: undefined, targetPercentage: undefined, boundaries: undefined } : {}),
    scaleId: defaultScaleId ?? stored.scaleId ?? "percentage",
    tierId: defaultTierId ?? stored.tierId,
  };
  const scale = getScale(goal.scaleId);
  const bounds = boundariesFor(scale, goal.boundaries);
  const grades = availableGoalGrades(scale.id, goal.tierId);
  const current = pct(averageScore);
  const projection = current === null ? null : projectGrade(current, scale, { overrides: goal.boundaries, tierId: goal.tierId });
  const tier = scale.tiers?.find(item => item.id === goal.tierId);
  const gradeTarget = goal.targetGrade && scale.grades.includes(goal.targetGrade) ? goal.targetGrade : null;
  const targetAboveCap = !!gradeTarget && !grades.includes(gradeTarget);
  const target = gradeTarget ? pct(bounds[gradeTarget] ?? (gradeTarget === scale.grades[scale.grades.length - 1] ? 0 : null)) : pct(goal.targetPercentage) ?? pct(targetPercentage);
  const starting = goal.startingGrade ?? (pct(goal.startingPercentage) !== null ? `${display(goal.startingPercentage!)}%` : "Not set");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SubjectGradeGoal>(goal);
  const [error, setError] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  useEffect(() => { setOpen(false); setError(null); setStorageNote(null); }, [ownerId, subjectId]);
  const edit = () => { setDraft(goalForScale(goal, scale.id, goal.tierId)); setError(null); setOpen(true); };
  const saveDraft = () => {
    const invalid = subjectGradeGoalError(draft);
    if (invalid) { setError(invalid); return; }
    const clean = sanitiseSubjectGradeGoal(draft);
    const persisted = save(clean);
    setStorageNote(persisted ? null : "Your goal is available for this session. This browser couldn’t save it for next time.");
    setOpen(false);
  };
  const importOld = () => {
    const imported = sanitiseSubjectGradeGoal({ ...goal, ...oldBrowser });
    const persisted = save(imported);
    setStorageNote(persisted ? "Previous browser settings copied to this account and subject." : "Previous settings are available for this session only.");
  };
  const reached = current !== null && target !== null && current >= target;
  return <>
    <section className="subject-stats-card stats-grade-goal stats-grade-goal-v2" aria-label={`${subject} grade goal`}>
      <header className="subject-stats-card-heading stats-goal-heading">
        <div className="stats-goal-title"><h2>Your grade goal</h2></div>
        <Button variant="ghost" size="sm" onClick={edit} disabled={!ownerId}><Pencil aria-hidden="true"/>Edit goal</Button>
      </header>
      <div className="stats-grade-summary">
        <div className="stats-goal-start"><span>Starting {scale.grades.length ? "grade" : "percentage"}</span><strong>{starting}</strong></div>
        <div className="stats-goal-current"><span>Current estimate</span><strong>{current === null ? "—" : projection?.grade ?? `${display(current)}%`}{current !== null && projection?.grade && <small>{display(current)}%</small>}</strong>{profileLabel && <span className="stats-goal-profile">{profileLabel}</span>}</div>
        <div className="stats-goal-target"><span>Your target</span><strong>{gradeTarget ?? (target !== null ? `${display(target)}%` : "Not set")}</strong></div>
      </div>
      <div className="stats-grade-bar-wrap">
        {target !== null && <span className="stats-grade-target-label" style={{ left: `${Math.max(7, Math.min(93, target))}%` }}>Target {gradeTarget ?? `${display(target)}%`}</span>}
        <div className="stats-grade-progress" role={current === null ? "img" : "meter"} aria-label={current === null ? "No marked exam estimate yet" : `${subject} current exam percentage`} aria-valuemin={current === null ? undefined : 0} aria-valuemax={current === null ? undefined : 100} aria-valuenow={current ?? undefined}>
          <span style={{ width: `${current ?? 0}%` }} />{target !== null && <i style={{ left: `${target}%` }} aria-label={`Target at ${display(target)}%`} />}
        </div>
        <div className="stats-grade-ticks" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
      </div>
      <footer className="stats-grade-footer" data-reached={reached || undefined}>
        {reached && <Check aria-hidden="true"/>}<span>{current === null ? "No marked exam results yet" : target === null ? "No target set" : reached ? "Target reached" : `${display(target - current)} percentage points to target`}</span>
      </footer>
      {targetAboveCap && <p className="stats-card-note">This profile’s {tier?.label.toLowerCase()} caps estimates at {tier?.maxGrade}. Your subject target remains {gradeTarget}.</p>}
      {incompatibleScale && <p className="stats-card-note">Your saved goal uses {getScale(stored.scaleId).label}. This course uses {scale.label}; edit the goal to choose matching settings.</p>}
      {canImport && <Button variant="link" size="sm" onClick={importOld} disabled={!ownerId}>Use previous browser settings</Button>}
      {storageNote && <p role="status" className="stats-card-note">{storageNote}</p>}
    </section>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="stats-grade-dialog max-h-[88dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>Your starting point & goal</DialogTitle><DialogDescription>{subject} · Personal grade settings</DialogDescription></DialogHeader>
        <GoalFields value={draft} onChange={setDraft} fixedScaleId={defaultScaleId} fixedTierId={defaultTierId} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={saveDraft} disabled={!ownerId}>Save goal</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
