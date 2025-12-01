import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Calendar, FileText, MessageSquare, ExternalLink, Loader2, Bell, Plus, LogOut } from "lucide-react";
import { JoinClassModal } from "@/components/tutor/JoinClassModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface StudentGroup {
  id: string;
  name: string;
  description: string | null;
  tutor_id: string;
  invite_code: string | null;
  capacity: number | null;
  subjects_covered: any;
  joined_at: string;
}

interface GroupAssignment {
  id: string;
  exam_id: string;
  deadline: string | null;
  release_date: string | null;
  is_grades_released: boolean;
  exams: {
    id: string;
    title: string;
    subject_id: string;
    status: string;
  };
}

interface GroupAnnouncement {
  id: string;
  title: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
  tutor_id: string;
  group_id: string;
}

const MyClasses = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [assignments, setAssignments] = useState<Map<string, GroupAssignment[]>>(new Map());
  const [announcements, setAnnouncements] = useState<Map<string, GroupAnnouncement[]>>(new Map());
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<StudentGroup | null>(null);
  const [activeTab, setActiveTab] = useState("classes");

  useEffect(() => {
    loadStudentClasses();

    // Real-time subscription for group changes
    const groupsChannel = supabase
      .channel('student-groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, loadStudentClasses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_announcements' }, loadStudentClasses)
      .subscribe();

    return () => {
      supabase.removeChannel(groupsChannel);
    };
  }, []);

  const loadStudentClasses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch groups the student is a member of
      const { data: memberships, error: membershipsError } = await supabase
        .from("group_members")
        .select(`
          joined_at,
          student_groups (
            id,
            name,
            description,
            tutor_id,
            invite_code,
            capacity,
            subjects_covered
          )
        `)
        .eq("student_id", user.id)
        .eq("is_active", true);

      if (membershipsError) throw membershipsError;

      const groupsData = memberships?.map(m => ({
        ...(m.student_groups as any),
        joined_at: m.joined_at
      })) || [];

      setGroups(groupsData);

      // Fetch assignments and announcements for each group
      if (groupsData.length > 0) {
        const groupIds = groupsData.map(g => g.id);

        // Fetch assignments
        const { data: assignmentsData } = await supabase
          .from("exam_assignments")
          .select(`
            id,
            exam_id,
            deadline,
            release_date,
            is_grades_released,
            exams (
              id,
              title,
              subject_id,
              status
            )
          `)
          .eq("assignment_type", "group")
          .in("target_id", groupIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        const assignmentsMap = new Map<string, GroupAssignment[]>();
        assignmentsData?.forEach((assignment: any) => {
          const groupId = assignment.target_id;
          if (!assignmentsMap.has(groupId)) {
            assignmentsMap.set(groupId, []);
          }
          assignmentsMap.get(groupId)?.push(assignment);
        });
        setAssignments(assignmentsMap);

        // Fetch announcements
        const { data: announcementsData } = await supabase
          .from("group_announcements")
          .select("*")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false })
          .limit(10);

        const announcementsMap = new Map<string, GroupAnnouncement[]>();
        announcementsData?.forEach((announcement) => {
          if (!announcementsMap.has(announcement.group_id)) {
            announcementsMap.set(announcement.group_id, []);
          }
          announcementsMap.get(announcement.group_id)?.push(announcement);
        });
        setAnnouncements(announcementsMap);
      }
    } catch (error: any) {
      console.error("Error loading classes:", error);
      toast.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("group_members")
        .update({ is_active: false })
        .eq("group_id", selectedGroup.id)
        .eq("student_id", user.id);

      if (error) throw error;

      toast.success(`Left ${selectedGroup.name}`);
      setLeaveDialogOpen(false);
      setSelectedGroup(null);
      loadStudentClasses();
    } catch (error: any) {
      console.error("Error leaving group:", error);
      toast.error("Failed to leave class");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Classes</h1>
            <p className="text-muted-foreground mt-1">
              Manage your tutor groups, assignments, and announcements
            </p>
          </div>
          <Button onClick={() => setJoinModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Join a Class
          </Button>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Classes Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Join a class using your tutor's invite code to get started
              </p>
              <Button onClick={() => setJoinModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Join Your First Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="classes">My Classes</TabsTrigger>
              <TabsTrigger value="assignments">All Assignments</TabsTrigger>
              <TabsTrigger value="announcements">Recent Announcements</TabsTrigger>
            </TabsList>

            <TabsContent value="classes" className="space-y-4">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{group.name}</CardTitle>
                        {group.description && (
                          <p className="text-muted-foreground">{group.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="outline">
                            Joined {new Date(group.joined_at).toLocaleDateString()}
                          </Badge>
                          {group.subjects_covered && Array.isArray(group.subjects_covered) && group.subjects_covered.length > 0 && (
                            <Badge variant="secondary">
                              {group.subjects_covered.join(", ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedGroup(group);
                          setLeaveDialogOpen(true);
                        }}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Leave
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Assignments for this group */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Assignments ({assignments.get(group.id)?.length || 0})
                      </h4>
                      {assignments.get(group.id)?.length ? (
                        <div className="space-y-2">
                          {assignments.get(group.id)!.slice(0, 3).map((assignment) => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                              onClick={() => navigate(`/exam/${assignment.exam_id}/preview`)}
                            >
                              <div className="flex-1">
                                <p className="font-medium">{assignment.exams.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {assignment.exams.subject_id}
                                  </Badge>
                                  {assignment.deadline && (
                                    <Badge variant="destructive" className="text-xs">
                                      Due: {new Date(assignment.deadline).toLocaleDateString()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </div>
                          ))}
                          {assignments.get(group.id)!.length > 3 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full"
                              onClick={() => setActiveTab("assignments")}
                            >
                              View All {assignments.get(group.id)!.length} Assignments
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No assignments yet</p>
                      )}
                    </div>

                    {/* Announcements for this group */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Recent Announcements
                      </h4>
                      {announcements.get(group.id)?.length ? (
                        <div className="space-y-2">
                          {announcements.get(group.id)!.slice(0, 2).map((announcement) => (
                            <div
                              key={announcement.id}
                              className="p-3 border rounded-lg bg-muted/30"
                            >
                              <div className="flex items-start justify-between mb-1">
                                <p className="font-medium">{announcement.title}</p>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(announcement.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{announcement.message}</p>
                              {announcement.attachment_url && (
                                <a
                                  href={announcement.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View Attachment
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No announcements yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="assignments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  {Array.from(assignments.entries()).flatMap(([groupId, groupAssignments]) => 
                    groupAssignments.map(assignment => ({
                      ...assignment,
                      groupName: groups.find(g => g.id === groupId)?.name
                    }))
                  ).length > 0 ? (
                    <div className="space-y-3">
                      {Array.from(assignments.entries()).flatMap(([groupId, groupAssignments]) => 
                        groupAssignments.map(assignment => ({
                          ...assignment,
                          groupName: groups.find(g => g.id === groupId)?.name
                        }))
                      ).map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => navigate(`/exam/${assignment.exam_id}/preview`)}
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-lg">{assignment.exams.title}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{assignment.exams.subject_id}</Badge>
                              <Badge variant="secondary">{assignment.groupName}</Badge>
                              {assignment.deadline && (
                                <Badge variant="destructive">
                                  Due: {new Date(assignment.deadline).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-5 h-5 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No assignments yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="announcements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Announcements</CardTitle>
                </CardHeader>
                <CardContent>
                  {Array.from(announcements.entries()).flatMap(([groupId, groupAnnouncements]) =>
                    groupAnnouncements.map(announcement => ({
                      ...announcement,
                      groupName: groups.find(g => g.id === groupId)?.name
                    }))
                  ).length > 0 ? (
                    <div className="space-y-3">
                      {Array.from(announcements.entries()).flatMap(([groupId, groupAnnouncements]) =>
                        groupAnnouncements.map(announcement => ({
                          ...announcement,
                          groupName: groups.find(g => g.id === groupId)?.name
                        }))
                      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((announcement) => (
                        <div key={announcement.id} className="p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-lg">{announcement.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{announcement.groupName}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(announcement.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-muted-foreground mt-2">{announcement.message}</p>
                          {announcement.attachment_url && (
                            <a
                              href={announcement.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline mt-3 inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-4 h-4" />
                              View Attachment
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No announcements yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <JoinClassModal
        open={joinModalOpen}
        onOpenChange={setJoinModalOpen}
        onSuccess={loadStudentClasses}
      />

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{selectedGroup?.name}"? You'll need a new invite code to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup}>Leave Class</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MyClasses;
