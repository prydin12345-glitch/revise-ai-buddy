import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Settings, FileText, Brain, Calendar } from "lucide-react";

const MyExams = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All Subjects");

  // Mock data - will be replaced with real data later
  const allExams = [
    {
      id: 1,
      name: "Calculus Final 2024",
      subject: "Mathematics",
      date: "Jan 15, 2024",
      type: "uploaded",
      icon: "📄"
    },
    {
      id: 2,
      name: "AI-Generated Mock",
      subject: "Science",
      date: "Jan 20, 2024",
      score: "85%",
      type: "generated",
      icon: "🤖"
    },
    {
      id: 3,
      name: "Literature Essay Practice",
      subject: "English",
      date: "Jan 18, 2024",
      type: "uploaded",
      icon: "📄"
    },
  ];

  const filters = ["All Subjects", "Mathematics", "English", "Science"];

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              My Exams
            </h1>
            <p className="text-lg text-muted-foreground">
              View, manage, and generate exams from past papers or AI.
            </p>
          </div>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-12 font-semibold border-2 hover:bg-accent hover:scale-[1.02] transition-all duration-200 rounded-xl"
              onClick={() => navigate("/upload")}
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload New Exam
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-12 font-semibold border-2 hover:bg-accent hover:scale-[1.02] transition-all duration-200 rounded-xl"
              onClick={() => navigate("/generate")}
            >
              <Settings className="w-5 h-5 mr-2" />
              Generate New Exam
            </Button>
          </div>
        </div>

        {/* Subject Filter Tabs */}
        <div className="flex flex-wrap gap-2 p-6 bg-card/30 rounded-xl border border-border/50">
          {filters.map((filter) => (
            <Button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`
                rounded-full px-5 py-2 text-sm font-medium transition-all duration-200
                ${activeFilter === filter 
                  ? "bg-[#1e40af] text-white hover:bg-[#1e3a8a] shadow-lg" 
                  : "bg-[#374151] text-muted-foreground hover:bg-[#4b5563]"
                }
              `}
            >
              {filter}
            </Button>
          ))}
        </div>

        {/* Unified Exams Grid */}
        {allExams.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-4">📚</div>
            <h3 className="text-2xl font-semibold mb-2 text-foreground">
              No exams yet
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Start by uploading a past paper or generating an AI-powered mock exam.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="border-2 hover:bg-accent transition-all rounded-xl"
                onClick={() => navigate("/upload")}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Exam
              </Button>
              <Button
                variant="outline"
                className="border-2 hover:bg-accent transition-all rounded-xl"
                onClick={() => navigate("/generate")}
              >
                <Settings className="w-4 h-4 mr-2" />
                Generate Exam
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allExams.map((exam) => (
              <Card 
                key={exam.id}
                className="group cursor-pointer bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-xl"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-3xl">{exam.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground text-lg mb-1 truncate">
                        {exam.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {exam.subject}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-border/30">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {exam.date}
                    </div>
                    {exam.score && (
                      <div className="text-sm font-semibold text-[#1e40af] bg-[#1e40af]/10 px-3 py-1 rounded-full">
                        {exam.score}
                      </div>
                    )}
                    {exam.type === "uploaded" && !exam.score && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    {exam.type === "generated" && !exam.score && (
                      <div className="flex items-center gap-1">
                        <Brain className="w-4 h-4 text-secondary" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyExams;
