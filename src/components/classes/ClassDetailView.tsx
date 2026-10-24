import { useId, useMemo, useState, type CSSProperties } from "react";
import { format, formatDistanceToNow, isSameDay, isSameMonth, isValid, startOfMonth } from "date-fns";
import { ArrowLeft, BookOpen, Calculator, CheckCircle2, Clock, FileText, FlaskConical, Globe2, Info, Languages, Leaf, LogOut, MessageSquare, Monitor, Palette, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRetainedState } from "@/hooks/use-workspace-session";
import type { FeedbackThread, GroupAnnouncement, GroupAssignment, StudentGroup, SubmissionData, TutorInfo } from "@/pages/MyClasses";
import { AssignmentRow } from "./AssignmentRow";
import { AnnouncementItem } from "./AnnouncementItem";
import { ClassDeadlineCalendar } from "./ClassDeadlineCalendar";
import "@/styles/class-details.css";

interface ClassDetailViewProps {
  group: StudentGroup;
  tutor?: TutorInfo;
  assignments: GroupAssignment[];
  submissions: Map<string, SubmissionData>;
  announcements: GroupAnnouncement[];
  feedbackThreads?: FeedbackThread[];
  subjectColor?: string;
  onBack: () => void;
  onLeave: () => void;
}

function dateValue(value?: string) {
  const date = value ? new Date(value) : null;
  return date && isValid(date) ? date : null;
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

/** Presentation of the same authorized class snapshot; no additional data reads. */
export function ClassDetailView({ group, tutor, assignments, submissions, announcements, feedbackThreads = [], subjectColor = "hsl(var(--primary))", onBack, onLeave }: ClassDetailViewProps) {
  const headingId = useId();
  const stateKey = `classes:detail:${group.id}`;
  const [activeTab, setActiveTab] = useRetainedState(`${stateKey}:tab:v1`, "assignments");
  const [assignmentFilter, setAssignmentFilter] = useRetainedState(`${stateKey}:filter:v1`, "todo");
  const [month, setMonth] = useRetainedState(`${stateKey}:month:v1`, () => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useRetainedState<Date | undefined>(`${stateKey}:date:v1`, undefined);
  const [infoOpen, setInfoOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<FeedbackThread | null>(null);

  // The submission map can also contain other classes. Only this class's exam IDs
  // contribute to its counts, feedback and authorized per-assignment score display.
  const classAssignments = useMemo(() => assignments.filter(assignment => assignment.group_id === group.id)
    .sort((a, b) => (dateValue(a.deadline)?.getTime() ?? Infinity) - (dateValue(b.deadline)?.getTime() ?? Infinity)), [assignments, group.id]);
  const examIds = new Set(classAssignments.map(assignment => assignment.exam_id));
  const classThreads = feedbackThreads.filter(thread => examIds.has(thread.exam_id));
  const classAnnouncements = announcements.filter(announcement => announcement.group_id === group.id)
    .sort((a, b) => (dateValue(b.created_at)?.getTime() ?? -Infinity) - (dateValue(a.created_at)?.getTime() ?? -Infinity));
  const isCompleted = (assignment: GroupAssignment) => ["submitted", "graded"].includes(submissions.get(assignment.exam_id)?.status || "");
  const pending = classAssignments.filter(assignment => !isCompleted(assignment));
  const completed = classAssignments.filter(isCompleted);
  const visibleAssignments = assignmentFilter === "completed" ? completed : pending;
  const pendingFeedback = classThreads.filter(thread => thread.status === "pending").length;
  const completion = classAssignments.length ? Math.round(completed.length / classAssignments.length * 100) : 0;
  const scheduled = pending.filter(assignment => {
    const deadline = dateValue(assignment.deadline);
    // Undated work stays available while filtering dates, as on My Classes.
    return !deadline || (selectedDate ? isSameDay(deadline, selectedDate) : isSameMonth(deadline, month));
  });
  const scheduleGroups = new Map<string, GroupAssignment[]>();
  scheduled.forEach(assignment => {
    const deadline = dateValue(assignment.deadline);
    const key = deadline ? format(deadline, "yyyy-MM-dd") : "No deadline";
    scheduleGroups.set(key, [...(scheduleGroups.get(key) || []), assignment]);
  });
  const subjects = group.subjects_covered || [];
  const SubjectIcon = subjectIcon(subjects[0]?.name || "");
  const latest = classAnnouncements[0];
  const subjectColour = () => subjectColor;
  const renderAssignment = (assignment: GroupAssignment, presentation: "detail" | "schedule") => <AssignmentRow
    key={assignment.id} presentation={presentation}
    assignment={{ id: assignment.id, exam_id: assignment.exam_id, title: assignment.exam_title, type: assignment.exam_type, deadline: assignment.deadline || null, release_date: assignment.release_date }}
    submission={submissions.get(assignment.exam_id)} subjectColor={subjectColor}
    hasFeedback={classThreads.some(thread => thread.exam_id === assignment.exam_id)}
  />;

  return <div className="class-room" style={{ "--class-room-accent": subjectColor } as CSSProperties}>
    <Button type="button" variant="ghost" className="class-room-back" onClick={onBack}><ArrowLeft aria-hidden="true" />My Classes</Button>
    <section className="class-room-header" aria-labelledby={headingId}>
      <span className="class-room-symbol"><SubjectIcon aria-hidden="true" /></span>
      <div className="class-room-header-copy">
        <div className="class-room-title-line"><h1 id={headingId}>{group.name}</h1>{subjects.map(subject => <span key={subject.name} className="class-room-subject">{subject.name}</span>)}</div>
        {tutor && <button type="button" className="class-room-tutor" onClick={() => setTutorOpen(true)} aria-label={`View tutor profile: ${tutor.name}`}>
          <span aria-hidden="true">{tutor.name.split(" ").map(name => name[0]).join("").slice(0, 2).toUpperCase()}</span>Taught by <strong>{tutor.name}</strong>
        </button>}
        {group.description && <p className="class-room-description">{group.description}</p>}
      </div>
      <Button type="button" variant="outline" className="class-room-info-button" onClick={() => setInfoOpen(true)} aria-label="Class information"><span>Class info</span><Info aria-hidden="true" /></Button>
    </section>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="class-room-tabs">
      <TabsList className="class-room-tab-list" aria-label="Class sections">
        <TabsTrigger value="assignments">Assignments<span className="classes-count">{classAssignments.length}</span></TabsTrigger>
        <TabsTrigger value="announcements">Announcements<span className="classes-count">{classAnnouncements.length}</span></TabsTrigger>
        <TabsTrigger value="feedback">Feedback<span className="classes-count">{classThreads.length}</span></TabsTrigger>
      </TabsList>
      <div className="class-room-layout">
        <div className="class-room-main">
          <TabsContent value="assignments" className="class-room-content">
            <ul className="class-room-summary" aria-label="Your class assignment summary">
              <li><p><FileText aria-hidden="true" />To do</p><strong>{pending.length}</strong></li>
              <li><p><CheckCircle2 aria-hidden="true" />Completed</p><strong>{completed.length}<small> / {classAssignments.length}</small></strong>
                <div className="class-room-summary-progress" role="progressbar" aria-label={classAssignments.length ? "Class assignments completed" : "No assignments set"} aria-valuenow={completed.length} aria-valuemin={0} aria-valuemax={classAssignments.length || 1} aria-valuetext={`${completed.length} of ${classAssignments.length} assignments completed`}><span style={{ width: `${completion}%` }} /></div>
              </li>
              <li><p><MessageSquare aria-hidden="true" />Awaiting tutor</p><strong>{pendingFeedback}</strong></li>
            </ul>
            <section className="class-room-panel" aria-labelledby={`${headingId}-assignments`}>
              <div className="class-room-panel-heading"><div><h2 id={`${headingId}-assignments`}>Your assignments</h2><p>Work set by your teacher or tutor.</p></div><BookOpen aria-hidden="true" /></div>
              <div className="class-room-assignment-filters" role="group" aria-label="Assignment status">
                <button type="button" aria-pressed={assignmentFilter !== "completed"} onClick={() => setAssignmentFilter("todo")}>To do<span>{pending.length}</span></button>
                <button type="button" aria-pressed={assignmentFilter === "completed"} onClick={() => setAssignmentFilter("completed")}>Completed<span>{completed.length}</span></button>
              </div>
              <div className="class-room-assignment-list">{visibleAssignments.length ? visibleAssignments.map(assignment => renderAssignment(assignment, "detail")) : <ClassEmpty icon={CheckCircle2}
                title={!classAssignments.length ? "No assignments yet" : assignmentFilter === "completed" ? "No completed assignments yet" : "You’re all caught up"}
                description={!classAssignments.length ? "Work set by your teacher or tutor will appear here." : assignmentFilter === "completed" ? "Your submitted work will appear here." : "You’ve completed all the work set for this class."} />}</div>
              <p className="class-room-panel-note">Only work assigned to this class appears here.</p>
            </section>
            <section className="class-room-panel class-room-latest" aria-labelledby={`${headingId}-latest`}>
              <div className="class-room-panel-heading"><h2 id={`${headingId}-latest`}>Latest announcement</h2>{latest && <button type="button" onClick={() => setActiveTab("announcements")}>View updates</button>}</div>
              {latest ? <AnnouncementItem announcement={latest} /> : <ClassEmpty icon={MessageSquare} title="No announcements yet" description="Updates from your teacher or tutor will appear here." />}
            </section>
          </TabsContent>
          <TabsContent value="announcements" className="class-room-content">
            <section className="class-room-panel" aria-labelledby={`${headingId}-announcements`}>
              <div className="class-room-panel-heading"><div><h2 id={`${headingId}-announcements`}>Class announcements</h2><p>Updates and resources from your tutor.</p></div></div>
              <div className="class-room-announcement-feed">{classAnnouncements.length ? classAnnouncements.map(announcement => <AnnouncementItem key={announcement.id} announcement={announcement} presentation="timeline" />) : <ClassEmpty icon={MessageSquare} title="No announcements yet" description="Updates from your teacher or tutor will appear here." />}</div>
            </section>
          </TabsContent>
          <TabsContent value="feedback" className="class-room-content">
            <section className="class-room-panel" aria-labelledby={`${headingId}-feedback`}>
              <div className="class-room-panel-heading"><div><h2 id={`${headingId}-feedback`}>Your feedback</h2><p>Your questions and your tutor’s responses.</p></div></div>
              <div className="class-room-feedback-list">{classThreads.length ? classThreads.map(thread => {
                const title = classAssignments.find(assignment => assignment.exam_id === thread.exam_id)?.exam_title || "Assignment";
                const createdAt = dateValue(thread.created_at);
                return <article key={thread.id} className="class-room-thread"><h3>{title}</h3>
                  <div className="class-room-thread-meta"><span data-pending={thread.status === "pending"}>{thread.status === "pending" ? "Awaiting tutor" : "Responded"}</span>{createdAt && <time dateTime={thread.created_at}>{formatDistanceToNow(createdAt, { addSuffix: true })}</time>}</div>
                  <p>{thread.student_comment}</p>{thread.tutor_response && <blockquote>{thread.tutor_response}</blockquote>}
                  <Button type="button" variant="ghost" className="class-room-thread-button" onClick={() => setSelectedThread(thread)} aria-label={`View feedback for ${title}`}>View thread</Button>
                </article>;
              }) : <ClassEmpty icon={MessageSquare} title="No feedback threads yet" description="Your questions and tutor responses will appear here." />}</div>
            </section>
          </TabsContent>
        </div>
        <aside className="class-room-schedule" aria-label="Class calendar and upcoming deadlines">
          <ClassDeadlineCalendar assignments={pending} groups={[group]} getSubjectColor={subjectColour} month={month} selectedDate={selectedDate} onSelectDate={setSelectedDate} onMonthChange={next => { setMonth(next); setSelectedDate(undefined); }} />
          <section className="class-room-deadlines" aria-labelledby={`${headingId}-deadlines`}>
            <div className="class-room-panel-heading"><div><h2 id={`${headingId}-deadlines`}>Upcoming deadlines</h2><p>{selectedDate ? format(selectedDate, "EEEE, d MMMM") : format(month, "MMMM yyyy")}</p></div></div>
            <div className="class-room-deadline-groups" aria-live="polite">{scheduleGroups.size ? Array.from(scheduleGroups, ([date, items]) => <div className="class-room-deadline-group" key={date}><h3>{date === "No deadline" ? "No deadline" : format(new Date(date + "T12:00:00"), "EEEE, d MMM")}</h3>{items.map(assignment => renderAssignment(assignment, "schedule"))}</div>) : <p className="classes-schedule-empty">{selectedDate ? "No assignments due on this date." : "No assignments due this month."}</p>}</div>
            <p className="class-room-schedule-note">Due dates for this class only.</p>
          </section>
        </aside>
      </div>
    </Tabs>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
      <DialogContent className="class-room-info-dialog"><DialogHeader><DialogTitle>About this class</DialogTitle><DialogDescription>Class information and membership.</DialogDescription></DialogHeader>
        <div className="class-room-info-summary"><h3>{group.name}</h3>{group.description && <p>{group.description}</p>}{tutor && <p>Taught by {tutor.name}</p>}{subjects.length > 0 && <p>{subjects.map(subject => subject.name).join(" · ")}</p>}</div>
        <Button type="button" variant="ghost" className="class-room-leave" onClick={() => { setInfoOpen(false); onLeave(); }}><LogOut aria-hidden="true" />Leave class</Button>
      </DialogContent>
    </Dialog>
    <Dialog open={tutorOpen} onOpenChange={setTutorOpen}>
      <DialogContent className="class-room-info-dialog"><DialogHeader><DialogTitle>{tutor?.name || "Tutor profile"}</DialogTitle><DialogDescription>Tutor profile</DialogDescription></DialogHeader>
        <div className="class-room-info-summary"><p>{tutor?.bio || "No bio available."}</p>{!!tutor?.subjects_taught?.length && <><h3>Subjects taught</h3><p>{tutor.subjects_taught.join(" · ")}</p></>}</div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!selectedThread} onOpenChange={open => !open && setSelectedThread(null)}>
      <DialogContent className="class-room-feedback-dialog"><DialogHeader><DialogTitle>Feedback thread</DialogTitle><DialogDescription>Your question and your tutor’s response.</DialogDescription></DialogHeader>
        {selectedThread && <div className="class-room-info-summary"><h3>Your question</h3><p data-class-feedback-message>{selectedThread.student_comment}</p>{selectedThread.tutor_response ? <><h3>Tutor response</h3><p data-class-feedback-message>{selectedThread.tutor_response}</p>{dateValue(selectedThread.responded_at) && <time dateTime={selectedThread.responded_at}>{formatDistanceToNow(dateValue(selectedThread.responded_at)!, { addSuffix: true })}</time>}</> : <p><Clock aria-hidden="true" />Awaiting tutor response.</p>}</div>}
      </DialogContent>
    </Dialog>
  </div>;
}

function ClassEmpty({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="class-room-empty"><div className="class-room-empty-divider" aria-hidden="true"><span /><Icon /><span /></div><h3>{title}</h3><p>{description}</p></div>;
}
