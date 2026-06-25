import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, BookOpen, Megaphone, ClipboardList, Users, Calendar, TrendingUp } from "lucide-react";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { MonthFilter } from "@/components/classes/MonthFilter";
import { ClassCard } from "@/components/classes/ClassCard";
import { ClassDetailView } from "@/components/classes/ClassDetailView";
import { AnnouncementItem } from "@/components/classes/AnnouncementItem";
import { AssignmentRow } from "@/components/classes/AssignmentRow";
import { ProgressItem } from "@/components/classes/ProgressItem";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { format, isSameMonth, isSameYear } from "date-fns";

interface StudentGroup {
  id: string;
  name: string;
  description?: string;
  tutor_id: string;
  subjects_covered?: { name: string; color?: string }[];
  joined_at?: string;
}

interface GroupAssignment {
  id: string;
  exam_id: string;
  exam_title: string;
  exam_type: "uploaded" | "generated";
  deadline?: string;
  release_date?: string;
  group_id: string;
  group_name: string;
}

interface GroupAnnouncement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  attachment_url?: string;
  group_id: string;
  group_name: string;
}

interface TutorInfo {
  name: string;
  bio?: string;
  subjects_taught?: string[];
}

interface SubmissionData {
  status: string;
  total_score?: number;
  total_marks?: number;
  submitted_at?: string;
}

interface FeedbackThread {
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
  const { getSubjectColor } = useUserSubjects();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, SubmissionData>>(new Map());
  const [tutors, setTutors] = useState<Map<string, TutorInfo>>(new Map());
  const [feedbackThreads, setFeedbackThreads] = useState<FeedbackThread[]>([]);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<StudentGroup | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [groupToLeave, setGroupToLeave] = useState<StudentGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    loadStudentClasses();

