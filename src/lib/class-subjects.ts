/** Presentation only: class writers have historically saved both names and objects. */
export interface ClassSubjectLabel {
  name: string;
  color?: string;
}

interface KnownClassSubject {
  id: string;
  subject_id?: string | null;
  subject_name: string;
  subject_color: string;
}

export const NO_KNOWN_CLASS_SUBJECTS: KnownClassSubject[] = [];
const subjectId = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Resolve legacy IDs only from already-loaded user subjects; never show raw IDs. */
export function classSubjectLabels(value: unknown, known: readonly KnownClassSubject[] = NO_KNOWN_CLASS_SUBJECTS): ClassSubjectLabel[] {
  if (!Array.isArray(value)) return [];
  const labels: ClassSubjectLabel[] = [];
  for (const entry of value) {
    const rawName = typeof entry === "string" ? entry : entry && typeof entry === "object" ? entry.name : undefined;
    if (typeof rawName !== "string" || !rawName.trim()) continue;
    const name = rawName.trim();
    const isId = subjectId.test(name);
    const saved = known.find(subject => isId
      ? subject.id === name || subject.subject_id === name
      : subject.subject_name.toLowerCase() === name.toLowerCase());
    if (isId && !saved) continue;
    const resolvedName = saved?.subject_name || name;
    if (labels.some(label => label.name.toLowerCase() === resolvedName.toLowerCase())) continue;
    const color = typeof entry === "object" && typeof entry.color === "string" && entry.color.trim()
      ? entry.color : saved?.subject_color;
    labels.push({ name: resolvedName, ...(color ? { color } : {}) });
  }
  return labels;
}
