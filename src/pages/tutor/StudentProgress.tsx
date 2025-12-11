import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StudentGroupSelector } from "@/components/tutor/StudentGroupSelector";
import { useTutorStudents } from "@/hooks/useTutorStudents";
import { StudentStatsCards } from "@/components/tutor/StudentStatsCards";
import { StudentRosterCard } from "@/components/tutor/StudentRosterCard";
import { StudentProgressDashboard } from "@/components/tutor/StudentProgressDashboard";
import { AggregateScoreHistogramModal } from "@/components/tutor/AggregateScoreHistogramModal";
import { AggregateCompletionModal } from "@/components/tutor/AggregateCompletionModal";
import { AggregateWeakestTopicsModal } from "@/components/tutor/AggregateWeakestTopicsModal";
import { Download, Loader2, Search, Users, GraduationCap, RefreshCw, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type SortOption = "name-asc" | "name-desc" | "score-high" | "score-low" | "completion-high" | "completion-low";

const StudentProgress = () => {
  const { students, loading, aggregateStats, allSubmissions, completionBreakdown, topicAnalysis } = useTutorStudents();
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<typeof students[0] | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [lastUpdated] = useState(new Date());
  
  // Modal states for interactive stats
  const [showScoreHistogram, setShowScoreHistogram] = useState(false);
  const [showCompletionBreakdown, setShowCompletionBreakdown] = useState(false);
  const [showWeakestTopics, setShowWeakestTopics] = useState(false);

  // Filter students by group and search query
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesGroup = selectedGroup === "all" || student.group_id === selectedGroup;
      if (!matchesGroup) return false;
      
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const firstName = student.first_name || student.display_name?.split(" ")[0] || "";
      return (
        firstName.toLowerCase().includes(query) ||
        student.display_name?.toLowerCase().includes(query) ||
        student.student_code?.toLowerCase().includes(query)
      );
    });
  }, [students, selectedGroup, searchQuery]);

  // Sort students
  const sortedStudents = useMemo(() => {
    const sorted = [...filteredStudents];
    switch (sortBy) {
      case "name-asc":
        return sorted.sort((a, b) => {
          const nameA = a.first_name || a.display_name || "";
          const nameB = b.first_name || b.display_name || "";
          return nameA.localeCompare(nameB);
        });
      case "name-desc":
        return sorted.sort((a, b) => {
          const nameA = a.first_name || a.display_name || "";
          const nameB = b.first_name || b.display_name || "";
          return nameB.localeCompare(nameA);
        });
      case "score-high":
        return sorted.sort((a, b) => (b.average_score || 0) - (a.average_score || 0));
      case "score-low":
        return sorted.sort((a, b) => (a.average_score || 0) - (b.average_score || 0));
      case "completion-high":
        return sorted.sort((a, b) => (b.completion_rate || 0) - (a.completion_rate || 0));
      case "completion-low":
        return sorted.sort((a, b) => (a.completion_rate || 0) - (b.completion_rate || 0));
      default:
        return sorted;
    }
  }, [filteredStudents, sortBy]);

  // Calculate filtered stats
  const filteredAverageScore = filteredStudents.length > 0
    ? filteredStudents.reduce((sum, s) => sum + (s.average_score || 0), 0) / 
      filteredStudents.filter(s => (s.average_score || 0) > 0).length || 0
    : 0;

  const filteredCompletionRate = filteredStudents.length > 0
    ? filteredStudents.reduce((sum, s) => sum + (s.completion_rate || 0), 0) / 
      filteredStudents.filter(s => (s.exams_assigned || 0) > 0).length || 0
    : 0;

  // Get weakest topics from filtered students
  const subjectScores: Record<string, { total: number; count: number }> = {};
  filteredStudents.forEach(s => {
    if (s.weakest_subject && (s.average_score || 0) > 0) {
      if (!subjectScores[s.weakest_subject]) {
        subjectScores[s.weakest_subject] = { total: 0, count: 0 };
      }
      subjectScores[s.weakest_subject].count++;
    }
  });
  
  const weakestTopics = Object.entries(subjectScores)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([subject]) => subject);

  // Filter topic analysis based on selected group
  const filteredTopicAnalysis = useMemo(() => {
    // Topic analysis is already aggregated across all students
    // In a more advanced version, we could filter by group
    return topicAnalysis.slice(0, 10);
  }, [topicAnalysis]);

  // Get weakest topic names for display
  const displayWeakestTopics = useMemo(() => {
    if (filteredTopicAnalysis.length > 0) {
      return filteredTopicAnalysis.slice(0, 3).map(t => t.topic);
    }
    return weakestTopics.length > 0 ? weakestTopics : aggregateStats.weakestTopics;
  }, [filteredTopicAnalysis, weakestTopics, aggregateStats.weakestTopics]);

  const handleExport = () => {
    const csv = [
      ["Name", "Student ID", "Group", "Avg Score", "Completion Rate", "Weakest Subject"],
      ...sortedStudents.map(s => [
        s.first_name || s.display_name?.split(" ")[0] || "Unknown",
        s.student_code || "N/A",
        s.group_name,
        s.average_score ? `${Math.round(s.average_score)}%` : "N/A",
        s.completion_rate ? `${Math.round(s.completion_rate)}%` : "N/A",
        s.weakest_subject || "N/A"
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-progress-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Student progress report exported");
  };
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-progress-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Student progress report exported");
  };

  const handleViewProgress = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
      setDashboardOpen(true);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Student Progress
            </h1>
            <p className="text-muted-foreground mt-1">Track performance and identify areas for improvement</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Last updated: {format(lastUpdated, "MMM d, yyyy, h:mm a")}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={students.length === 0} className="gap-2 hover:shadow-md transition-all">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <StudentGroupSelector value={selectedGroup} onValueChange={setSelectedGroup} />
            </div>
            <div className="w-full sm:w-48">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="bg-background/50">
                  <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="score-high">Score (High to Low)</SelectItem>
                  <SelectItem value="score-low">Score (Low to High)</SelectItem>
                  <SelectItem value="completion-high">Completion (High)</SelectItem>
                  <SelectItem value="completion-low">Completion (Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <StudentStatsCards
        totalStudents={filteredStudents.length}
        averageScore={filteredAverageScore}
        completionRate={filteredCompletionRate}
        weakestTopics={displayWeakestTopics}
        selectedGroup={selectedGroup}
        loading={loading}
        onAverageScoreClick={() => setShowScoreHistogram(true)}
        onCompletionRateClick={() => setShowCompletionBreakdown(true)}
        onWeakestTopicsClick={() => setShowWeakestTopics(true)}
      />

      {/* Student Roster */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-primary" />
                Student Roster
              </CardTitle>
              <CardDescription className="mt-1">
                {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                </Card>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/30 w-fit mx-auto mb-4">
                <Users className="h-12 w-12 opacity-50" />
              </div>
              <p className="text-lg font-medium mb-2">No students assigned yet</p>
              <p className="text-sm">Students will appear here once they join your groups</p>
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/30 w-fit mx-auto mb-4">
                <Search className="h-12 w-12 opacity-50" />
              </div>
              <p className="text-lg font-medium mb-2">No students match your search</p>
              <p className="text-sm">Try a different search term or group filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedStudents.map((student, index) => (
                <StudentRosterCard
                  key={`${student.id}-${student.group_id}`}
                  student={student}
                  onViewProgress={handleViewProgress}
                  animationDelay={index * 50}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Progress Dashboard Modal */}
      <StudentProgressDashboard
        open={dashboardOpen}
        onOpenChange={setDashboardOpen}
        student={selectedStudent}
      />

      {/* Aggregate Stats Modals */}
      <AggregateScoreHistogramModal
        open={showScoreHistogram}
        onOpenChange={setShowScoreHistogram}
        submissions={allSubmissions}
      />
      <AggregateCompletionModal
        open={showCompletionBreakdown}
        onOpenChange={setShowCompletionBreakdown}
        completionData={completionBreakdown}
        totalStudents={filteredStudents.length}
      />
      <AggregateWeakestTopicsModal
        open={showWeakestTopics}
        onOpenChange={setShowWeakestTopics}
        topicData={filteredTopicAnalysis}
      />
    </div>
  );
};

export default StudentProgress;
