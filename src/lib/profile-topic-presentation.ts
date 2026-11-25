export type ProfileTopicPresentationEdit = Readonly<{
  topic: string;
  label?: string;
  notes?: string;
}>;

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null;

/** Manual labels live in the existing blueprint, never in an AI template. */
function manualPresentationEdits(profile: RecordValue): readonly ProfileTopicPresentationEdit[] {
  if (!Array.isArray(profile.topics) || profile.topics.some(topic => typeof topic !== "string"))
    return [];
  const raw = record(profile.paper_blueprint)?.topicEdits;
  if (!Array.isArray(raw) || raw.length > profile.topics.length) return [];
  const counts = new Map<string, number>();
  for (const topic of profile.topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  const seen = new Set<string>();
  const edits: ProfileTopicPresentationEdit[] = [];
  for (const value of raw) {
    const edit = record(value);
    if (!edit || typeof edit.topic !== "string" || counts.get(edit.topic) !== 1 || seen.has(edit.topic) ||
      typeof edit.label !== "string" || !edit.label.trim() || edit.label.trim().length > 180)
      return [];
    seen.add(edit.topic);
    edits.push({ topic: edit.topic, label: edit.label.trim() });
  }
  return edits;
}

/** Accept a template, saved context, attempt snapshot, or profile JSON. */
function presentationEdits(value: unknown): readonly ProfileTopicPresentationEdit[] {
  let template = record(value);
  for (let depth = 0; template && depth < 4; depth++) {
    if (template.profile_template == null && "paper_blueprint" in template)
      return manualPresentationEdits(template);
    const nested = record(template.profile_template ?? template.template ?? template.context);
    if (!nested) break;
    template = nested;
  }
  if (!template || !Array.isArray(template.topics) || template.topics.length > 400)
    return [];
  const topics = new Map<string, number>();
  for (const topic of template.topics) {
    if (typeof topic !== "string" || !topic.trim() || topic.length > 180) return [];
    topics.set(topic, (topics.get(topic) ?? 0) + 1);
  }
  const raw = template.topicEdits;
  if (!Array.isArray(raw) || raw.length > 400) return [];
  const seen = new Set<string>();
  const edits: ProfileTopicPresentationEdit[] = [];
  let characters = 0;
  for (const value of raw) {
    const edit = record(value);
    if (!edit || typeof edit.topic !== "string" || topics.get(edit.topic) !== 1 || seen.has(edit.topic))
      return [];
    if (edit.label !== undefined &&
      (typeof edit.label !== "string" || !edit.label.trim() || edit.label.trim().length > 180))
      return [];
    if (edit.notes !== undefined && (typeof edit.notes !== "string" || edit.notes.length > 1000))
      return [];
    const label = typeof edit.label === "string" ? edit.label.trim() : undefined;
    const notes = typeof edit.notes === "string" ? edit.notes : undefined;
    characters += edit.topic.length + (label?.length ?? 0) + (notes?.length ?? 0);
    if (characters > 100_000) return [];
    seen.add(edit.topic);
    edits.push({ topic: edit.topic, label, notes });
  }
  return edits;
}

/** Display only: continue using `topic` for question tags, scores and saved identity. */
export function profileTopicLabel(profile: unknown, topic: string): string {
  return presentationEdits(profile).find(edit => edit.topic === topic)?.label ?? topic;
}

/** Private owner notes; absent/invalid metadata reads as empty text. */
export function profileTopicNotes(template: unknown, topic: string): string {
  return presentationEdits(template).find(edit => edit.topic === topic)?.notes ?? "";
}
