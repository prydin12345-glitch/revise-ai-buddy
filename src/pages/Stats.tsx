import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Target,
  Calendar as CalendarIcon,
  Plus,
  Edit,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RevisionGoal {
  id: string;
  subject: string;
  subject_color: string;
  target_exams: number;
  target_percentage: number | null;
  deadline: string | null;
  progress: number;
}

const Stats = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "stats";
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [revisionGoals, setRevisionGoals] = useState<RevisionGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load revision goals with progress
      const { data: goals } = await supabase
        .from("revision_goals")
        .select("*")
        .eq("user_id", user.id);

      if (goals) {
        const goalsWithProgress = await Promise.all(
          goals.map(async (goal) => {
            const { data: exams } = await supabase
              .from("exams")
              .select("id")
              .eq("user_id", user.id)
              .eq("subject_id", goal.subject);

            if (!exams || exams.length === 0) {
              return { ...goal, progress: 0 };
            }

            const examIds = exams.map((e) => e.id);
            const { data: submissions } = await supabase
              .from("exam_submissions")
              .select("exam_id")
              .in("exam_id", examIds)
              .eq("student_id", user.id);

            const uniqueCompletedExams = new Set(
              submissions?.map((s) => s.exam_id) || []
            );

            return {
              ...goal,
              progress: uniqueCompletedExams.size,
            };
          })
        );

        setRevisionGoals(goalsWithProgress);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for charts - will be replaced with real data
  const scoreProgressionData = [
    { exam: "Exam 1", score: 65 },
    { exam: "Exam 2", score: 72 },
    { exam: "Exam 3", score: 78 },
    { exam: "Exam 4", score: 85 },
  ];

  const subjectMasteryData = revisionGoals.map(goal => ({
    name: goal.subject,
    value: goal.progress,
    color: goal.subject_color,
  }));

  const weakTopics = [
    {
      subject: "Mathematics",
      topic: "Calculus - Integration",
      score: 45,
      totalQuestions: 20,
      color: "#3B82F6",
    },
    {
      subject: "Physics",
      topic: "Quantum Mechanics",
      score: 52,
      totalQuestions: 15,
      color: "#10B981",
    },
    {
      subject: "Chemistry",
      topic: "Organic Chemistry - Reactions",
      score: 38,
      totalQuestions: 25,
      color: "#F59E0B",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Stats</h1>
            <p className="text-muted-foreground mt-1">
              Track your progress and identify areas for improvement
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="stats" className="text-base">
              <BarChart3 className="w-4 h-4 mr-2" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="weak-topics" className="text-base">
              <AlertCircle className="w-4 h-4 mr-2" />
              Weak Topics
            </TabsTrigger>
            <TabsTrigger value="revision-plan" className="text-base">
              <Target className="w-4 h-4 mr-2" />
              Revision Plan
            </TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            {/* Score Progression */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Score Progression
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={scoreProgressionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="exam" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--primary))", r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subject Mastery */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Subject Mastery
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subjectMasteryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={subjectMasteryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {subjectMasteryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      No subject data yet. Complete some exams to see your mastery!
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Goal Completion */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    Goal Completion
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {revisionGoals.length > 0 ? (
                    revisionGoals.map((goal) => (
                      <div key={goal.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{goal.subject}</span>
                          <span className="text-sm text-muted-foreground">
                            {goal.progress}/{goal.target_exams}
                          </span>
                        </div>
                        <Progress
                          value={(goal.progress / goal.target_exams) * 100}
                          className="h-2"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No goals set yet. Add a goal to track your progress!
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Activity Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Activity Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-accent/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Time Spent</div>
                    <div className="text-2xl font-bold mt-1">0h</div>
                  </div>
                  <div className="bg-accent/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Most Active Day</div>
                    <div className="text-2xl font-bold mt-1">-</div>
                  </div>
                  <div className="bg-accent/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Current Streak</div>
                    <div className="text-2xl font-bold mt-1">0 days</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Weak Topics Tab */}
          <TabsContent value="weak-topics" className="space-y-4">
            {weakTopics.length > 0 ? (
              weakTopics.map((topic, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge style={{ backgroundColor: topic.color }}>
                            {topic.subject}
                          </Badge>
                          <h3 className="font-semibold text-lg">{topic.topic}</h3>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-medium">{topic.score}%</span>
                          </div>
                          <Progress value={topic.score} className="h-2" />
                          <p className="text-sm text-muted-foreground">
                            {topic.score}% correct on {topic.totalQuestions} questions
                          </p>
                        </div>
                      </div>
                      <div className="ml-4 space-y-2">
                        <Button size="sm" className="w-full">
                          <BookOpen className="w-4 h-4 mr-2" />
                          Review Now
                        </Button>
                        <Button size="sm" variant="outline" className="w-full">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark Reviewed
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Weak Topics Found</h3>
                  <p className="text-muted-foreground">
                    Complete more exams to identify areas for improvement
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Revision Plan Tab */}
          <TabsContent value="revision-plan" className="space-y-4">
            <div className="flex justify-end gap-2 mb-4">
              <Button onClick={() => navigate("/dashboard")}>
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </div>

            {revisionGoals.length > 0 ? (
              <div className="space-y-4">
                {revisionGoals.map((goal) => {
                  const daysLeft = goal.deadline
                    ? Math.ceil(
                        (new Date(goal.deadline).getTime() - new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : null;

                  return (
                    <Card key={goal.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: goal.subject_color }}
                              />
                              <h3 className="font-semibold text-lg">{goal.subject}</h3>
                              {daysLeft !== null && (
                                <Badge variant={daysLeft < 7 ? "destructive" : "secondary"}>
                                  {daysLeft > 0 ? `${daysLeft} days left` : "Overdue"}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">
                                  {goal.progress}/{goal.target_exams} exams
                                </span>
                              </div>
                              <Progress
                                value={(goal.progress / goal.target_exams) * 100}
                                className="h-2"
                              />
                              {goal.target_percentage && (
                                <p className="text-sm text-muted-foreground">
                                  Target: {goal.target_percentage}% average score
                                </p>
                              )}
                              {goal.deadline && (
                                <p className="text-sm text-muted-foreground">
                                  Deadline: {new Date(goal.deadline).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate("/dashboard")}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Goal
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Revision Goals Set</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first goal to start tracking your revision plan
                  </p>
                  <Button onClick={() => navigate("/dashboard")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Goal
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Stats;
