import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, BookOpen, Megaphone, ClipboardList } from "lucide-react";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { MonthFilter } from "@/components/classes/MonthFilter";
import { ClassCard } from "@/components/classes/ClassCard";
import { ClassDetailView } from "@/components/classes/ClassDetailView";
import { AnnouncementItem } from "@/components/classes/AnnouncementItem";
import { AssignmentRow } from "@/components/classes/AssignmentRow";
import { ProgressItem } from "@/components/classes/ProgressItem";
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
}

const MyClasses = () => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, SubmissionData>>(new Map());
  const [tutors, setTutors] = useState<Map<string, TutorInfo>>(new Map());
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
          .select("exam_id, status, total_score, total_marks")
          .eq("student_id", user.id)
          .in("exam_id", examIds);

        const submissionMap = new Map();
        studentSubmissions?.forEach(s => {
          submissionMap.set(s.exam_id, {
            status: s.status,
            total_score: s.total_score,
            total_marks: s.total_marks,
          });
        });
        setSubmissions(submissionMap);
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
        <div className="p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-48 rounded-xl" />
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

    return (
      <DashboardLayout>
        <div className="p-6">
          <ClassDetailView
            group={selectedClass}
            tutor={tutor}
            assignments={classAssignments}
            submissions={submissions}
            announcements={classAnnouncements}
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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header Row 1: Title + Month dropdown + Join button */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">My Classes</h1>
          <div className="flex items-center gap-3">
            <MonthFilter value={selectedMonth} onChange={setSelectedMonth} />
            <Button
              onClick={() => setJoinModalOpen(true)}
              className="rounded-full w-9 h-9 p-0"
              title="Join a Class"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Header Row 2: Search + Tabs on same row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Search bar */}
          <div className="relative w-full sm:w-64 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search classes or tutors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Tabs - inline with search */}
          <Tabs defaultValue="classes" className="flex-1">
            <TabsList className="bg-muted/50">
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

          {/* My Classes Tab */}
          <TabsContent value="classes" className="space-y-6 mt-6">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Classes Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Join a class to start receiving assignments and announcements from your tutor.
                </p>
                <Button onClick={() => setJoinModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Join a Class
                </Button>
              </div>
            ) : (
              <>
                {/* Horizontal scrolling class cards */}
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mx-1 px-1">
                  {filteredGroups.map(group => (
                    <ClassCard
                      key={group.id}
                      group={group}
                      tutorName={tutors.get(group.tutor_id)?.name}
                      assignmentCount={getAssignmentsForGroup(group.id).length}
                      announcementCount={getAnnouncementsForGroup(group.id).length}
                      onClick={() => setSelectedClass(group)}
                    />
                  ))}
                </div>

                {/* Two-panel layout: Upcoming Assignments + Progress */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Upcoming Assignments - Left Panel (2/3) */}
                  <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Upcoming Assignments</h2>
                    
                    {Object.keys(groupedAssignments).length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        You have no upcoming exams or practice questions set by your tutors.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(groupedAssignments).map(([date, dateAssignments]) => (
                          <div key={date} className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">{date}</p>
                            {dateAssignments.map(assignment => {
                              const group = groups.find(g => g.id === assignment.group_id);
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
                                    release_date: assignment.release_date
                                  }}
                                  className={assignment.group_name}
                                  tutorName={tutor?.name}
                                  submission={submissions.get(assignment.exam_id)}
                                  subjectColor={primarySubject ? `hsl(var(--primary))` : undefined}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Progress - Right Panel (1/3) */}
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Progress</h2>
                    
                    {completedAssignments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8 text-sm">
                        You have no completed exams or practice questions from your tutors yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {completedAssignments.slice(0, 5).map(assignment => {
                          const sub = submissions.get(assignment.exam_id);
                          const group = groups.find(g => g.id === assignment.group_id);
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
              <div className="text-center py-16">
                <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Assignments</h3>
                <p className="text-muted-foreground">
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
                  .map(assignment => {
                    const group = groups.find(g => g.id === assignment.group_id);
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
                          release_date: assignment.release_date
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
              <div className="text-center py-16">
                <Megaphone className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Announcements</h3>
                <p className="text-muted-foreground">
                  Your tutors haven't posted any announcements yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                {announcements.map(announcement => (
                  <AnnouncementItem
                    key={announcement.id}
                    announcement={announcement}
                    showGroupName
                  />
                ))}
              </div>
            )}
          </TabsContent>
          </Tabs>
        </div>
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
