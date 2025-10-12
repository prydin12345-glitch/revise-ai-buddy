import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, TrendingUp, Clock, Trophy, Flame, CheckSquare, Calendar, MessageSquare, RotateCcw, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardContentProps {
  userEmail: string;
}

export const DashboardContent = ({ userEmail }: DashboardContentProps) => {
  const navigate = useNavigate();
  const userName = userEmail.split("@")[0];

  const stats = [
    { label: "Exams Taken", value: "0", emoji: "📄" },
    { label: "Average Score", value: "-", emoji: "📊" },
    { label: "Study Hours", value: "0h", emoji: "⏰" },
    { label: "Day Streak", value: "0", emoji: "🔥" },
  ];

  const revisionGoals = [
    { subject: "Mathematics", progress: 0, target: 10 },
    { subject: "English", progress: 0, target: 8 },
    { subject: "Science", progress: 0, target: 12 },
  ];

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: Main Content */}
        <div className="space-y-6">
          {/* Welcome header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome back, {userName}! 👋
            </h1>
            <p className="text-lg text-muted-foreground">
              Ready to ace your exams? Let's make today count!
            </p>
          </div>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              className="flex-1 h-14 text-base button-glow shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              onClick={() => navigate("/files")}
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload Exam Paper
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-14 text-base border-2 hover:border-primary transition-all duration-300 hover:scale-105"
              onClick={() => navigate("/exams/new")}
            >
              <FileText className="w-5 h-5 mr-2" />
              Start Blank Mock Exam
            </Button>
          </div>

          {/* Stats as floating badges */}
          <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="group relative bg-gradient-to-br from-[hsl(222,47%,15%)] to-[hsl(222,47%,11%)] border border-primary/20 rounded-2xl px-6 py-4 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1 hover:scale-105"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{stat.emoji}</span>
                  <div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-gray-400 font-medium">{stat.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent exams section */}
          <Card className="border-2 shadow-md">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Recent Exams
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/exams")} className="hover:scale-105 transition-transform">
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold mb-2">No exams yet! Let's get started.</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Start your first mock exam to track your progress and identify areas for improvement
                </p>
                <Button 
                  onClick={() => navigate("/exams/new")}
                  className="button-glow hover:scale-105 transition-transform"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar Panels */}
        <div className="space-y-6">
          {/* Revision goals panel */}
          <Card className="border-2 shadow-md sticky top-24">
            <CardHeader className="border-b bg-gradient-to-br from-primary/5 to-transparent">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trophy className="w-5 h-5 text-primary" />
                Revision Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {revisionGoals.map((goal, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{goal.subject}</span>
                    <span className="text-muted-foreground font-medium">
                      {goal.progress}/{goal.target}
                    </span>
                  </div>
                  <Progress 
                    value={(goal.progress / goal.target) * 100} 
                    className="h-2.5 bg-muted"
                  />
                </div>
              ))}
              <Button 
                variant="outline" 
                className="w-full mt-4 border-2 hover:border-primary hover:scale-105 transition-all"
                onClick={() => navigate("/goals")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </CardContent>
          </Card>

          {/* Quick actions panel */}
          <Card className="border-2 shadow-md">
            <CardHeader className="border-b bg-gradient-to-br from-secondary/5 to-transparent">
              <CardTitle className="text-xl">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex items-center gap-3 border-2 hover:border-primary hover:scale-105 transition-all"
                onClick={() => navigate("/coach")}
              >
                <div className="p-2 rounded-lg bg-destructive/10">
                  <RotateCcw className="w-5 h-5 text-destructive" />
                </div>
                <span className="font-medium flex-1 text-left">Review Weak Topics</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex items-center gap-3 border-2 hover:border-primary hover:scale-105 transition-all"
                onClick={() => navigate("/goals")}
              >
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Calendar className="w-5 h-5 text-secondary-foreground" />
                </div>
                <span className="font-medium flex-1 text-left">View Revision Plan</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex items-center gap-3 border-2 hover:border-primary hover:scale-105 transition-all"
                onClick={() => navigate("/coach")}
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium flex-1 text-left">Ask Examly</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
