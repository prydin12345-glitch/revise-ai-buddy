import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentGroupSelector } from "@/components/tutor/StudentGroupSelector";
import { useTutorStudents } from "@/hooks/useTutorStudents";
import { StudentStatsCards } from "@/components/tutor/StudentStatsCards";
import { StudentRosterCard } from "@/components/tutor/StudentRosterCard";
import { StudentProgressDashboard } from "@/components/tutor/StudentProgressDashboard";
import { Download, Loader2, Search, Users, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const StudentProgress = () => {
  const { students, loading, aggregateStats } = useTutorStudents();
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<typeof students[0] | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Filter students by group and search query
  const filteredStudents = students.filter(student => {
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

  const handleExport = () => {
    const csv = [
      ["Name", "Student ID", "Group", "Avg Score", "Completion Rate", "Weakest Subject"],
      ...filteredStudents.map(s => [
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

  const handleViewProgress = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
      setDashboardOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Student Progress</h1>
            <p className="text-muted-foreground">Track performance and identify areas for improvement</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={students.length === 0} className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-64">
              <StudentGroupSelector value={selectedGroup} onValueChange={setSelectedGroup} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <StudentStatsCards
        totalStudents={filteredStudents.length}
        averageScore={filteredAverageScore}
        completionRate={filteredCompletionRate}
        weakestTopics={weakestTopics.length > 0 ? weakestTopics : aggregateStats.weakestTopics}
        selectedGroup={selectedGroup}
      />

      {/* Student Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Roster
          </CardTitle>
          <CardDescription>
            {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No students assigned yet</p>
              <p className="text-sm">Students will appear here once they join your groups</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No students match your search</p>
              <p className="text-sm">Try a different search term or group filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <StudentRosterCard
                  key={`${student.id}-${student.group_id}`}
                  student={student}
                  onViewProgress={handleViewProgress}
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
    </div>
  );
};

export default StudentProgress;
