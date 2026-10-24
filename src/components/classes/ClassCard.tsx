import type { CSSProperties } from "react";
import { ArrowRight, BookOpen, Calculator, FlaskConical, Globe2, Languages, Leaf, Monitor, Palette } from "lucide-react";
import { getTextColor } from "@/lib/color-contrast";
import "@/styles/class-cards.css";

// Small cover labels need text contrast, including on a student's bright custom colour.
// Keep the existing helper as the fallback for legacy non-hex colour values.
function coverTextColour(colour: string) {
  // A class without a subject uses the theme's paired primary colours.
  if (colour.replace(/\s+/g, "") === "hsl(var(--primary))") return "hsl(var(--primary-foreground))";
  const hex = colour.replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return getTextColor(colour);
  const fullHex = hex.length === 3 ? hex.split("").map(channel => channel + channel).join("") : hex;
  const linear = [0, 2, 4].map(index => {
    const channel = parseInt(fullHex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

interface ClassCardProps {
  group: {
    id: string;
    name: string;
    description?: string;
    subjects_covered?: { name: string; color?: string }[];
    joined_at?: string;
  };
  tutorName?: string;
  assignmentCount: number;
  /** A total, not an unread count. Announcements remain available in the class. */
  announcementCount: number;
  subjectColor: string;
  completedCount?: number;
  pendingCount?: number;
  onClick: () => void;
}

function subjectIcon(subject: string) {
  const name = subject.toLowerCase();
  if (name.includes("biology")) return Leaf;
  if (name.includes("chemistry") || name.includes("science")) return FlaskConical;
  if (name.includes("math")) return Calculator;
  if (name.includes("geography")) return Globe2;
  if (name.includes("comput")) return Monitor;
  if (name.includes("language") || name.includes("french") || name.includes("spanish")) return Languages;
  if (name.includes("art")) return Palette;
  return BookOpen;
}

/** A class overview; assignment completion is not a subject-mastery percentage. */
export const ClassCard = ({
  group,
  tutorName,
  assignmentCount,
  subjectColor,
  completedCount = 0,
  pendingCount = Math.max(0, assignmentCount - completedCount),
  onClick,
}: ClassCardProps) => {
  const primarySubject = group.subjects_covered?.[0]?.name || "Class";
  const extraSubjects = Math.max(0, (group.subjects_covered?.length ?? 0) - 1);
  const SubjectIcon = subjectIcon(primarySubject);
  const style = {
    "--class-subject-colour": subjectColor,
    "--class-cover-foreground": coverTextColour(subjectColor),
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      className="student-class-card"
      style={style}
      aria-label={`Open ${group.name}`}
    >
      <span className="student-class-card__cover">
        <span className="student-class-card__subject">
          {primarySubject}{extraSubjects > 0 && ` +${extraSubjects}`}
        </span>
        <SubjectIcon aria-hidden="true" />
      </span>
      <span className="student-class-card__body">
        <span className="student-class-card__title">{group.name}</span>
        <span className="student-class-card__tutor">{tutorName || "Tutor"}</span>
        <span className="student-class-card__counts">
          <span><strong>{completedCount}/{assignmentCount}</strong> completed</span>
          <span><strong>{pendingCount}</strong> to do</span>
        </span>
        <span className="student-class-card__action">
          View class <ArrowRight aria-hidden="true" />
        </span>
      </span>
    </button>
  );
};
