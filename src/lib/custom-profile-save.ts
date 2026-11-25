import type { ExamProfile } from "@/hooks/useSubjectProfiles";
import type { Json } from "@/integrations/supabase/types";

export interface ProfileSaveResult {
  ok: boolean;
  message?: string;
  /** Also returned after a partial create: retry by updating this row. */
  profileId?: string;
}

export type ProfileSavePayload = Omit<ExamProfile,
  "id" | "subject_name" | "created_at" | "updated_at" | "profile_template" | "paper_blueprint"
> & { paper_blueprint: Json | null; studied_texts: Json | null };

export interface ProfileAdvancedSettings {
  assessmentTier?: string | null;
  examBoard?: string | null;
  structurePreset?: string | null;
  mcqCount?: number | null;
  mcqPosition?: string | null;
  markDistribution?: Record<number, number> | null;
  includeExtended?: boolean | null;
  extendedMarks?: number | null;
  difficultyProgression?: string | null;
  calculatorPolicy?: string | null;
  studiedTexts?: Json | null;
  paperBlueprint?: Json | null;
  /** Lossless payload from the editor; only editable columns are accepted. */
  profilePatch?: Partial<ProfileSavePayload>;
}

export interface ProfileStructureSettings {
  questionStructure?: string | null;
  parentQuestionCount?: number | null;
  maxPartsPerQuestion?: number | null;
  mcqOptionsCount?: number | null;
  includeGraphs?: boolean | null;
  includeTables?: boolean | null;
}

export type ProfileSaveArgs = [
  profileName: string,
  topics: string[],
  questionCount: number,
  educationalTier?: string | null,
  timeLimitMinutes?: number | null,
  advanced?: ProfileAdvancedSettings,
  writtenQuestionCount?: number | null,
  structureSettings?: ProfileStructureSettings,
];

const defaults: ProfileSavePayload = {
  profile_name: "", topics: [], question_count: 0, educational_tier: null,
  time_limit_minutes: null, structure_preset: "custom", mcq_count: 0,
  mcq_position: "start", mark_distribution: {}, include_extended: false,
  extended_marks: 0, difficulty_progression: "ascending", calculator_policy: "allowed",
  written_question_count: 0, question_structure: "standalone", parent_question_count: 4,
  max_parts_per_question: 3, mcq_options_count: 4, include_graphs: false,
  include_tables: false, studied_texts: null, paper_blueprint: null,
  exam_board: null, assessment_tier: null,
};
const fields = Object.keys(defaults) as (keyof ProfileSavePayload)[];
type PayloadInput = Partial<Record<keyof ProfileSavePayload, unknown>>;
const owns = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const orDefault = <T>(value: T | undefined, fallback: T): T => value === undefined ? fallback : value;

/** The single mapping used by both create and update, including the editor patch. */
export function buildCustomProfilePayload(...[
  profileName, topics, questionCount, educationalTier, timeLimitMinutes,
  advanced, writtenQuestionCount, structure,
]: ProfileSaveArgs): ProfileSavePayload {
  const payload: ProfileSavePayload = {
    profile_name: profileName,
    topics,
    question_count: questionCount,
    educational_tier: orDefault(educationalTier, null),
    time_limit_minutes: orDefault(timeLimitMinutes, null),
    structure_preset: orDefault(advanced?.structurePreset, "custom"),
    mcq_count: orDefault(advanced?.mcqCount, 0),
    mcq_position: orDefault(advanced?.mcqPosition, "start"),
    mark_distribution: orDefault(advanced?.markDistribution, {}),
    include_extended: orDefault(advanced?.includeExtended, false),
    extended_marks: orDefault(advanced?.extendedMarks, 0),
    difficulty_progression: orDefault(advanced?.difficultyProgression, "ascending"),
    calculator_policy: orDefault(advanced?.calculatorPolicy, "allowed"),
    written_question_count: orDefault(writtenQuestionCount, questionCount - (advanced?.mcqCount ?? 0)),
    question_structure: orDefault(structure?.questionStructure, "standalone"),
    parent_question_count: orDefault(structure?.parentQuestionCount, 4),
    max_parts_per_question: orDefault(structure?.maxPartsPerQuestion, 3),
    mcq_options_count: orDefault(structure?.mcqOptionsCount, 4),
    include_graphs: orDefault(structure?.includeGraphs, false),
    include_tables: orDefault(structure?.includeTables, false),
    studied_texts: orDefault(advanced?.studiedTexts, null),
    paper_blueprint: orDefault(advanced?.paperBlueprint, null),
    exam_board: orDefault(advanced?.examBoard, null),
    assessment_tier: orDefault(advanced?.assessmentTier, null),
  };
  for (const field of fields) {
    if (advanced?.profilePatch && owns(advanced.profilePatch, field) && advanced.profilePatch[field] !== undefined) {
      Object.assign(payload, { [field]: advanced.profilePatch[field] });
    }
  }
  return payload;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, i) => equal(value, right[i]));
  }
  if (!isObject(left) || !isObject(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => owns(right, key) && equal(left[key], right[key]));
}

