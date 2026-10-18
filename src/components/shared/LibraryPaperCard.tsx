import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { FavouriteControl, type FavouriteProps } from "./FavouriteControl";

interface LibraryPaperCardProps {
  title: string;
  subject: string;
  course: string;
  questions: number;
  time: string;
  timeLabel: string;
  difficulty?: string;
  progress: number;
  state: string;
  completed: boolean;
  subjectColor: string;
  archived?: boolean;
  favourite?: FavouriteProps;
  onOpen: () => void;
}

/** A compact library cover only. The detailed assessment and printable covers are separate. */
export function LibraryPaperCard({ title, subject, course, questions, time, timeLabel, difficulty, progress, state, completed, subjectColor, archived, favourite, onOpen }: LibraryPaperCardProps) {
  return (
    <article className="library-paper" data-archived={archived || undefined} style={{ "--paper-accent": subjectColor } as CSSProperties}>
      <button type="button" className="library-paper-open" onClick={onOpen} aria-label={`Open ${title}`} aria-disabled={archived || undefined}>
        <div className="library-paper-subject">
          <span className="library-paper-dot" aria-hidden="true" />
          <span>{subject}</span>
          <ArrowUpRight aria-hidden="true" />
        </div>
        <div className="library-paper-title">
          <h3 title={title}>{title}</h3>
          <p title={course}>{course}</p>
        </div>
        <dl className="library-paper-details">
          <div><dt>Questions</dt><dd>{questions || "—"}</dd></div>
          <div><dt>{timeLabel}</dt><dd>{time}</dd></div>
        </dl>
        {difficulty && <p className="library-paper-difficulty">Difficulty <span>{difficulty}</span></p>}
        <div className="library-paper-progress">
          <div><span>{state}</span><strong>{Math.round(progress)}%</strong></div>
          <div className="library-paper-track" role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progress))}>
            <span style={{ width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: completed ? "hsl(var(--success))" : subjectColor }} />
          </div>
        </div>
      </button>
      {favourite && <div className="library-paper-footer"><FavouriteControl {...favourite} /></div>}
    </article>
  );
}
