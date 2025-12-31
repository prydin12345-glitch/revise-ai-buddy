import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Upload, Users, ClipboardList, Calendar, UserPlus, BookOpen, 
  TrendingUp, ChevronRight, BarChart3, FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTutorStatsDrilldown, TutorDrilldownType } from "@/hooks/useTutorStatsDrilldown";
import { TutorStatsDrilldownDrawer } from "@/components/tutor/TutorStatsDrilldownDrawer";
import { CreateGroupModal } from "@/components/tutor/CreateGroupModal";

export const TutorDashboardContent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [stats, setStats] = useState({
    totalGroups: 0,
    totalStudents: 0,
    totalExamsCreated: 0,
    totalAssignments: 0,
  });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [studentGroups, setStudentGroups] = useState<any[]>([]);
  
  const drilldown = useTutorStatsDrilldown();

  useEffect(() => {
    loadTutorData();
  }, []);

  const loadTutorData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load tutor's exams
      const { data: exams, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (examsError) throw examsError;
      setRecentExams(exams || []);

      // Load student groups with ONLY active members
      const { data: groups, error: groupsError } = await supabase
        .from("student_groups")
        .select("*, group_members!inner(*)")
        .eq("tutor_id", user.id)
        .eq("is_active", true)
        .eq("group_members.is_active", true);

      if (groupsError && groupsError.code !== 'PGRST116') throw groupsError;
      
      // Also get groups with no members (the inner join above excludes them)
      const { data: allGroups, error: allGroupsError } = await supabase
        .from("student_groups")
        .select("id, name, description, created_at, invite_code")
        .eq("tutor_id", user.id)
        .eq("is_active", true);

      if (allGroupsError) throw allGroupsError;

      // Get active member counts for each group
      const groupsWithActiveCounts = await Promise.all(
        (allGroups || []).map(async (group) => {
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id)
            .eq("is_active", true);
          
          return {
            ...group,
            group_members: Array(count || 0).fill(null),
            active_member_count: count || 0,
          };
        })
      );

      setStudentGroups(groupsWithActiveCounts);

      // Load ACTIVE exam assignments only
      const { data: assignments, error: assignmentsError } = await supabase
        .from("exam_assignments")
        .select("*")
        .eq("assigned_by", user.id)
        .eq("is_active", true);

      if (assignmentsError) throw assignmentsError;

      // Calculate stats - use active member counts
      const totalStudents = groupsWithActiveCounts.reduce((sum, group) => sum + (group.active_member_count || 0), 0);

      setStats({
        totalGroups: allGroups?.length || 0,
        totalStudents,
        totalExamsCreated: exams?.length || 0,
        totalAssignments: assignments?.length || 0,
      });
    } catch (error) {
      console.error("Error loading tutor data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const statItems = [
    { label: "Student Groups", value: stats.totalGroups, icon: Users, drilldown: 'studentGroups' as TutorDrilldownType },
    { label: "Total Students", value: stats.totalStudents, icon: UserPlus, drilldown: 'totalStudents' as TutorDrilldownType },
    { label: "Exams Created", value: stats.totalExamsCreated, icon: ClipboardList, drilldown: 'examsCreated' as TutorDrilldownType },
    { label: "Active Assignments", value: stats.totalAssignments, icon: Calendar, drilldown: 'activeAssignments' as TutorDrilldownType },
  ];

  const quickActions = [
    { label: "Create Exam", icon: Upload, onClick: () => navigate("/upload") },
    { label: "Create Practice", icon: BookOpen, onClick: () => navigate("/create-practice-questions") },
    { label: "Manage Exams", icon: FileText, onClick: () => navigate("/tutor/exams") },
    { label: "View Progress", icon: TrendingUp, onClick: () => navigate("/tutor/progress") },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Stats Row - Compact icon+number style */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-card/30 border border-border/50">
        {statItems.map((stat, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => drilldown.openDrawer(stat.drilldown)}
                aria-label={`${stat.label}: ${stat.value}`}
              >
                <stat.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stat.value}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{stat.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Quick Actions - Icon-first compact style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action, index) => (
          <Button 
            key={index}
            onClick={action.onClick} 
            className="h-16 flex items-center justify-center gap-3 rounded-xl"
            variant="outline"
          >
            <action.icon className="h-5 w-5" />
            <span className="text-sm font-medium">{action.label}</span>
          </Button>
        ))}
      </div>

      {/* Student Groups */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between text-xl font-bold">
            <span>Your Student Groups</span>
            <Button variant="ghost" size="sm" onClick={() => setCreateGroupOpen(true)}>
              Create Group
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {studentGroups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No student groups yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create a group to organize your students
              </p>
              <Button className="mt-4" onClick={() => setCreateGroupOpen(true)}>
                Create Your First Group
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {studentGroups.map((group) => (
                <Card 
                  key={group.id} 
                  className="hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => navigate("/tutor/students")}
                >
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {group.active_member_count || 0} students
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(group.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Exams - Improved UI */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between text-xl font-bold">
            <span>Your Exams</span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tutor/exams")}>
              View All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {recentExams.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No exams created yet</p>
              <Button className="mt-4" onClick={() => navigate("/upload")}>
                Create Your First Exam
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentExams.map((exam) => (
                <button
                  key={exam.id}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={() => navigate(`/tutor/exams/${exam.id}?tab=results`)}
                  aria-label={`View ${exam.title}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{exam.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {exam.subject_id}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(exam.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={exam.status === 'published' ? 'default' : 'secondary'}>
                      {exam.status}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

      {/* Stats Drilldown Drawer */}
      <TutorStatsDrilldownDrawer
        type={drilldown.activeDrawer}
        onClose={drilldown.closeDrawer}
        loading={drilldown.loading}
        groups={drilldown.groups}
        students={drilldown.students}
        exams={drilldown.exams}
        assignments={drilldown.assignments}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccess={loadTutorData}
      />
    </>
  );
};
