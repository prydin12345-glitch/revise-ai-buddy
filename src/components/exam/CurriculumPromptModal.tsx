import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, ChevronRight, AlertTriangle } from "lucide-react";

interface ExamProfile {
  id: string;
  profile_name: string;
  topics: string[];
  question_count: number;
}

interface MasterTopic {
  id: string;
  topic: string;
}

interface CurriculumPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  subjectColor: string;
  masterTopics: MasterTopic[];
  profiles: ExamProfile[];
  onPracticeAll: (topics: string[]) => void;
  onSelectProfile: (profile: ExamProfile) => void;
  onStandardMode: () => void;
}

export const CurriculumPromptModal = ({
  open,
  onOpenChange,
  subjectName,
  subjectColor,
  masterTopics,
  profiles,
  onPracticeAll,
  onSelectProfile,
  onStandardMode,
}: CurriculumPromptModalProps) => {
  const topicCount = masterTopics.length;
  const hasTopics = topicCount > 0;
  // If the user has no master topics, jump straight to the profile list —
  // the "Practice All Saved Topics" primary action would do nothing.
  const [showProfiles, setShowProfiles] = useState(!hasTopics);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md backdrop-blur-xl bg-card/95 border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg">Use Your Custom Curriculum?</DialogTitle>
          <DialogDescription>
            {hasTopics ? "You have saved topics for " : "You have saved exam profiles for "}
            <span className="font-semibold" style={{ color: subjectColor }}>
              {subjectName}
            </span>
            . Choose how to generate your questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          {/* Primary: Practice All Saved Topics — only when master topics exist */}
          {hasTopics && (
            <button
              onClick={() => onPracticeAll(masterTopics.map((t) => t.topic))}
              className="w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md"
              style={{ borderColor: subjectColor, backgroundColor: subjectColor + "08" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: subjectColor + "20" }}
                >
                  <BookOpen className="h-5 w-5" style={{ color: subjectColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: subjectColor }}>
                    Practice All Saved Topics
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use all {topicCount} sub-topics from your manual curriculum.
                  </p>
                </div>
                <Badge
                  className="shrink-0 text-[10px] font-semibold"
                  style={{ backgroundColor: subjectColor, color: "white" }}
                >
                  {topicCount} Topics
                </Badge>
              </div>
            </button>
          )}

          {/* Secondary: Use Exam Profile */}
          {profiles.length > 0 && (
            <>
              {!showProfiles ? (
                <button
                  onClick={() => setShowProfiles(true)}
                  className="w-full text-left p-4 rounded-xl border border-border/60 hover:bg-muted/50 transition-all flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Use Exam Profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select from {profiles.length} saved profile{profiles.length > 1 ? "s" : ""} with curated topics.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ) : (
                <div className="space-y-2 p-3 rounded-xl border border-border/60 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                    Select a Profile
                  </p>
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => onSelectProfile(profile)}
                      className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">{profile.profile_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.topics.length} Topics · Max {profile.question_count} Questions
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                        style={{ borderColor: subjectColor, color: subjectColor }}
                      >
                        {profile.topics.length}T
                      </Badge>
                    </button>
                  ))}
                  {hasTopics && (
                    <button
                      onClick={() => setShowProfiles(false)}
                      className="text-xs text-muted-foreground hover:text-foreground w-full text-center pt-1"
                    >
                      ← Back
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {profiles.length === 0 && (
            <div className="text-center py-3 px-4 rounded-xl border border-dashed border-border/50">
              <p className="text-xs text-muted-foreground">
                No exam profiles created yet. Create one in My Subjects for curated topic sets.
              </p>
            </div>
          )}
        </div>

        {/* Standard Mode link */}
        <div className="text-center pt-1 pb-2">
          <button
            onClick={onStandardMode}
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground underline underline-offset-2 transition-colors"
          >
            Standard Mode — ignore saved topics and use default question bank
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Warning component for topic-to-question ratio
 */
export const TopicLimitWarning = ({
  topicCount,
  questionCount,
  subjectColor,
}: {
  topicCount: number;
  questionCount: number;
  subjectColor: string;
}) => {
  if (topicCount === 0 || questionCount <= topicCount * 3) return null;

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 mt-2">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-600 dark:text-amber-400">
        With only {topicCount} topic{topicCount > 1 ? "s" : ""}, some question styles may repeat at{" "}
        {questionCount} questions. Add more topics for greater variety.
      </p>
    </div>
  );
};
