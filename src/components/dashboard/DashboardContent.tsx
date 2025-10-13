import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, TrendingUp, Clock, Trophy, Flame, CheckSquare, Calendar, MessageSquare, RotateCcw, Plus, Heart, ClipboardList } from "lucide-react";
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
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Left: Main Content */}
        <div className="space-y-8">
          {/* Welcome header */}
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight text-foreground">
              Welcome back, {userName}
            </h1>
            <p className="text-xl text-muted-foreground">
              Ready to ace your exams? Let's make today count!
            </p>
          </div>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/files")}
            >
              <Upload className="w-5 h-5 mr-3" />
              UPLOAD
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-16 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/exams/new")}
            >
              <FileText className="w-5 h-5 mr-3" />
              Start Blank Mock Exam
            </Button>
          </div>

          {/* Recent exams section */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center justify-between text-2xl font-bold">
                <span>Recents</span>
                <button className="text-muted-foreground hover:text-foreground text-xl transition-colors">•••</button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">No exams yet! Let's get started.</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Start your first mock exam to track your progress and identify areas for improvement
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar Panels */}
        <div className="space-y-6">
          {/* Floating Stats Badges */}
          <div className="flex flex-wrap items-center gap-4 justify-end">
            <div className="flex items-center gap-2 text-foreground">
              <span className="text-3xl">💧</span>
              <span className="text-3xl font-bold">{stats[3].value}</span>
            </div>
            {[stats[0], stats[1], stats[2], stats[3]].map((stat, index) => (
              <div key={index} className="text-3xl">
                {stat.emoji}
              </div>
            ))}
          </div>

          {/* Revision goals panel */}
          <Card className="shadow-lg rounded-2xl sticky top-24">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <Trophy className="w-6 h-6 text-primary" />
                Revision Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {revisionGoals.map((goal, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium text-lg">{goal.subject}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-medium">
                        {goal.progress} / {goal.target}
                      </span>
                      <span className="text-4xl">
                        {goal.progress >= goal.target ? "🏆" : "📦"}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        goal.progress >= goal.target 
                          ? "bg-secondary" 
                          : "bg-primary"
                      }`}
                      style={{ width: `${(goal.progress / goal.target) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <Button 
                variant="outline" 
                className="w-full mt-4 border-2 hover:bg-accent transition-all rounded-xl h-12"
                onClick={() => navigate("/goals")}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Goal
              </Button>
            </CardContent>
          </Card>

          {/* Quick actions panel */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-2xl font-bold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-auto py-5 flex items-center gap-4 border-2 hover:bg-accent transition-all rounded-xl justify-start"
                onClick={() => navigate("/coach")}
              >
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-destructive" />
                </div>
                <span className="font-medium text-lg">Review Weak Topics</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-5 flex items-center gap-4 border-2 hover:bg-accent transition-all rounded-xl justify-start"
                onClick={() => navigate("/goals")}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-lg">View Revision Plan</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