    // Real-time subscription for announcements
    const channel = supabase
      .channel('student-classes-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_announcements' }, (payload) => {
        const announcement = payload.new as any;
        if (groups.some(g => g.id === announcement.group_id)) {
          toast.success(`New announcement: ${announcement.title}`);
          loadStudentClasses();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-select class from URL param
  useEffect(() => {
    const classId = searchParams.get('classId');
    if (classId && groups.length > 0 && !selectedClass) {
      const match = groups.find(g => g.id === classId);
      if (match) setSelectedClass(match);
    }
  }, [groups, searchParams]);

  const loadStudentClasses = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's first name
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, display_name")
        .eq("id", user.id)
        .single();
      
      setFirstName(profile?.first_name || profile?.display_name?.split(" ")[0] || "");

      // Get student's group memberships
      const { data: memberships } = await supabase
        .from("group_members")
        .select(`
          group_id,
          joined_at,
          student_groups!inner (
            id, name, description, tutor_id, subjects_covered, is_active
          )
        `)
        .eq("student_id", user.id)
        .eq("is_active", true);

      if (!memberships || memberships.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const activeGroups: StudentGroup[] = memberships
        .filter((m: any) => m.student_groups?.is_active)
        .map((m: any) => ({
          id: m.student_groups.id,
          name: m.student_groups.name,
          description: m.student_groups.description,
          tutor_id: m.student_groups.tutor_id,
          subjects_covered: m.student_groups.subjects_covered || [],
          joined_at: m.joined_at,
        }));

      setGroups(activeGroups);

      // Get tutor info
      const tutorIds = [...new Set(activeGroups.map(g => g.tutor_id))];
      const { data: tutorProfiles } = await supabase
        .from("tutor_profiles")
        .select("user_id, bio, subjects_taught")
        .in("user_id", tutorIds);

      const { data: tutorUserProfiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", tutorIds);

      const tutorMap = new Map<string, TutorInfo>();
      tutorIds.forEach(id => {
        const profile = tutorUserProfiles?.find(p => p.id === id);
        const tutorProfile = tutorProfiles?.find(p => p.user_id === id);
        const name = profile?.display_name || 
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || 
          "Tutor";
        tutorMap.set(id, {
          name,
          bio: tutorProfile?.bio || undefined,
          subjects_taught: (tutorProfile?.subjects_taught as string[]) || [],
        });
      });
      setTutors(tutorMap);

      // Get assignments for all groups
      const groupIds = activeGroups.map(g => g.id);
      const { data: examAssignments } = await supabase
        .from("exam_assignments")
        .select(`
          id, exam_id, deadline, release_date, target_id,
          exams!inner (id, title, type, status)
        `)
        .eq("assignment_type", "group")
        .eq("is_active", true)
        .in("target_id", groupIds);

      const allAssignments: GroupAssignment[] = (examAssignments || [])
        .filter((a: any) => a.exams?.status === "published")
        .map((a: any) => {
          const group = activeGroups.find(g => g.id === a.target_id);
          return {
            id: a.id,
            exam_id: a.exam_id,
            exam_title: a.exams?.title || "Untitled",
            exam_type: a.exams?.type || "uploaded",
            deadline: a.deadline,
            release_date: a.release_date,
            group_id: a.target_id,
            group_name: group?.name || "",
          };
        });

      setAssignments(allAssignments);

      // Get student submissions
      const examIds = allAssignments.map(a => a.exam_id);
      if (examIds.length > 0) {
        const { data: studentSubmissions } = await supabase
          .from("exam_submissions")
          .select("exam_id, status, total_score, total_marks, submitted_at")
          .eq("student_id", user.id)
          .in("exam_id", examIds);

        const submissionMap = new Map();
        studentSubmissions?.forEach(s => {
          submissionMap.set(s.exam_id, {
            status: s.status,
            total_score: s.total_score,
            total_marks: s.total_marks,
            submitted_at: s.submitted_at,
          });
        });
        setSubmissions(submissionMap);

        // Fetch feedback threads for submitted exams
        const { data: threads } = await supabase
          .from("question_feedback_threads")
          .select("*")
          .eq("student_id", user.id)
          .in("exam_id", examIds)
          .order("created_at", { ascending: false });

        setFeedbackThreads(threads || []);
      }

      // Get announcements
      const { data: groupAnnouncements } = await supabase
        .from("group_announcements")
        .select("id, title, message, created_at, attachment_url, group_id")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(20);

      const allAnnouncements: GroupAnnouncement[] = (groupAnnouncements || []).map(a => {
        const group = activeGroups.find(g => g.id === a.group_id);
        return { ...a, group_name: group?.name || "" };
      });

      setAnnouncements(allAnnouncements);
    } catch (error) {
      console.error("Error loading classes:", error);
      toast.error("Failed to load your classes");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupToLeave) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("group_members")
        .update({ is_active: false })
        .eq("group_id", groupToLeave.id)
        .eq("student_id", user.id);

      if (error) throw error;

      toast.success(`Left ${groupToLeave.name}`);
      setGroups(prev => prev.filter(g => g.id !== groupToLeave.id));
      setSelectedClass(null);
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error("Failed to leave class");
    } finally {
      setLeaveDialogOpen(false);
      setGroupToLeave(null);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutors.get(g.tutor_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAssignmentsForGroup = (groupId: string) =>
    assignments.filter(a => a.group_id === groupId);

  const getAnnouncementsForGroup = (groupId: string) =>
    announcements.filter(a => a.group_id === groupId);

  const getFeedbackThreadsForGroup = (groupId: string) => {
    const groupExamIds = assignments.filter(a => a.group_id === groupId).map(a => a.exam_id);
    return feedbackThreads.filter(t => groupExamIds.includes(t.exam_id));
  };

  const getSubjectProgressForGroup = (groupId: string): SubjectProgress[] => {
    const group = groups.find(g => g.id === groupId);
    if (!group?.subjects_covered || group.subjects_covered.length === 0) return [];

    const groupAssignments = assignments.filter(a => a.group_id === groupId);
    
    // For each subject in the group, calculate completion
    return group.subjects_covered.map(subject => {
      // In a real scenario, we'd match assignments to subjects based on exam data
      // For now, distribute assignments across subjects evenly or use all
      const total = groupAssignments.length;
      const completed = groupAssignments.filter(a => {
        const sub = submissions.get(a.exam_id);
        return sub && (sub.status === "submitted" || sub.status === "graded");
      }).length;

      return {
        name: subject.name,
        color: subject.color || "#3B82F6",
        completed,
        total,
      };
    });
  };

  // Filter assignments by selected month
  const upcomingAssignments = useMemo(() => {
    return assignments
      .filter(a => {
        if (!a.deadline) return true;
        const deadline = new Date(a.deadline);
        return isSameMonth(deadline, selectedMonth) && isSameYear(deadline, selectedMonth);
      })
      .filter(a => {
        const sub = submissions.get(a.exam_id);
        return !sub || sub.status !== "graded";
      })
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [assignments, submissions, selectedMonth]);

  // Group assignments by date
  const groupedAssignments = useMemo(() => {
    const grouped: Record<string, GroupAssignment[]> = {};
    upcomingAssignments.forEach(a => {
      const dateKey = a.deadline ? format(new Date(a.deadline), "dd/MM/yyyy") : "No deadline";
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(a);
    });
    return grouped;
  }, [upcomingAssignments]);

  // Get completed assignments (graded only, tutor-assigned)
  const completedAssignments = useMemo(() => {
    return assignments.filter(a => {
      const sub = submissions.get(a.exam_id);
      return sub && (sub.status === "graded" || sub.status === "submitted");
    });
  }, [assignments, submissions]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="rounded-md" style={{ aspectRatio: "1 / 1.414" }} />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show detailed view for selected class
  if (selectedClass) {
    const tutor = tutors.get(selectedClass.tutor_id);
    const classAssignments = getAssignmentsForGroup(selectedClass.id);
    const classAnnouncements = getAnnouncementsForGroup(selectedClass.id);
    const classFeedbackThreads = getFeedbackThreadsForGroup(selectedClass.id);
    const classSubjectProgress = getSubjectProgressForGroup(selectedClass.id);

    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ClassDetailView
            group={selectedClass}
            tutor={tutor}
            assignments={classAssignments}
            submissions={submissions}
            announcements={classAnnouncements}
            feedbackThreads={classFeedbackThreads}
            subjectProgress={classSubjectProgress}
            onBack={() => setSelectedClass(null)}
            onLeave={() => {
              setGroupToLeave(selectedClass);
              setLeaveDialogOpen(true);
            }}
          />
        </div>

        <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {groupToLeave?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                You will no longer receive assignments or announcements from this class.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground">
                Leave Class
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    );
  }

  // Group classes by primary subject for subject-grouped scrollers
  const groupedClasses = useMemo(() => {
    const map = new Map<string, StudentGroup[]>();
    filteredGroups.forEach((g) => {
      const key = g.subjects_covered?.[0]?.name || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return Array.from(map.entries());
  }, [filteredGroups]);

  const getCompletedCountForGroup = (groupId: string) =>
    getAssignmentsForGroup(groupId).filter((a) => {
      const sub = submissions.get(a.exam_id);
      return sub && (sub.status === "submitted" || sub.status === "graded");
    }).length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Page header */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">My Classes</h1>
              <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
                Classes you've joined, assignments from your tutors, and announcements.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setJoinModalOpen(true)}
            className="rounded-full h-11 sm:h-10 px-0 sm:px-4 w-11 sm:w-auto gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Join a class</span>
          </Button>
        </header>

        <Tabs defaultValue="classes" className="space-y-6">
          <div className="relative -mx-4 sm:mx-0">
            <TabsList className="bg-muted/50 mx-4 sm:mx-0">
              <TabsTrigger value="classes" className="gap-2">
                <BookOpen className="w-4 h-4" />
                My Classes
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-2">
                <ClipboardList className="w-4 h-4" />
                All Assignments
              </TabsTrigger>
              <TabsTrigger value="announcements" className="gap-2">
                <Megaphone className="w-4 h-4" />
                Announcements
              </TabsTrigger>
            </TabsList>
          </div>

          {/* My Classes Tab */}
          <TabsContent value="classes" className="space-y-8">
            {groups.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed border-border bg-card/40">
                <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold text-foreground mb-1">No classes yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Join a class to receive assignments and announcements from your tutor.
                </p>
                <Button onClick={() => setJoinModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Join a class
                </Button>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search classes or tutors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>

                {/* Subject-grouped horizontal scrollers */}
                <div className="space-y-8">
                  {groupedClasses.map(([subjectName, classesInGroup]) => {
                    const subjectColor = getSubjectColor(subjectName);
                    return (
                      <section key={subjectName} aria-label={subjectName}>
                        <div className="flex items-center gap-2.5 mb-3 px-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subjectColor }}
                            aria-hidden
                          />
                          <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                            {subjectName}
                          </h2>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {classesInGroup.length}
                          </span>
                        </div>

                        <div className="relative -mx-4 sm:-mx-6">
                          <div className="flex gap-4 overflow-x-auto px-4 sm:px-6 pb-3 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin]">
                            {classesInGroup.map((group) => (
                              <div
                                key={group.id}
                                className="snap-start shrink-0 w-[200px] sm:w-[220px] md:w-[240px]"
                              >
                                <ClassCard
                                  group={group}
                                  tutorName={tutors.get(group.tutor_id)?.name}
                                  assignmentCount={getAssignmentsForGroup(group.id).length}
                                  announcementCount={getAnnouncementsForGroup(group.id).length}
                                  completedCount={getCompletedCountForGroup(group.id)}
                                  subjectColor={subjectColor}
                                  onClick={() => setSelectedClass(group)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>

                {/* Two-panel layout: Upcoming Assignments + Progress */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Upcoming Assignments */}
                  <div className="md:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Calendar className="h-4 w-4" />
                        </span>
                        <h2 className="text-base font-semibold text-foreground">Upcoming Assignments</h2>
                      </div>
                      <MonthFilter value={selectedMonth} onChange={setSelectedMonth} />
                    </div>

                    {Object.keys(groupedAssignments).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No upcoming work for this month.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(groupedAssignments).map(([date, dateAssignments]) => (
                          <div key={date} className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{date}</p>
                            {dateAssignments.map((assignment) => {
                              const group = groups.find((g) => g.id === assignment.group_id);
                              const tutor = group ? tutors.get(group.tutor_id) : undefined;
                              const primarySubject = group?.subjects_covered?.[0]?.name;

                              return (
                                <AssignmentRow
                                  key={assignment.id}
                                  assignment={{
                                    id: assignment.id,
                                    exam_id: assignment.exam_id,
                                    title: assignment.exam_title,
                                    type: assignment.exam_type,
                                    deadline: assignment.deadline || null,
                                    release_date: assignment.release_date,
                                  }}
                                  className={assignment.group_name}
                                  tutorName={tutor?.name}
                                  submission={submissions.get(assignment.exam_id)}
                                  subjectColor={primarySubject ? getSubjectColor(primarySubject) : undefined}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                      <h2 className="text-base font-semibold text-foreground">Progress</h2>
                    </div>

                    {completedAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No completed work yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {completedAssignments.slice(0, 5).map((assignment) => {
                          const sub = submissions.get(assignment.exam_id);
                          const group = groups.find((g) => g.id === assignment.group_id);
                          const primarySubject = group?.subjects_covered?.[0]?.name;

                          return (
                            <ProgressItem
                              key={assignment.id}
                              examId={assignment.exam_id}
                              title={assignment.exam_title}
                              className={assignment.group_name}
                              subject={primarySubject}
                              score={sub?.total_score || 0}
                              totalMarks={sub?.total_marks || 100}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* All Assignments Tab */}
          <TabsContent value="assignments">
            {assignments.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed border-border bg-card/40">
                <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold text-foreground mb-1">No assignments</h3>
                <p className="text-sm text-muted-foreground">
                  Your tutors haven't assigned any exams or practice sets yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl">
                {assignments
                  .sort((a, b) => {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                  })
                  .map((assignment) => {
                    const group = groups.find((g) => g.id === assignment.group_id);
                    const tutor = group ? tutors.get(group.tutor_id) : undefined;

                    return (
                      <AssignmentRow
                        key={assignment.id}
                        assignment={{
                          id: assignment.id,
                          exam_id: assignment.exam_id,
                          title: assignment.exam_title,
                          type: assignment.exam_type,
                          deadline: assignment.deadline || null,
                          release_date: assignment.release_date,
                        }}
                        className={assignment.group_name}
                        tutorName={tutor?.name}
                        submission={submissions.get(assignment.exam_id)}
                      />
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            {announcements.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed border-border bg-card/40">
                <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold text-foreground mb-1">No announcements</h3>
                <p className="text-sm text-muted-foreground">
                  Your tutors haven't posted any announcements yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                {announcements.map((announcement) => (
                  <AnnouncementItem key={announcement.id} announcement={announcement} showGroupName />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <JoinClassModal
        open={joinModalOpen}
        onOpenChange={setJoinModalOpen}
        onSuccess={loadStudentClasses}
      />

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {groupToLeave?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer receive assignments or announcements from this class.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground">
              Leave Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MyClasses;
