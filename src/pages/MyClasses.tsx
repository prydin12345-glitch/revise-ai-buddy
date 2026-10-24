import { useQuery } from "@tanstack/react-query";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-client";
import { useRetainedState } from "@/hooks/use-workspace-session";
import { classesQuery } from "@/lib/classes-query";
import { classSubjectLabels, NO_KNOWN_CLASS_SUBJECTS } from "@/lib/class-subjects";
import { LoadError } from "@/components/shared/ListFeedback";
import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/exam-metadata-client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, BookOpen, CheckCircle2, ChevronRight, type LucideIcon } from "lucide-react";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { ClassCard } from "@/components/classes/ClassCard";
import { ClassDetailView } from "@/components/classes/ClassDetailView";
import { ClassDeadlineCalendar } from "@/components/classes/ClassDeadlineCalendar";
import { ClassAnnouncements } from "@/components/classes/ClassAnnouncements";
import { AssignmentRow } from "@/components/classes/AssignmentRow";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { format, isSameDay, isSameMonth, isValid, startOfMonth } from "date-fns";
import "@/styles/classes-workspace.css";

export interface StudentGroup {
  id: string;
  name: string;
  description?: string;
  tutor_id: string;
  subjects_covered?: { name: string; color?: string }[];
  joined_at?: string;
}

export interface GroupAssignment {
  id: string;
  exam_id: string;
  exam_title: string;
  exam_type: "uploaded" | "generated";
  deadline?: string;
  release_date?: string;
  group_id: string;
  group_name: string;
}

export interface GroupAnnouncement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  attachment_url?: string;
  group_id: string;
  group_name: string;
}

export interface TutorInfo {
  name: string;
  bio?: string;
  subjects_taught?: string[];
}

export interface SubmissionData {
  status: string;
  total_score?: number;
  total_marks?: number;
  submitted_at?: string;
}

export interface FeedbackThread {
  id: string;
  question_id: string;
  student_comment: string;
  tutor_response?: string;
  status: string;
  created_at: string;
  responded_at?: string;
  exam_id: string;
}

interface SubjectProgress {
  name: string;
  color: string;
  completed: number;
  total: number;
}

