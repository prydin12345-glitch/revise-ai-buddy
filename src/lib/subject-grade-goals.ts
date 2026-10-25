import { ALL_SCALES, getScale, gradeRank, type GradeScaleId } from "./grade-scales";
import type { SubjectGradeSettings } from "@/hooks/useGradeSettings";

/** Personal baseline and goals are browser-local; earned grades are never stored here. */
export interface SubjectGradeGoal extends SubjectGradeSettings {
  startingGrade?: string;
  startingPercentage?: number;
  targetPercentage?: number;
}

const PREFIX = "examly.subjectGradeGoals.v1:";
const EMPTY: SubjectGradeGoal = Object.freeze({});
const memory = new Map<string, SubjectGradeGoal>();
const snapshots = new Map<string, { raw: string | null; goal: SubjectGradeGoal }>();
const listeners = new Set<() => void>();

export const subjectGradeGoalKey = (ownerId: string, subjectId: string) =>
  `${PREFIX}${encodeURIComponent(ownerId)}:${encodeURIComponent(subjectId)}`;

const percentage = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value : undefined;

/** Reject malformed browser values instead of turning them into score/grade claims. */
export function sanitiseSubjectGradeGoal(value: unknown): SubjectGradeGoal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const scaleId = ALL_SCALES.some(scale => scale.id === raw.scaleId)
    ? raw.scaleId as GradeScaleId : undefined;
  const scale = getScale(scaleId);
  const tierId = typeof raw.tierId === "string" && scale.tiers?.some(tier => tier.id === raw.tierId)
    ? raw.tierId : undefined;
  const permitted = (grade: unknown) => typeof grade === "string" && availableGoalGrades(scale.id, tierId).includes(grade);
  const bounds: Record<string, number> = {};
  if (raw.boundaries && typeof raw.boundaries === "object" && !Array.isArray(raw.boundaries)) {
    for (const [grade, value] of Object.entries(raw.boundaries)) {
      const pct = percentage(value);
      if (scale.grades.includes(grade) && pct !== undefined) bounds[grade] = pct;
    }
  }
  return {
    ...(scaleId ? { scaleId } : {}),
    ...(tierId ? { tierId } : {}),
    ...(typeof raw.startingGrade === "string" && scale.grades.includes(raw.startingGrade) ? { startingGrade: raw.startingGrade } : {}),
    ...(permitted(raw.targetGrade) ? { targetGrade: raw.targetGrade as string } : {}),
    ...(percentage(raw.startingPercentage) !== undefined ? { startingPercentage: raw.startingPercentage as number } : {}),
    ...(percentage(raw.targetPercentage) !== undefined ? { targetPercentage: raw.targetPercentage as number } : {}),
    ...(Object.keys(bounds).length ? { boundaries: bounds } : {}),
  };
}

export function subjectGradeGoalError(goal: SubjectGradeGoal): string | null {
  const numbers = [goal.startingPercentage, goal.targetPercentage, ...Object.values(goal.boundaries ?? {})].filter(value => value !== undefined);
  if (numbers.some(value => percentage(value) === undefined)) return "Percentages must be between 0 and 100.";
  const scale = getScale(goal.scaleId);
  const bounds = { ...scale.defaultBoundaries, ...(goal.boundaries ?? {}) };
  const ordered = scale.grades.map(grade => bounds[grade]).filter((value): value is number => typeof value === "number");
  if (ordered.some((value, index) => index > 0 && value >= ordered[index - 1])) return "Each higher grade needs a higher minimum percentage.";
  return null;
}

export function readSubjectGradeGoal(ownerId: string | null, subjectId: string): SubjectGradeGoal {
  if (!ownerId || !subjectId) return EMPTY;
  const key = subjectGradeGoalKey(ownerId, subjectId);
  if (memory.has(key)) return memory.get(key)!;
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return snapshots.get(key)?.goal ?? EMPTY; }
  const cached = snapshots.get(key);
  if (cached?.raw === raw) return cached.goal;
  let goal = EMPTY;
  if (raw) {
    try {
      const record = JSON.parse(raw);
      if (record.version === 1 && record.ownerId === ownerId && record.subjectId === subjectId) {
        goal = Object.freeze(sanitiseSubjectGradeGoal(record.goal));
      }
    } catch { /* A malformed browser record is not a saved goal. */ }
  }
  snapshots.set(key, { raw, goal });
  return goal;
}

/** Full goal replacement; a storage failure retains this account's session value. */
export function saveSubjectGradeGoal(ownerId: string | null, subjectId: string, goal: SubjectGradeGoal): boolean {
  if (!ownerId || !subjectId) return false;
  const key = subjectGradeGoalKey(ownerId, subjectId);
  const clean = Object.freeze(sanitiseSubjectGradeGoal(goal));
  const raw = JSON.stringify({ version: 1, ownerId, subjectId, goal: clean });
  let persisted = true;
  try { localStorage.setItem(key, raw); memory.delete(key); } catch { memory.set(key, clean); persisted = false; }
  snapshots.set(key, { raw, goal: clean });
  listeners.forEach(listener => listener());
  return persisted;
}

export function subscribeSubjectGradeGoals(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) {
      if (event.key) { memory.delete(event.key); snapshots.delete(event.key); }
      else { memory.clear(); snapshots.clear(); }
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export function availableGoalGrades(scaleId: GradeScaleId, tierId?: string) {
  const scale = getScale(scaleId);
  const tier = scale.tiers?.find(item => item.id === tierId);
  const cap = tier ? gradeRank(scale, tier.maxGrade) : 0;
  return scale.grades.slice(Math.max(0, cap));
}

/** Useful when a user intentionally chooses a different scale/tier in the editor. */
export function goalForScale(goal: SubjectGradeGoal, scaleId: GradeScaleId, tierId?: string): SubjectGradeGoal {
  const grades = availableGoalGrades(scaleId, tierId);
  const sameScale = !goal.scaleId || goal.scaleId === scaleId;
  return sanitiseSubjectGradeGoal({
    scaleId, tierId,
    startingGrade: sameScale && getScale(scaleId).grades.includes(goal.startingGrade ?? "") ? goal.startingGrade : undefined,
    targetGrade: grades.includes(goal.targetGrade ?? "") ? goal.targetGrade : undefined,
    startingPercentage: scaleId === "percentage" ? goal.startingPercentage : undefined,
    targetPercentage: scaleId === "percentage" ? goal.targetPercentage : undefined,
    boundaries: goal.scaleId === scaleId ? goal.boundaries : undefined,
  });
}
