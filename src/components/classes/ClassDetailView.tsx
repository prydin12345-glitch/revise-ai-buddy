import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, LogOut, BookOpen, Megaphone } from "lucide-react";
import { AssignmentCard } from "./AssignmentCard";
import { ProgressPanel } from "./ProgressPanel";
import { AnnouncementItem } from "./AnnouncementItem";
import { TutorProfilePreview } from "./TutorProfilePreview";

interface ClassDetailViewProps {
  group: {
    id: string;
    name: string;
    description?: string;
    subjects_covered?: { name: string }[];
  };
  tutor?: {
    name: string;
    bio?: string;
    subjects_taught?: string[];
  };
  assignments: Array<{
    id: string;
    exam_id: string;
    exam_title: string;
    exam_type: "uploaded" | "generated";
    deadline?: string;
    release_date?: string;
  }>;
  submissions: Map<string, { status: string; total_score?: number; total_marks?: number }>;
  announcements: Array<{
    id: string;
    title: string;
    message: string;
    created_at: string;
    attachment_url?: string;
  }>;
  onBack: () => void;
  onLeave: () => void;
}

export const ClassDetailView = ({
  group,
  tutor,
  assignments,
  submissions,
  announcements,
  onBack,
  onLeave,
}: ClassDetailViewProps) => {
  const completedCount = Array.from(submissions.values()).filter(
    (s) => s.status === "submitted"
  ).length;
  
  const gradedSubmissions = Array.from(submissions.values()).filter(
    (s) => s.status === "submitted" && s.total_score !== null && s.total_marks
  );
  
  const averageScore = gradedSubmissions.length > 0
    ? Math.round(
        gradedSubmissions.reduce((acc, s) => acc + (s.total_score! / s.total_marks!) * 100, 0) /
        gradedSubmissions.length
      )
    : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Classes
        </Button>
        <Button variant="outline" onClick={onLeave} className="gap-2 text-destructive hover:text-destructive">
          <LogOut className="w-4 h-4" />
          Leave Class
        </Button>
      </div>

      {/* Class Info */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">{group.name}</h1>
        {tutor && (
          <p className="text-muted-foreground">
            Taught by{" "}
            <TutorProfilePreview
              tutorName={tutor.name}
              bio={tutor.bio}
              subjectsTaught={tutor.subjects_taught}
            />
          </p>
        )}
        {group.description && (
          <p className="text-sm text-muted-foreground mt-2">{group.description}</p>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignments - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Upcoming Exams & Practice Sets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No assignments yet</p>
                </div>
              ) : (
                assignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    submission={submissions.get(assignment.exam_id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-4">
          <ProgressPanel
            completed={completedCount}
            total={assignments.length}
            averageScore={averageScore}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary" />
                Recent Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No announcements yet
                </p>
              ) : (
                announcements.slice(0, 3).map((announcement) => (
                  <AnnouncementItem
                    key={announcement.id}
                    announcement={announcement}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
