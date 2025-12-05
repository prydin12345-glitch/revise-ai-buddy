import { useState, useEffect } from "react";
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
import { AssignmentCard } from "@/components/classes/AssignmentCard";
import { AnnouncementItem } from "@/components/classes/AnnouncementItem";

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

const MyClasses = () => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, { status: string; total_score?: number; total_marks?: number }>>(new Map());
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Classes</h1>
            <p className="text-muted-foreground mt-1">
              {getGreeting()}{firstName ? `, ${firstName}` : ""}! Manage your tutor groups, assignments, and announcements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthFilter value={selectedMonth} onChange={setSelectedMonth} />
            <Button
              onClick={() => setJoinModalOpen(true)}
              className="rounded-full w-10 h-10 p-0"
              title="Join a Class"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search classes or tutors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="classes" className="space-y-6">
          <TabsList>
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
          <TabsContent value="classes">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  .map(assignment => (
                    <div key={assignment.id}>
                      <p className="text-xs text-muted-foreground mb-1 ml-1">{assignment.group_name}</p>
                      <AssignmentCard
                        assignment={assignment}
                        submission={submissions.get(assignment.exam_id)}
                      />
                    </div>
                  ))}
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
