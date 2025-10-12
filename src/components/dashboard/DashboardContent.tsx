import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, TrendingUp, Clock, Trophy, Flame, FileText, CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardContentProps {
  userEmail: string;
}

export const DashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const userName = userEmail.split("@")[0];

  const stats = [
    { label: "Exams Taken", value: "0", icon: FileText, color: "text-primary" },
    { label: "Average Score", value: "-", icon: TrendingUp, color: "text-success" },
    { label: "Study Hours", value: "0h", icon: Clock, color: "text-secondary" },
    { label: "Day Streak", value: "0", icon: Flame, color: "text-destructive" },
  ];

  const revisionGoals = [
    { subject: "Mathematics", progress: 0, target: 10 },
    { subject: "English", progress: 0, target: 8 },
    { subject: "Science", progress: 0, target: 12 },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome back, {userName}! 👋</h1>
          <p className="text-muted-foreground">
            Ready to ace your exams? Let's make today count!
          </p>
        </div>
        <Button size="lg" className="button-glow" onClick={() => navigate("/exams/new")}>
          <Plus className="w-5 h-5 mr-2" />
          New Exam
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Recent exams section */}
        <div className="md:col-span-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Exams
                <Button variant="ghost" size="sm" onClick={() => navigate("/exams")}>
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No exams yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start your first mock exam to track your progress
                </p>
                <Button onClick={() => navigate("/exams/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revision goals panel */}
        <div>
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Revision Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {revisionGoals.map((goal, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.subject}</span>
                    <span className="text-muted-foreground">
                      {goal.progress}/{goal.target} exams
                    </span>
                  </div>
                  <Progress value={(goal.progress / goal.target) * 100} className="h-2" />
                </div>
              ))}
              <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/goals")}>
                View All Goals
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick actions */}
      <Card className="border-2 bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/files")}>
              <Plus className="w-5 h-5" />
              <span>Upload Paper</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/quizzes/new")}>
              <CheckSquare className="w-5 h-5" />
              <span>Take Quiz</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/coach")}>
              <Trophy className="w-5 h-5" />
              <span>AI Coach</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