/** Apply only differences visible in the editor, keeping unrepresented saved metadata. */
function patchValue(saved: unknown, opening: unknown, current: unknown, key = "", guided = false): unknown {
  if (!guided && equal(opening, current)) return saved === undefined ? current : saved;
  if (isObject(current) && (isObject(opening) || opening == null)) {
    const before = isObject(opening) ? opening : {};
    const original = isObject(saved) ? saved : {};
    const result = { ...original };
    for (const field of new Set([...Object.keys(before), ...Object.keys(current)])) {
      if (!owns(current, field)) delete result[field];
      else result[field] = patchValue(original[field], before[field], current[field], field, guided);
    }
    return result;
  }
  // Other arrays are atomic. Stable section/question slots retain extra saved fields.
  if ((key === "sections" || key === "questions") && Array.isArray(saved) &&
      Array.isArray(opening) && Array.isArray(current) &&
      saved.length === opening.length && opening.length === current.length) {
    const permutation = current.map(value => {
      const matches = opening.flatMap((item, index) => equal(item, value) ? [index] : []);
      return matches.length === 1 ? matches[0] : -1;
    });
    const reordered = permutation.every(index => index >= 0) && new Set(permutation).size === current.length;
    return current.map((value, i) => {
      const id = isObject(value) ? value.id : undefined;
      const identified = id !== undefined && opening.some(item => isObject(item) && owns(item, "id"));
      const matches = opening.flatMap((item, index) =>
        identified && isObject(item) && item.id === id ? [index] : []);
      const matching = matches.includes(i) ? i : matches.length === 1 ? matches[0] : -1;
      // A reordered item carries its own metadata. A replacement with a new ID
      // cannot inherit metadata from the previous occupant of this array slot.
      if (identified && matching < 0) return value;
      const source = identified ? matching : reordered ? permutation[i] : i;
      return patchValue(saved[source], opening[source], value, "", guided);
    });
  }
  return current;
}

const guidedBlueprintFields = [
  "sections", "courseSelection", "paperContract", "responseFormats",
  "visualAssessment", "biologyBCustomSettings",
];
const guidedObjectFields: Record<string, string[]> = {
  courseSelection: ["courseId", "paperId", "specificationVersion"],
  paperContract: ["courseId", "paperId", "mode", "contractVersion", "specificationVersion"],
};

function preserveBlueprint(saved: unknown, opening: unknown, current: unknown, guided: boolean): Json | null {
  if (!guided && equal(opening, current)) return (saved === undefined ? current : saved) as Json ?? null;
  if ((isObject(opening) || opening == null) && (isObject(current) || current == null)) {
    const before = { ...(isObject(opening) ? opening : {}) };
    if (guided && isObject(saved)) {
      // Guided conversion explicitly replaces/removes generated contract settings.
      for (const field of guidedBlueprintFields) {
        const original = saved[field];
        if (guidedObjectFields[field] && isObject(original)) {
          const visible = { ...(isObject(before[field]) ? before[field] : {}) };
          for (const ownedField of guidedObjectFields[field]) {
            if (!owns(visible, ownedField) && owns(original, ownedField)) visible[ownedField] = original[ownedField];
          }
          before[field] = visible;
        } else if (!owns(before, field) && owns(saved, field)) {
          before[field] = undefined;
        }
      }
    }
    const after = (current ?? {}) as Record<string, unknown>;
    const patched = patchValue(saved, before, after);
    const result = { ...(isObject(patched) ? patched : {}) };
    if (guided) {
      const original = isObject(saved) ? saved : {};
      for (const field of guidedBlueprintFields) {
        if (!owns(after, field)) delete result[field];
        else if (guidedObjectFields[field] && isObject(after[field])) {
          const nested = result[field];
          const owned = { ...(isObject(nested) ? nested : {}) };
          for (const ownedField of guidedObjectFields[field]) {
            if (owns(after[field], ownedField)) owned[ownedField] = after[field][ownedField];
            else delete owned[ownedField];
          }
          result[field] = owned;
        } else {
          result[field] = patchValue(original[field], before[field], after[field], field, true);
        }
      }
    }
    return Object.keys(result).length ? result as Json : null;
  }
  return patchValue(saved, opening, current) as Json;
}

/**
 * Capture opening after hydration, before edits. Inputs use database column names
 * (the modal's approvalSettings shape). No IDs, ownership, or template fields escape.
 * Guided conversions own known generated fields even when their UI values match.
 */
export function preserveCustomProfilePayload(
  initial: PayloadInput | null | undefined,
  opening: PayloadInput,
  current: PayloadInput,
  { mode = "custom", blueprintConfigurationChanged = false }: {
    mode?: "custom" | "guided";
    /** Explicit course/level/tier/paper changes invalidate stored contracts only. */
    blueprintConfigurationChanged?: boolean;
  } = {},
): ProfileSavePayload {
  const result = { ...defaults };
  for (const field of fields) {
    const hasCurrent = owns(current, field) && current[field] !== undefined;
    const hasSaved = initial && owns(initial, field) && initial[field] !== undefined;
    let value = hasCurrent ? current[field] : hasSaved ? initial[field] : defaults[field];
    if (hasSaved && mode === "custom" && equal(opening[field], current[field])) value = initial[field];
    if (field === "paper_blueprint" && hasCurrent) {
      value = preserveBlueprint(initial?.[field], opening[field], current[field], mode === "guided" || blueprintConfigurationChanged);
    }
    Object.assign(result, { [field]: value });
  }
  return result;
}
