import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, LogOut, BookOpen, Megaphone, CheckCircle2, MessageSquare, Paperclip, CheckCircle } from "lucide-react";
import { AssignmentCard } from "./AssignmentCard";
import { CompletedAssignmentCard } from "./CompletedAssignmentCard";
import { ProgressPanel } from "./ProgressPanel";
import { ClassStatsPanel } from "./ClassStatsPanel";
import { TutorProfilePreview } from "./TutorProfilePreview";
import { FeedbackThreadItem } from "./FeedbackThreadItem";
import { SubjectProgressBreakdown } from "./SubjectProgressBreakdown";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface FeedbackThread {
  id: string;
  question_id: string;
  student_comment: string;
  tutor_response?: string;
  status: string;
  created_at: string;
  responded_at?: string;
  exam_id: string;
}

interface SubjectProgress {
  name: string;
  color: string;
  completed: number;
  total: number;
}

interface ClassDetailViewProps {
  group: {
    id: string;
    name: string;
    description?: string;
    subjects_covered?: { name: string; color?: string }[];
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
  submissions: Map<string, { 
    status: string; 
    total_score?: number; 
    total_marks?: number;
    submitted_at?: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    message: string;
    created_at: string;
    attachment_url?: string;
  }>;
  feedbackThreads?: FeedbackThread[];
  subjectProgress?: SubjectProgress[];
  onBack: () => void;
  onLeave: () => void;
}

export const ClassDetailView = ({
  group,
  tutor,
  assignments,
  submissions,
  announcements,
  feedbackThreads = [],
  subjectProgress = [],
  onBack,
  onLeave,
}: ClassDetailViewProps) => {
  const [selectedThread, setSelectedThread] = useState<FeedbackThread | null>(null);

  // Separate upcoming (not completed) and completed assignments
  const upcomingAssignments = assignments.filter(a => {
    const sub = submissions.get(a.exam_id);
    return !sub || (sub.status !== "submitted" && sub.status !== "graded");
  });

  const completedAssignments = assignments.filter(a => {
    const sub = submissions.get(a.exam_id);
    return sub && (sub.status === "submitted" || sub.status === "graded");
  });

  const completedCount = completedAssignments.length;
  
  const gradedSubmissions = Array.from(submissions.values()).filter(
    (s) => s.status === "submitted" && s.total_score !== null && s.total_marks
  );
  
  const averageScore = gradedSubmissions.length > 0
    ? Math.round(
        gradedSubmissions.reduce((acc, s) => acc + (s.total_score! / s.total_marks!) * 100, 0) /
        gradedSubmissions.length
      )
    : undefined;

  const pendingFeedback = feedbackThreads.filter(t => t.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Class Details</h1>
      </div>

      {/* Class Info */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6">
        <h2 className="text-2xl font-bold text-foreground mb-1">{group.name}</h2>
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
        {group.subjects_covered && group.subjects_covered.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {group.subjects_covered.map((subject, idx) => (
              <Badge 
                key={idx} 
                variant="secondary"
                style={{ 
                  backgroundColor: subject.color ? `${subject.color}20` : undefined,
                  color: subject.color || undefined
                }}
              >
                {subject.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Assignments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Assignments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Upcoming Exams & Practice Sets
                {upcomingAssignments.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {upcomingAssignments.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingAssignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-50 text-emerald-500" />
                  <p>All caught up! No pending assignments.</p>
                </div>
              ) : (
                upcomingAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    submission={submissions.get(assignment.exam_id)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Completed Assignments */}
          {completedAssignments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Completed Exams & Practice Sets
                  <Badge variant="secondary" className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {completedAssignments.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedAssignments.map((assignment) => {
                  const sub = submissions.get(assignment.exam_id);
                  const hasFeedback = feedbackThreads.some(t => t.exam_id === assignment.exam_id);
                  return (
                    <CompletedAssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      submission={sub!}
                      hasFeedback={hasFeedback}
                    />
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Feedback Threads */}
          {feedbackThreads.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Your Feedback Threads
                  <Badge variant="secondary" className="ml-auto">
                    {feedbackThreads.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {feedbackThreads.slice(0, 5).map((thread) => (
                  <FeedbackThreadItem
                    key={thread.id}
                    thread={thread}
                    onViewThread={setSelectedThread}
                  />
                ))}
                {feedbackThreads.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    +{feedbackThreads.length - 5} more threads
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-4">
          {/* Progress Panel */}
          <ProgressPanel
            completed={completedCount}
            total={assignments.length}
            averageScore={averageScore}
            pendingFeedback={pendingFeedback}
          />

          {/* Subject Breakdown */}
          {subjectProgress.length > 0 && (
            <Card className="border-border">
              <CardContent className="pt-4">
                <SubjectProgressBreakdown subjects={subjectProgress} />
              </CardContent>
            </Card>
          )}

          {/* Class Stats */}
          <ClassStatsPanel
            totalAssigned={assignments.length}
            totalCompleted={completedCount}
            averageScore={averageScore}
            pendingFeedback={pendingFeedback}
          />

          {/* Recent Announcements */}
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
                  <div key={announcement.id} className="p-3 border rounded-lg bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-foreground">{announcement.title}</h4>
                      {announcement.attachment_url && (
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {announcement.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Leave Class Button - Bottom */}
      <div className="flex justify-end pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={onLeave} 
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          Leave Class
        </Button>
      </div>

      {/* Feedback Thread View Dialog */}
      <Dialog open={!!selectedThread} onOpenChange={(open) => !open && setSelectedThread(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Feedback Thread
            </DialogTitle>
          </DialogHeader>
          
          {selectedThread && (
            <div className="space-y-4">
              {/* Student Comment */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">Your Question</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(selectedThread.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-muted text-sm">
                  {selectedThread.student_comment}
                </div>
              </div>

              {/* Tutor Response */}
              {selectedThread.tutor_response ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-emerald-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Tutor Response
                    </Badge>
                    {selectedThread.responded_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(selectedThread.responded_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                    {selectedThread.tutor_response}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
                  Awaiting tutor response...
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
