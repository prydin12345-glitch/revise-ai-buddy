import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Settings, Search, FileText, Brain, Calendar, File } from "lucide-react";

const MyExams = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data - will be replaced with real data later
  const uploadedExams = [];
  const generatedExams = [];

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-5xl font-bold tracking-tight text-foreground">
                My Exams
              </h1>
              <p className="text-xl text-muted-foreground">
                View, manage, and generate exams from past papers or AI.
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search exams…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-card border-border text-foreground rounded-xl"
              />
            </div>
          </div>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-14 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/upload")}
            >
              <Upload className="w-5 h-5 mr-3" />
              Upload New Exam
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="flex-1 h-14 text-lg font-semibold border-2 hover:bg-accent transition-all duration-300 rounded-xl"
              onClick={() => navigate("/generate")}
            >
              <Settings className="w-5 h-5 mr-3" />
              Generate New Exam
            </Button>
          </div>

          {/* Filters/Sorting (Visual Only) */}
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="secondary" 
              size="sm"
              className="rounded-full px-4 py-2 text-sm font-medium"
            >
              All Subjects
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="rounded-full px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Mathematics
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="rounded-full px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              English
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="rounded-full px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Science
            </Button>
            <div className="ml-auto">
              <Button 
                variant="ghost" 
                size="sm"
                className="rounded-full px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Sort: Date ↓
              </Button>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Uploaded Exams */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <FileText className="w-6 h-6 text-primary" />
                Uploaded Exams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {uploadedExams.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📄</div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">
                    No uploaded exams yet
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Start by uploading a past paper to practice with real exam questions.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 border-2 hover:bg-accent transition-all rounded-xl"
                    onClick={() => navigate("/upload")}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Exam
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {uploadedExams.map((exam: any, index: number) => (
                    <Card key={index} className="hover:bg-accent transition-all cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <File className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{exam.name}</h4>
                          <p className="text-sm text-muted-foreground">{exam.subject}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {exam.date}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column - AI-Generated Exams */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <Brain className="w-6 h-6 text-secondary" />
                Generated Exams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {generatedExams.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🤖</div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">
                    No generated exams yet
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Use the AI to create your first mock exam tailored to your needs.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 border-2 hover:bg-accent transition-all rounded-xl"
                    onClick={() => navigate("/generate")}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Generate Exam
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedExams.map((exam: any, index: number) => (
                    <Card key={index} className="hover:bg-accent transition-all cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                          <Brain className="w-6 h-6 text-secondary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{exam.name}</h4>
                          <p className="text-sm text-muted-foreground">{exam.subject}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{exam.score}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {exam.date}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MyExams;