const MyClasses = () => {
  const { getSubjectColor, subjects: userSubjects } = useUserSubjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const { store, client } = useWorkspaceQueryScope();
  const query = useQuery({ ...classesQuery(store), refetchOnMount: "always" }, client);
  const knownSubjects = userSubjects?.length ? userSubjects : NO_KNOWN_CLASS_SUBJECTS;
  // Adapt the existing JSON shapes for all overview/detail/calendar consumers.
  // The cached response and the database records remain unchanged.
  const groups = useMemo(() => (query.data?.groups || []).map(group => ({
    ...group, subjects_covered: classSubjectLabels(group.subjects_covered, knownSubjects),
  })), [query.data?.groups, knownSubjects]);
  const assignments = query.data?.assignments || [];
  const announcements = query.data?.announcements || [];
  const submissions = query.data?.submissions || new Map<string, SubmissionData>();
  const tutors = query.data?.tutors || new Map<string, TutorInfo>();
  const feedbackThreads = query.data?.feedbackThreads || [];
  const loadStudentClasses = useCallback(() => query.refetch({ cancelRefetch: false }), [query.refetch]);
  const groupIdsKey = groups.map(group => group.id).join("|");
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<StudentGroup | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [groupToLeave, setGroupToLeave] = useState<StudentGroup | null>(null);
  // View preferences share the existing account-scoped, memory-only workspace lifetime.
  const [searchQuery, setSearchQuery] = useRetainedState("classes:search:v1", "");
  const [selectedMonth, setSelectedMonth] = useRetainedState("classes:month:v1", () => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useRetainedState<Date | undefined>("classes:date:v1", undefined);
  const [activeTab, setActiveTab] = useRetainedState("classes:tab:v1", "classes");
  const [announcementClass, setAnnouncementClass] = useRetainedState("classes:announcements-class:v1", "all");

  useEffect(() => {
    const channel = supabase
      .channel("student-classes-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_announcements" }, (payload) => {
        const announcement = payload.new as { group_id: string; title: string };
        if (groups.some(group => group.id === announcement.group_id)) {
          toast.success("New announcement: " + announcement.title);
          void loadStudentClasses();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadStudentClasses, store, groupIdsKey]);

  useEffect(() => {
    const classId = searchParams.get("classId");
    if (classId && groups.length > 0) {
      const match = groups.find(group => group.id === classId);
      if (match) setSelectedClass(match);
    }
  }, [groups, searchParams]);

  const returnToClasses = () => {
    setSelectedClass(null);
    if (searchParams.has("classId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("classId");
      setSearchParams(next, { replace: true });
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupToLeave) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("group_members").update({ is_active: false })
        .eq("group_id", groupToLeave.id).eq("student_id", user.id);
      if (error) throw error;
      toast.success("Left " + groupToLeave.name);
      await client.cancelQueries({ queryKey: ["workspace-classes"] });
      client.setQueryData<NonNullable<typeof query.data>>(["workspace-classes"], previous => previous ? {
        ...previous, groups: previous.groups.filter(group => group.id !== groupToLeave.id),
      } : previous);
      void loadStudentClasses();
      returnToClasses();
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error("Failed to leave class");
    } finally {
      setLeaveDialogOpen(false);
      setGroupToLeave(null);
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutors.get(group.tutor_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const getAssignmentsForGroup = (groupId: string) => assignments.filter(assignment => assignment.group_id === groupId);
  const getAnnouncementsForGroup = (groupId: string) => announcements.filter(announcement => announcement.group_id === groupId);
  const getFeedbackThreadsForGroup = (groupId: string) => {
    const examIds = getAssignmentsForGroup(groupId).map(assignment => assignment.exam_id);
    return feedbackThreads.filter(thread => examIds.includes(thread.exam_id));
  };
  const isCompleted = (assignment: GroupAssignment) => ["submitted", "graded"].includes(submissions.get(assignment.exam_id)?.status || "");
  const subjectColorForGroup = (groupId: string) => {
    const subject = groups.find(group => group.id === groupId)?.subjects_covered?.[0];
    return subject?.color || (subject ? getSubjectColor(subject.name) : "hsl(var(--primary))");
  };
  // Keep the existing detail breakdown and its calculations; overview counts are class-level.
  const getSubjectProgressForGroup = (groupId: string): SubjectProgress[] => {
    const groupAssignments = getAssignmentsForGroup(groupId);
    return (groups.find(group => group.id === groupId)?.subjects_covered || []).map(subject => ({
      name: subject.name, color: subject.color || "#3B82F6",
      completed: groupAssignments.filter(isCompleted).length, total: groupAssignments.length,
    }));
  };
  const sortedAssignments = useMemo(() => [...assignments].sort((a, b) => {
    const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return (Number.isFinite(aDate) ? aDate : Infinity) - (Number.isFinite(bDate) ? bDate : Infinity);
  }), [assignments]);
  const pendingAssignments = sortedAssignments.filter(assignment => !isCompleted(assignment));
  const overviewPriority = (assignment: GroupAssignment) => {
    const now = Date.now();
    if (assignment.deadline && new Date(assignment.deadline).getTime() < now) return 2;
    if (assignment.release_date && new Date(assignment.release_date).getTime() > now) return 1;
    return 0;
  };
  // Expired work stays in the full list; it must not crowd out work students can start.
  const overviewAssignments = [...pendingAssignments].sort((a, b) => overviewPriority(a) - overviewPriority(b)).slice(0, 3);
  const scheduledAssignments = pendingAssignments.filter(assignment => {
    if (!assignment.deadline || !isValid(new Date(assignment.deadline))) return true;
    const deadline = new Date(assignment.deadline);
    return selectedDate ? isSameDay(deadline, selectedDate) : isSameMonth(deadline, selectedMonth);
  });
  const scheduleGroups = new Map<string, GroupAssignment[]>();
  scheduledAssignments.forEach(assignment => {
    const key = assignment.deadline && isValid(new Date(assignment.deadline)) ? format(new Date(assignment.deadline), "yyyy-MM-dd") : "No deadline";
    scheduleGroups.set(key, [...(scheduleGroups.get(key) || []), assignment]);
  });
  const renderAssignment = (assignment: GroupAssignment, presentation: "card" | "row" | "schedule") => {
    const group = groups.find(group => group.id === assignment.group_id);
    return <AssignmentRow key={assignment.id} presentation={presentation}
      assignment={{ id: assignment.id, exam_id: assignment.exam_id, title: assignment.exam_title, type: assignment.exam_type, deadline: assignment.deadline || null, release_date: assignment.release_date }}
      className={assignment.group_name} tutorName={group ? tutors.get(group.tutor_id)?.name : undefined}
      submission={submissions.get(assignment.exam_id)} subjectColor={subjectColorForGroup(assignment.group_id)} />;
  };
  const leaveConfirmation = <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
    <AlertDialogContent><AlertDialogHeader>
      <AlertDialogTitle>Leave {groupToLeave?.name}?</AlertDialogTitle>
      <AlertDialogDescription>You will no longer receive assignments or announcements from this class.</AlertDialogDescription>
    </AlertDialogHeader><AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground">Leave Class</AlertDialogAction>
    </AlertDialogFooter></AlertDialogContent>
  </AlertDialog>;

  if (query.error && !query.data) return <DashboardLayout><div className="classes-workspace"><LoadError message="Couldn’t load your classes. Please retry." onRetry={() => void loadStudentClasses()} /></div></DashboardLayout>;
  if (query.isPending) return <DashboardLayout><ClassesSkeleton /></DashboardLayout>;

  if (selectedClass) {
    return <DashboardLayout><div className="classes-workspace classes-detail-workspace">
      {query.error && <LoadError message="Couldn’t refresh your class. Your last loaded information is still shown." onRetry={() => void loadStudentClasses()} />}
      <ClassDetailView group={selectedClass} tutor={tutors.get(selectedClass.tutor_id)}
        assignments={getAssignmentsForGroup(selectedClass.id)} submissions={submissions}
        announcements={getAnnouncementsForGroup(selectedClass.id)} feedbackThreads={getFeedbackThreadsForGroup(selectedClass.id)}
        subjectProgress={getSubjectProgressForGroup(selectedClass.id)} onBack={returnToClasses}
        onLeave={() => { setGroupToLeave(selectedClass); setLeaveDialogOpen(true); }} />
      {leaveConfirmation}
    </div></DashboardLayout>;
  }

  return <DashboardLayout>
    <div className="classes-workspace">
      {query.error && <LoadError message="Couldn’t refresh your classes. Your last loaded information is still shown." onRetry={() => void loadStudentClasses()} />}
      <header className="classes-page-heading">
        <div><h1>My Classes</h1><p>Your classes, tutor-set work and due dates. All together.</p></div>
        <Button onClick={() => setJoinModalOpen(true)} className="classes-join-button"><Plus aria-hidden="true" /><span>Join a class</span></Button>
      </header>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="classes-tabs">
        <TabsList className="classes-tab-list" aria-label="Class workspace">
          <TabsTrigger value="classes">Overview</TabsTrigger>
          <TabsTrigger value="assignments">All assignments<span className="classes-count">{assignments.length}</span></TabsTrigger>
          <TabsTrigger value="announcements">Announcements<span className="classes-count">{announcements.length}</span></TabsTrigger>
        </TabsList>
        <div className="classes-page-layout" data-view={activeTab} data-empty={groups.length === 0}>
          <TabsContent value="classes" className="classes-content classes-overview">
            {groups.length === 0 ? <section className="classes-empty-overview"><ClassesEmpty icon={BookOpen} title="No classes yet" description="Join a class to receive assignments and announcements from your teacher or tutor."><Button onClick={() => setJoinModalOpen(true)}><Plus aria-hidden="true" className="h-4 w-4 mr-2" />Join a class</Button></ClassesEmpty></section> : <>
              <section className="classes-assignments-section" aria-labelledby="classes-assignments-heading">
                <div className="classes-section-heading"><div><h2 id="classes-assignments-heading">Your assignments<span className="classes-count">{pendingAssignments.length} to do</span></h2><p>Set by your tutors. Current work first.</p></div></div>
                {pendingAssignments.length ? <div className="classes-assignment-grid" role="region" aria-label="Your assignments" tabIndex={0}>{overviewAssignments.map(assignment => renderAssignment(assignment, "card"))}</div> : <AssignmentsEmpty completed={assignments.length > 0} />}
              </section>
              <section className="classes-cards-section" aria-labelledby="classes-cards-heading">
                <div className="classes-section-heading"><h2 id="classes-cards-heading">Your classes<span className="classes-count">{groups.length}</span></h2><div className="classes-search"><Search aria-hidden="true" /><Input aria-label="Search classes or tutors" placeholder="Search classes or tutors" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /></div></div>
                {filteredGroups.length ? <div className="classes-card-grid">{filteredGroups.map(group => {
                  const groupAssignments = getAssignmentsForGroup(group.id);
                  return <ClassCard key={group.id} group={group} tutorName={tutors.get(group.tutor_id)?.name}
                    assignmentCount={groupAssignments.length} completedCount={groupAssignments.filter(isCompleted).length}
                    announcementCount={getAnnouncementsForGroup(group.id).length} subjectColor={subjectColorForGroup(group.id)}
                    onClick={() => setSelectedClass(group)} />;
                })}</div> : <ClassesEmpty icon={Search} title="No matching classes" description="Try another class or tutor name." />}
              </section>
              <section className="classes-announcements-section" aria-labelledby="classes-announcements-heading">
                <div className="classes-section-heading"><h2 id="classes-announcements-heading">From your tutors</h2><Button variant="link" className="classes-view-all" onClick={() => setActiveTab("announcements")}>View all<ChevronRight aria-hidden="true" /></Button></div>
                <ClassAnnouncements announcements={announcements} groups={groups} selectedClass={announcementClass} onClassChange={setAnnouncementClass} limit={2} />
              </section>
            </>}
          </TabsContent>
          <TabsContent value="assignments" className="classes-content">
            <section className="classes-full-section" aria-labelledby="classes-all-assignments-heading"><div className="classes-section-heading"><div><h2 id="classes-all-assignments-heading">All assignments</h2><p>Tutor-set work, including submitted assignments.</p></div></div>
              {assignments.length ? <div className="classes-assignment-list">{sortedAssignments.map(assignment => renderAssignment(assignment, "row"))}</div> : <AssignmentsEmpty />}
            </section>
          </TabsContent>
          <TabsContent value="announcements" className="classes-content">
            <section className="classes-full-section" aria-labelledby="classes-all-announcements-heading"><div className="classes-section-heading"><div><h2 id="classes-all-announcements-heading">Announcements</h2><p>Updates and resources from your tutors.</p></div></div>
              <ClassAnnouncements announcements={announcements} groups={groups} selectedClass={announcementClass} onClassChange={setAnnouncementClass} />
            </section>
          </TabsContent>
          {groups.length > 0 && <aside className="classes-schedule-column" aria-label="Calendar and upcoming deadlines">
            <ClassDeadlineCalendar assignments={pendingAssignments} groups={groups} getSubjectColor={getSubjectColor}
              month={selectedMonth} selectedDate={selectedDate} onSelectDate={setSelectedDate}
              onMonthChange={month => { setSelectedMonth(month); setSelectedDate(undefined); }} />
            <section className="classes-deadline-section" aria-labelledby="classes-deadline-heading">
              <div className="classes-section-heading"><div><h2 id="classes-deadline-heading">Upcoming deadlines</h2><p>{selectedDate ? format(selectedDate, "EEEE, d MMMM") : format(selectedMonth, "MMMM yyyy") + " · work to hand in"}</p></div></div>
              <div className="classes-deadline-groups" aria-live="polite">{scheduleGroups.size ? Array.from(scheduleGroups, ([date, items]) => <div className="classes-deadline-group" key={date}><h3>{date === "No deadline" ? "No deadline" : format(new Date(date + "T12:00:00"), "EEEE, d MMM")}</h3>{items.map(assignment => renderAssignment(assignment, "schedule"))}</div>) : <p className="classes-schedule-empty">{selectedDate ? "No assignments due on this date." : "No assignments due this month."}</p>}</div>
            </section>
          </aside>}
        </div>
      </Tabs>
    </div>
    <JoinClassModal open={joinModalOpen} onOpenChange={setJoinModalOpen} onSuccess={loadStudentClasses} />
    {leaveConfirmation}
  </DashboardLayout>;
};

function ClassesEmpty({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children?: ReactNode }) {
  return <div className="classes-empty"><Icon aria-hidden="true" /><h3>{title}</h3><p>{description}</p>{children}</div>;
}

function AssignmentsEmpty({ completed = false }: { completed?: boolean }) {
  return <div className="classes-assignment-empty">
    <div className="classes-assignment-empty__divider" aria-hidden="true"><span /><CheckCircle2 /><span /></div>
    <h3>{completed ? "You’re all caught up" : "No assignments yet"}</h3>
    <p>{completed ? "Your submitted work is available under All assignments." : "Work set by your teacher or tutor will appear here."}</p>
  </div>;
}

function ClassesSkeleton() {
  return <div className="classes-workspace classes-loading" role="status" aria-label="Loading your classes"><span className="sr-only">Loading your classes</span>
    <div className="classes-page-heading"><div className="space-y-3"><Skeleton className="h-9 w-48" /><Skeleton className="h-4 w-64 max-w-full" /></div><Skeleton className="h-10 w-24" /></div>
    <Skeleton className="h-11 w-80 max-w-full my-7" />
    <div className="classes-skeleton-layout"><div className="space-y-7"><div className="classes-skeleton-cards">{[0, 1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div><div className="classes-skeleton-cards">{[0, 1, 2].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}</div><Skeleton className="h-28 rounded-xl" /></div><Skeleton className="h-96 rounded-xl" /></div>
  </div>;
}

export default MyClasses;
