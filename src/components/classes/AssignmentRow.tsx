import type { CSSProperties } from "react";
import { format, isToday, isTomorrow, isPast, isFuture, isValid } from "date-fns";
import { ArrowRight, CheckCircle2, Clock, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "@/styles/class-assignment.css";

interface AssignmentRowProps {
  assignment: {
    id: string;
    exam_id: string;
    title: string;
    type: string;
    deadline: string | null;
    release_date?: string | null;
  };
  className?: string;
  tutorName?: string;
  submission?: {
    status: string | null;
    total_score?: number | null;
    total_marks?: number | null;
    submitted_at?: string | null;
  } | null;
  hasFeedback?: boolean;
  subjectColor?: string;
  presentation?: "card" | "row" | "schedule" | "detail";
}

const suppliedDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date : null;
};

/** The same assigned-exam action and access states, in the shared class layouts. */
export const AssignmentRow = ({
  assignment,
  className,
  tutorName,
  submission,
  hasFeedback = false,
  subjectColor,
  presentation = "row",
}: AssignmentRowProps) => {
  const navigate = useNavigate();
  const deadline = suppliedDate(assignment.deadline);
  const releaseDate = suppliedDate(assignment.release_date);
  const isCompleted = submission?.status === "graded" || submission?.status === "submitted";

  const getStatusConfig = () => {
    // Availability and deadline gates retain priority over the submission action.
    if (releaseDate && isFuture(releaseDate)) {
      return {
        label: "Not available",
        tone: "muted",
        action: `Available ${format(releaseDate, "d MMM")}`,
        canAct: false,
        disabledReason: `Available on ${format(releaseDate, "d MMM yyyy 'at' HH:mm")}`,
      };
    }
    if (deadline && isPast(deadline) && !isCompleted) {
      return {
        label: "Deadline passed",
        tone: "closed",
        action: "View",
        canAct: false,
        disabledReason: "Deadline has passed",
      };
    }
    if (!submission || !submission.status || submission.status === "not_started") {
      return { label: "Not started", tone: "muted", action: "Start", canAct: true };
    }
    if (isCompleted) {
      // This metadata comes from the release-protected view. Missing grades are
      // deliberately not converted into zero, including while marking is pending.
      const hasGrade =
        typeof submission.total_score === "number" && Number.isFinite(submission.total_score) &&
        typeof submission.total_marks === "number" && Number.isFinite(submission.total_marks) &&
        submission.total_marks > 0;
      return {
        label: hasGrade
          ? `${Math.round((submission.total_score! / submission.total_marks!) * 100)}%`
          : submission.status === "graded" ? "Graded" : "Submitted",
        tone: "complete",
        action: "Review",
        canAct: true,
      };
    }
    if (submission.status === "in_progress") {
      return { label: "In progress", tone: "active", action: "Continue", canAct: true };
    }
    return { label: "Pending", tone: "muted", action: "View", canAct: true };
  };

  const status = getStatusConfig();
  const deadlineText = !deadline ? "No deadline" : !isCompleted && isPast(deadline)
    ? `Due ${format(deadline, "d MMM")}`
    : isToday(deadline) ? "Due today"
      : isTomorrow(deadline) ? "Due tomorrow" : `Due ${format(deadline, "d MMM")}`;
  const fullDeadline = deadline ? format(deadline, "d MMM yyyy 'at' HH:mm") : undefined;

  const handleAction = () => {
    try {
      if (!assignment.exam_id) {
        toast.error("This assignment is no longer available.");
        return;
      }
      if (!status.canAct) {
        if (releaseDate && isFuture(releaseDate)) {
          toast.info(`This assignment will be available on ${format(releaseDate, "MMM d, yyyy")}`);
        }
        return;
      }
      if (submission?.status === "graded" || submission?.status === "submitted") {
        navigate(`/exam/${assignment.exam_id}/review`);
      } else {
        navigate(`/exam/${assignment.exam_id}/in-progress`);
      }
    } catch (error) {
      console.error("Error navigating to assignment:", { error, assignmentId: assignment.id, examId: assignment.exam_id });
      toast.error("We couldn't load your session. Please try again.");
    }
  };

  const action = (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={!status.canAct}
      onClick={handleAction}
      className="class-assignment-action"
      data-action={presentation === "detail" ? status.action : undefined}
      aria-label={`${status.action}: ${assignment.title}`}
    >
      {status.canAct ? <>
        <span className={presentation === "schedule" ? "sr-only" : undefined}>{status.action}</span>
        {presentation !== "detail" && <ArrowRight aria-hidden="true" />}
      </> : <>
        <Lock aria-hidden="true" />
        <span className={presentation === "schedule" ? "sr-only" : undefined}>{status.action}</span>
      </>}
    </Button>
  );

  if (presentation === "detail") {
    // The same availability gate also protects completed-work metadata. A future
    // release must not reveal a score or feedback state through this new layout.
    const visibleCompleted = isCompleted && status.canAct;
    const submittedAt = suppliedDate(submission?.submitted_at);
    const detailDate = visibleCompleted ? submittedAt : deadline;
    const detailDateValue = visibleCompleted ? submission?.submitted_at : assignment.deadline;
    const detailDateText = visibleCompleted
      ? submittedAt ? `Submitted ${format(submittedAt, "d MMM")}` : null
      : deadlineText;

    return (
      <article
        className="class-assignment class-assignment--detail"
        style={{ "--assignment-accent": subjectColor || "hsl(var(--primary))" } as CSSProperties}
        aria-label={assignment.title}
        data-state={status.tone}
      >
        <span className="class-assignment-detail-symbol" aria-hidden="true"><FileText /></span>
        <div className="class-assignment-copy">
          <h3>{assignment.title}</h3>
          <div className="class-assignment-detail-meta">
            <span>Exam</span>
            {detailDateText && <>
              <span aria-hidden="true">·</span>
              {detailDate ? <time dateTime={detailDateValue || undefined} title={format(detailDate, "d MMM yyyy 'at' HH:mm")}>
                {detailDateText}
              </time> : <span>{detailDateText}</span>}
            </>}
          </div>
          {hasFeedback && visibleCompleted && <p className="class-assignment-detail-feedback">Feedback thread</p>}
        </div>
        <div className="class-assignment-detail-actions">
          <span className={`class-assignment-status class-assignment-status--${status.tone}`}>
            {status.tone === "complete" && <CheckCircle2 aria-hidden="true" />}
            {!status.canAct && <Lock aria-hidden="true" />}
            {status.label}
          </span>
          {status.canAct ? action : (
            <Tooltip>
              <TooltipTrigger asChild><span className="class-assignment-disabled" tabIndex={0} aria-label={`${status.label}: ${status.disabledReason}`}>{action}</span></TooltipTrigger>
              <TooltipContent>{status.disabledReason}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {!status.canAct && <p className="class-assignment-availability">{status.disabledReason}</p>}
      </article>
    );
  }

  return (
    <article
      className={`class-assignment class-assignment--${presentation}`}
      style={{ "--assignment-accent": subjectColor || "hsl(var(--primary))" } as CSSProperties}
      aria-label={assignment.title}
    >
      {presentation === "schedule" && (
        <div className="class-assignment-date" aria-hidden="true">
          {deadline ? <><strong>{format(deadline, "dd")}</strong><span>{format(deadline, "MMM")}</span></> : <Clock />}
        </div>
      )}
      <div className="class-assignment-heading">
        <span className="class-assignment-symbol" aria-hidden="true"><FileText /></span>
        <span className={`class-assignment-status class-assignment-status--${status.tone}`}>
          {status.tone === "complete" && <CheckCircle2 aria-hidden="true" />}
          {!status.canAct && <Lock aria-hidden="true" />}
          {status.label}
        </span>
      </div>
      <div className="class-assignment-copy">
        <h3>{assignment.title}</h3>
        <p className="class-assignment-context">{className && <span>{className} · </span>}Exam</p>
        {tutorName && presentation !== "schedule" && <p className="class-assignment-tutor">Set by {tutorName}</p>}
      </div>
      <div className="class-assignment-footer">
        <div className="class-assignment-deadline">
          <Clock aria-hidden="true" />
          {deadline ? <time dateTime={assignment.deadline!} title={fullDeadline}>
            {presentation === "schedule" ? `Due ${format(deadline, "HH:mm")}` : deadlineText}
          </time> : <span>{deadlineText}</span>}
        </div>
        {status.canAct ? action : (
          <Tooltip>
            <TooltipTrigger asChild><span className="class-assignment-disabled" tabIndex={0} aria-label={`${status.label}: ${status.disabledReason}`}>{action}</span></TooltipTrigger>
            <TooltipContent>{status.disabledReason}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {!status.canAct && status.tone !== "closed" && <p className="class-assignment-availability">{status.disabledReason}</p>}
    </article>
  );
};
