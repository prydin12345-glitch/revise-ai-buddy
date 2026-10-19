import type { CSSProperties } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { FavouriteControl, type FavouriteProps } from "./FavouriteControl";
import { Button } from "@/components/ui/button";

export interface LibraryCardActions { pending: boolean; canArchive?: boolean; onDelete: () => void; onArchive: () => void; }

interface LibraryPaperCardProps {
  title: string;
  board: string;
  level: string;
  totalMarks?: number | null;
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
  actions?: LibraryCardActions;
  onOpen: () => void;
}

/** A compact library cover only. The detailed assessment and printable covers are separate. */
export function LibraryPaperCard({ title, board, level, totalMarks, questions, time, timeLabel, difficulty, progress, state, completed, subjectColor, archived, favourite, actions, onOpen }: LibraryPaperCardProps) {
  return (
    <article className="library-paper" data-archived={archived || undefined} style={{ "--paper-accent": subjectColor } as CSSProperties}>
      <button type="button" className="library-paper-open" onClick={onOpen} aria-label={`Open ${title}`} aria-disabled={archived || undefined}>
        <div className="library-paper-title">
          <h3 title={title}>{title}</h3>
        </div>
        <dl className="library-paper-metadata">
          <div><dt>Exam board:</dt><dd title={board}>{board || "Not set"}</dd></div>
          <div><dt>Level:</dt><dd title={level}>{level || "Not set"}</dd></div>
          <div><dt>Number of marks:</dt><dd>{totalMarks ?? "—"}</dd></div>
        </dl>
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
      {(favourite || actions) && <div className="library-paper-footer" aria-label={`${title} actions`}>
        {favourite && <FavouriteControl {...favourite} pending={favourite.pending || !!actions?.pending} iconOnly />}
        {actions && <>
          <Button variant="ghost" size="icon" disabled={actions.pending || favourite?.pending} onClick={actions.onDelete} aria-label={`Delete ${title}`} title="Delete"><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" disabled={actions.pending || favourite?.pending || actions.canArchive === false} onClick={actions.onArchive} aria-label={`${archived ? "Restore" : "Archive"} ${title}`} title={actions.canArchive === false ? "Finish creating this item before archiving" : archived ? "Restore" : "Archive"}>{archived ? <ArchiveRestore aria-hidden="true" className="h-4 w-4" /> : <Archive aria-hidden="true" className="h-4 w-4" />}</Button>
        </>}
      </div>}
    </article>
  );
}
