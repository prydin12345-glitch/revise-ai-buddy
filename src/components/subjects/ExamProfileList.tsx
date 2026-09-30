import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ExamProfileRow } from "./ExamProfileRow";

interface ExamProfileListProps {
  profiles: any[];
  subjectName: string;
  subjectColor?: string | null;
  onEdit: (profile: any) => void;
}

const COLLAPSED_COUNT = 3;

/**
 * Phone layout for a subject's profiles. Shows the first three and expands in
 * place, so the page is the same length whether someone has 3 profiles or 30
 * — and nothing on it scrolls sideways.
 */
export const ExamProfileList = ({ profiles, subjectName, subjectColor, onEdit }: ExamProfileListProps) => {
  const [expanded, setExpanded] = useState(false);
  const overflow = profiles.length - COLLAPSED_COUNT;
  const visible = expanded || overflow <= 0 ? profiles : profiles.slice(0, COLLAPSED_COUNT);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {visible.map((profile) => (
        <ExamProfileRow
          key={profile.id}
          profile={profile}
          subjectName={subjectName}
          subjectColor={subjectColor}
          onEdit={() => onEdit(profile)}
        />
      ))}
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-center gap-1.5 min-h-[44px] text-13 text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show fewer" : `Show all ${profiles.length} profiles`}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
};
