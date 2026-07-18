import {
  Atom, Brain, FlaskConical, Calculator, BookOpen, Globe2, Landmark,
  ScrollText, Dna, Leaf, Scale, Code2, PenTool, Music4, Church,
  LineChart, Languages, Drama, HeartPulse, Hammer, type LucideIcon,
} from "lucide-react";

/** Curated symbol pool — every entry is selectable by the user. */
export const SUBJECT_ICON_POOL: Array<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: "atom", label: "Atom", Icon: Atom },
  { id: "brain", label: "Brain", Icon: Brain },
  { id: "flask", label: "Flask", Icon: FlaskConical },
  { id: "calculator", label: "Calculator", Icon: Calculator },
  { id: "book", label: "Book", Icon: BookOpen },
  { id: "globe", label: "Globe", Icon: Globe2 },
  { id: "landmark", label: "Landmark", Icon: Landmark },
  { id: "scroll", label: "Scroll", Icon: ScrollText },
  { id: "dna", label: "DNA", Icon: Dna },
  { id: "leaf", label: "Leaf", Icon: Leaf },
  { id: "scale", label: "Scales", Icon: Scale },
  { id: "code", label: "Code", Icon: Code2 },
  { id: "pen", label: "Pen", Icon: PenTool },
  { id: "music", label: "Music", Icon: Music4 },
  { id: "church", label: "Faith", Icon: Church },
  { id: "chart", label: "Chart", Icon: LineChart },
  { id: "languages", label: "Languages", Icon: Languages },
  { id: "drama", label: "Drama", Icon: Drama },
  { id: "health", label: "Health", Icon: HeartPulse },
  { id: "hammer", label: "Engineering", Icon: Hammer },
];

/** Default symbol when the user hasn't chosen one — inferred from the name. */
export function defaultIconIdFor(subjectName: string): string {
  const s = (subjectName || "").toLowerCase();
  if (/physic/.test(s)) return "atom";
  if (/psycholog/.test(s)) return "brain";
  if (/chem/.test(s)) return "flask";
  if (/math/.test(s)) return "calculator";
  if (/biolog/.test(s)) return "dna";
  if (/geograph|environment/.test(s)) return "globe";
  if (/history/.test(s)) return "landmark";
  if (/english|literature/.test(s)) return "pen";
  if (/econom|business|account/.test(s)) return "chart";
  if (/religio|philosoph|ethic/.test(s)) return "church";
  if (/comput|software/.test(s)) return "code";
  if (/law|politic/.test(s)) return "scale";
  if (/music/.test(s)) return "music";
  if (/drama|theatre/.test(s)) return "drama";
  if (/language|french|spanish|german/.test(s)) return "languages";
  if (/sport|health|pe\b/.test(s)) return "health";
  if (/engineer|design|construct/.test(s)) return "hammer";
  if (/sociolog/.test(s)) return "scroll";
  return "book";
}

export function resolveSubjectIcon(iconId: string | null | undefined, subjectName: string): LucideIcon {
  const id = iconId || defaultIconIdFor(subjectName);
  return (SUBJECT_ICON_POOL.find((p) => p.id === id) || SUBJECT_ICON_POOL[4]).Icon;
}
