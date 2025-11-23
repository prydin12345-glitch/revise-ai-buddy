import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Users, ClipboardList, Calendar, TrendingUp, BookOpen, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const TeacherDashboardContent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    totalExamsCreated: 0,
    totalAssignments: 0,
  });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);

  useEffect(() => {
    loadTeacherData();
  }, []);

  const loadTeacherData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load teacher's exams
      const { data: exams, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (examsError) throw examsError;
      setRecentExams(exams || []);

      // Load class assignments
      const { data: classes, error: classesError } = await supabase
        .from("class_assignments")
        .select("*")
        .eq("teacher_id", user.id);

      if (classesError) throw classesError;

      // Load exam assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("exam_assignments")
        .select("*, exams(title)")
        .eq("assigned_by", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (assignmentsError) throw assignmentsError;
      setRecentAssignments(assignments || []);

      // Calculate stats
      const uniqueClasses = new Set(classes?.map(c => c.class_name) || []).size;
      const uniqueStudents = new Set(classes?.map(c => c.student_id) || []).size;

      setStats({
        totalClasses: uniqueClasses,
        totalStudents: uniqueStudents,
        totalExamsCreated: exams?.length || 0,
        totalAssignments: assignments?.length || 0,
      });
    } catch (error) {
      console.error("Error loading teacher data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Total Classes", value: stats.totalClasses, icon: Users, color: "text-blue-500" },
    { label: "Total Students", value: stats.totalStudents, icon: UserCheck, color: "text-green-500" },
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
      {/* Primary Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button 
          size="lg" 
          variant="outline"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
          onClick={() => navigate("/upload")}
        >
          <Upload className="w-5 h-5 mr-2 sm:mr-3" />
          Create New Exam
        </Button>
        <Button 
          size="lg" 
          variant="outline"
          className="flex-1 h-14 sm:h-16 text-base sm:text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
          onClick={() => toast.info("Class management coming soon!")}
        >
          <Users className="w-5 h-5 mr-2 sm:mr-3" />
          Manage Classes
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

      {/* Recent Assignments */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center justify-between text-2xl font-bold">
            <span>Recent Assignments</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {recentAssignments.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No assignments created yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create an exam and assign it to your classes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{assignment.exams?.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{assignment.assignment_type}</Badge>
                      {assignment.class_name && (
                        <span className="text-sm text-muted-foreground">{assignment.class_name}</span>
                      )}
                      {assignment.deadline && (
                        <span className="text-sm text-muted-foreground">
                          Due: {new Date(assignment.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                    {assignment.is_active ? 'Active' : 'Inactive'}
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
