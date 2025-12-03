import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentGroupSelector } from "@/components/tutor/StudentGroupSelector";
import { useTutorStudents } from "@/hooks/useTutorStudents";
import { BarChart3, Download, TrendingUp, Target, AlertCircle, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const StudentProgress = () => {
  const { students, loading } = useTutorStudents();
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter students by group and search query
  const filteredStudents = students.filter(student => {
    const matchesGroup = selectedGroup === "all" || student.group_id === selectedGroup;
    if (!matchesGroup) return false;
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.display_name?.toLowerCase().includes(query) ||
      student.student_code?.toLowerCase().includes(query)
    );
  });

  const handleExport = () => {
    const csv = [
      ["Name", "Student ID", "Group"],
      ...filteredStudents.map(s => [
        s.display_name || "Unknown",
        s.student_code || "N/A",
        s.group_name
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-roster-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Student roster exported");
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Student Progress</h1>
            <p className="text-muted-foreground">Track performance and identify areas for improvement</p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={students.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
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
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredStudents.length}</div>
              <p className="text-xs text-muted-foreground">
                {selectedGroup === "all" ? "Across all groups" : "In selected group"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">No data yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">No data yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weakest Topics</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">No data yet</p>
            </CardContent>
          </Card>
        </div>

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
              <div className="space-y-2">
                {filteredStudents.map((student) => (
                  <div
                    key={`${student.id}-${student.group_id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {student.display_name?.[0]?.toUpperCase() || "S"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {student.display_name || "Student"}
                          {student.student_code && (
                            <span className="text-muted-foreground ml-2 font-mono text-sm">
                              ({student.student_code})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.group_name}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">View Progress</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default StudentProgress;
