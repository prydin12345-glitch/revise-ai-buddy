import { useTopicPerformance, MASTERY_COLORS } from "@/hooks/useTopicPerformance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, FileText, Pencil, Trash2, Layers } from "lucide-react";
import { TopicSearchInput } from "./TopicSearchInput";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SubjectCardProps {
  subject: { id: string; subject_name: string; subject_color: string };
  getTopicsForSubject: (s: string) => { id: string; topic: string }[];
  getProfilesForSubject: (s: string) => { id: string; profile_name: string; topics: string[]; question_count: number }[];
  handleAddTopic: (subject: string, topic: string) => Promise<void>;
  removeTopic: (id: string) => Promise<void>;
  handleOpenCreateProfile: (subject: string) => void;
  handleOpenEditProfile: (subject: string, profile: { id: string; profile_name: string; topics: string[]; question_count: number }) => void;
  deleteProfile: (id: string) => Promise<void>;
}

const MASTERY_LABELS = {
  untested: "Not yet tested",
  weak: "< 40% — needs work",
  developing: "40–70% — improving",
  strong: "> 70% — solid",
};

export const SubjectCard = ({
  subject,
  getTopicsForSubject,
  getProfilesForSubject,
  handleAddTopic,
  removeTopic,
  handleOpenCreateProfile,
  handleOpenEditProfile,
  deleteProfile,
}: SubjectCardProps) => {
  const subjectTopics = getTopicsForSubject(subject.subject_name);
  const subjectProfiles = getProfilesForSubject(subject.subject_name);
  const { getPerformance } = useTopicPerformance(subject.subject_name);

  return (
    <Card className="overflow-hidden relative group transition-shadow hover:shadow-lg">
      <div className="h-1.5 w-full" style={{ backgroundColor: subject.subject_color }} />
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: subject.subject_color + "20", color: subject.subject_color }}
            >
              {subject.subject_name.charAt(0).toUpperCase()}
            </div>
            <h3 className="font-semibold text-foreground">{subject.subject_name}</h3>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            {subjectTopics.length} topics
          </Badge>
        </div>

        {/* Topic Search Input */}
        <TopicSearchInput
          subjectName={subject.subject_name}
          existingTopics={subjectTopics.map((t) => t.topic)}
          onAddTopic={(topic) => handleAddTopic(subject.subject_name, topic)}
          placeholder="Search & add topic..."
          className="w-full"
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-[10px]">
          {(["strong", "developing", "weak", "untested"] as const).map((level) => (
            <span
              key={level}
              className="flex items-center gap-1"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: MASTERY_COLORS[level].text }}
              />
              <span className="text-muted-foreground capitalize">{level}</span>
            </span>
          ))}
        </div>

        {/* Topic Chips */}
        <div className="min-h-[40px]">
          {subjectTopics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence mode="popLayout">
                {subjectTopics.map((t) => {
                  const perf = getPerformance(t.topic);
                  const colors = MASTERY_COLORS[perf.mastery];
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="gap-1 cursor-pointer group/chip transition-colors rounded-full px-3 py-1 hover:opacity-80"
                              style={{
                                backgroundColor: colors.bg,
                                color: colors.text,
                                borderColor: colors.border,
                                borderWidth: "1px",
                              }}
                              onClick={() => removeTopic(t.id)}
                            >
                              {t.topic}
                              {perf.mastery !== "untested" && (
                                <span className="text-[9px] opacity-70 ml-0.5">
                                  {perf.percentage}%
                                </span>
                              )}
                              <X className="h-3 w-3 opacity-50 group-hover/chip:opacity-100 transition-opacity" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">{t.topic}</p>
                            <p className="text-muted-foreground">
                              {perf.questionsAttempted > 0
                                ? `${perf.percentage}% accuracy · ${perf.questionsAttempted} questions`
                                : "Not yet tested"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Layers className="h-4 w-4 opacity-40" />
              <p className="text-xs">No topics added yet.</p>
            </div>
          )}
        </div>

        {/* Exam Profiles Section */}
        <div className="border-t border-border/50 pt-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Exam Profiles
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-primary hover:text-primary"
              onClick={() => handleOpenCreateProfile(subject.subject_name)}
            >
              <Plus className="h-3 w-3" />
              Create
            </Button>
          </div>

          {subjectProfiles.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 italic">
              No profiles yet — create one to auto-fill exams.
            </p>
          ) : (
            <div className="space-y-1.5">
              {subjectProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 group/profile transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{profile.profile_name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {profile.question_count}Q · {profile.topics.length}T
                    </Badge>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover/profile:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleOpenEditProfile(subject.subject_name, profile)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => deleteProfile(profile.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
