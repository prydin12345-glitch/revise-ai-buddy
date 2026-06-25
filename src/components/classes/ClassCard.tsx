import { BookOpen } from "lucide-react";

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
  announcementCount: number;
  subjectColor: string;
  completedCount?: number;
  onClick: () => void;
}

/**
 * Portrait A4 "class paper" card matching ExamCard / PracticeSetCard vocabulary.
 * Metadata (joined date, badges) lives on the class detail view, not the face.
 */
export const ClassCard = ({
  group,
  tutorName,
  assignmentCount,
  announcementCount,
  subjectColor,
  completedCount = 0,
  onClick,
}: ClassCardProps) => {
  const primarySubject = group.subjects_covered?.[0]?.name;
  const extraSubjects = Math.max(0, (group.subjects_covered?.length ?? 0) - 1);
  const percent =
    assignmentCount > 0
      ? Math.min(100, Math.round((completedCount / assignmentCount) * 100))
      : 0;

  return (
    <div className="group w-full">
      <button
        type="button"
        onClick={onClick}
        className="relative block w-full rounded-md border border-border bg-card text-left overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ aspectRatio: "1 / 1.414" }}
        aria-label={`Open ${group.name}`}
      >
        {/* Subject-colour spine */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ backgroundColor: subjectColor }}
        />

        <div className="flex h-full flex-col px-4 pt-4 pb-3 pl-5">
          {/* Masthead */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded text-white"
                style={{ backgroundColor: subjectColor }}
              >
                <BookOpen className="h-2.5 w-2.5" />
              </span>
              <span className="text-[10px] font-bold tracking-tight">Class</span>
            </div>
            {announcementCount > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-full px-1.5 h-4 text-[9px] font-semibold text-white"
                style={{ backgroundColor: subjectColor }}
                aria-label={`${announcementCount} new announcements`}
              >
                {announcementCount} new
              </span>
            )}
          </div>

          {/* Title block */}
          <div className="mt-3 rounded-md border-2 border-foreground/80 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">
              {primarySubject || "Class"}
              {extraSubjects > 0 ? ` +${extraSubjects}` : ""}
            </p>
            <h3 className="font-serif text-lg font-bold leading-tight tracking-tight text-foreground mt-1 line-clamp-2">
              {group.name}
            </h3>
            {tutorName && (
              <p className="font-serif text-[11px] text-foreground/80 leading-snug mt-1 line-clamp-1">
                with {tutorName}
              </p>
            )}
          </div>

          {/* Assignments strip */}
          <div className="mt-2 flex items-stretch rounded-md border border-border overflow-hidden text-[10px]">
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-[9px]">Tasks</p>
              <p className="font-semibold leading-tight">{assignmentCount || "—"}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-[9px]">Done</p>
              <p className="font-semibold leading-tight">{completedCount}</p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Bottom progress */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
              <span className="uppercase tracking-wider">Progress</span>
              <span className="font-semibold">{percent}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${percent}%`,
                  backgroundColor: subjectColor,
                }}
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
