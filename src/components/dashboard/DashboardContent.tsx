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
      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: Main Content */}
        <div className="space-y-6">
          {/* Welcome header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Welcome back, {userName}! 👋
            </h1>
            <p className="text-lg text-gray-300">
              Ready to ace your exams? Let's make today count!
            </p>
          </div>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              className="flex-1 h-14 text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              onClick={() => navigate("/files")}
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload Exam Paper
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-14 text-base border-2 border-white/20 hover:border-primary bg-white/5 hover:bg-white/10 transition-all duration-300 hover:scale-105"
              onClick={() => navigate("/exams/new")}
            >
              <FileText className="w-5 h-5 mr-2" />
              Start Blank Mock Exam
            </Button>
          </div>

          {/* Recent exams section */}
          <Card className="border border-white/10 bg-[hsl(222,47%,11%)] shadow-xl">
            <CardHeader className="border-b border-white/10 bg-gradient-to-br from-primary/10 to-transparent">
              <CardTitle className="flex items-center justify-between text-xl text-white">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Recent Exams
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate("/exams")} 
                  className="text-gray-300 hover:text-white hover:bg-white/10 hover:scale-105 transition-all"
                >
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold mb-2 text-white">No exams yet! Let's get started.</h3>
                <p className="text-gray-300 mb-6 max-w-sm mx-auto">
                  Start your first mock exam to track your progress and identify areas for improvement
                </p>
                <Button 
                  onClick={() => navigate("/exams/new")}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
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
          {/* Floating Stats Badges */}
          <div className="flex flex-wrap gap-3 lg:justify-end">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="bg-gradient-to-br from-[hsl(222,47%,15%)] to-[hsl(222,47%,11%)] border border-primary/20 rounded-2xl px-5 py-3 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{stat.emoji}</span>
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="w-full border border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
            onClick={() => navigate("/stats")}
          >
            View More Stats
          </Button>

          {/* Revision goals panel */}
          <Card className="border border-white/10 bg-[hsl(222,47%,11%)] shadow-xl sticky top-24">
            <CardHeader className="border-b border-white/10 bg-gradient-to-br from-primary/10 to-transparent">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <Trophy className="w-5 h-5 text-primary" />
                Revision Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {revisionGoals.map((goal, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {goal.progress >= goal.target ? "🏆" : "📦"}
                      </span>
                      <span className="font-semibold text-white">{goal.subject}</span>
                    </div>
                    <span className="text-gray-400 font-medium">
                      {goal.progress}/{goal.target}
                    </span>
                  </div>
                  <Progress 
                    value={(goal.progress / goal.target) * 100} 
                    className="h-2.5 bg-white/10"
                  />
                </div>
              ))}
              <Button 
                variant="outline" 
                className="w-full mt-4 border-2 border-white/20 hover:border-primary bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white"
                onClick={() => navigate("/goals")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </CardContent>
          </Card>

          {/* Quick actions panel */}
          <Card className="border border-white/10 bg-[hsl(222,47%,11%)] shadow-xl">
            <CardHeader className="border-b border-white/10 bg-gradient-to-br from-secondary/10 to-transparent">
              <CardTitle className="text-xl text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex items-center gap-3 border-2 border-white/20 hover:border-primary bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white"
                onClick={() => navigate("/coach")}
              >
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Heart className="w-5 h-5 text-red-400" />
                </div>
                <span className="font-medium flex-1 text-left">Review Weak Topics</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex items-center gap-3 border-2 border-white/20 hover:border-primary bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white"
                onClick={() => navigate("/goals")}
              >
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                </div>
                <span className="font-medium flex-1 text-left">View Revision Plan</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-4 flex items-center gap-3 border-2 border-white/20 hover:border-primary bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white"
                onClick={() => navigate("/coach")}
              >
                <div className="p-2 rounded-lg bg-primary/20">
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
