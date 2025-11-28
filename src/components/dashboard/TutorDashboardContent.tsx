import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Users, ClipboardList, Calendar, UserPlus, BookOpen, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const TutorDashboardContent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGroups: 0,
    totalStudents: 0,
    totalExamsCreated: 0,
    totalAssignments: 0,
  });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [studentGroups, setStudentGroups] = useState<any[]>([]);

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

      // Load student groups
      const { data: groups, error: groupsError } = await supabase
        .from("student_groups")
        .select("*, group_members(*)")
        .eq("tutor_id", user.id)
        .eq("is_active", true);

      if (groupsError) throw groupsError;
      setStudentGroups(groups || []);

      // Load exam assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("exam_assignments")
        .select("*")
        .eq("assigned_by", user.id);

      if (assignmentsError) throw assignmentsError;

      // Calculate stats
      const totalStudents = groups?.reduce((sum, group) => sum + (group.group_members?.length || 0), 0) || 0;

      setStats({
        totalGroups: groups?.length || 0,
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

  const statCards = [
    { label: "Student Groups", value: stats.totalGroups, icon: Users, color: "text-blue-500" },
    { label: "Total Students", value: stats.totalStudents, icon: UserPlus, color: "text-green-500" },
    { label: "Exams Created", value: stats.totalExamsCreated, icon: ClipboardList, color: "text-purple-500" },
    { label: "Active Assignments", value: stats.totalAssignments, icon: Calendar, color: "text-orange-500" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button 
          onClick={() => navigate("/upload")} 
          className="h-24 flex flex-col gap-2"
          variant="outline"
        >
          <Upload className="h-6 w-6" />
          <span>Create Exam</span>
        </Button>
        <Button 
          onClick={() => navigate("/create-practice-questions")} 
          className="h-24 flex flex-col gap-2"
          variant="outline"
        >
          <BookOpen className="h-6 w-6" />
          <span>Create Practice</span>
        </Button>
        <Button 
          onClick={() => navigate("/tutor/exams")} 
          className="h-24 flex flex-col gap-2"
          variant="outline"
        >
          <Users className="h-6 w-6" />
          <span>Manage Exams</span>
        </Button>
        <Button 
          onClick={() => navigate("/tutor/progress")} 
          className="h-24 flex flex-col gap-2"
          variant="outline"
        >
          <TrendingUp className="h-6 w-6" />
          <span>View Progress</span>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`w-10 h-10 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Student Groups */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between text-2xl font-bold">
            <span>Your Student Groups</span>
            <Button variant="ghost" size="sm" onClick={() => toast.info("Create group coming soon!")}>
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
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {studentGroups.map((group) => (
                <Card key={group.id} className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {group.group_members?.length || 0} students
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

      {/* Recent Exams */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between text-2xl font-bold">
            <span>Your Exams</span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/my-exams")}>
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
            <div className="space-y-3">
              {recentExams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/exam/${exam.id}`)}
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{exam.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{exam.subject_id}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(exam.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Badge variant={exam.status === 'published' ? 'default' : 'secondary'}>
                    {exam.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
