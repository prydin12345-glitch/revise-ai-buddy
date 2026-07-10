import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Plus, Target, FileText, ListChecks, Activity } from "lucide-react";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { useSubjectAverage } from "@/hooks/useSubjectAverage";
import { useTopicPerformance } from "@/hooks/useTopicPerformance";
import { ExamProfileModal } from "@/components/stats/ExamProfileModal";
import { ExamProfileCard } from "@/components/subjects/ExamProfileCard";
import { TopicMasteryGrid } from "@/components/subjects/TopicMasteryGrid";
import { RecentActivityList } from "@/components/subjects/RecentActivityList";
import { getBoardDisplayName } from "@/lib/board-scrubber";

const SubjectDetail = () => {
  const { subjectName: raw } = useParams<{ subjectName: string }>();
  const subjectNameParam = raw ? decodeURIComponent(raw) : "";
  const navigate = useNavigate();

  const { subjects, isLoading: subjectsLoading } = useUserSubjects();
  const {
    getTopicsForSubject,
    getProfilesForSubject,
    createProfile,
    updateProfile,
    loading: profilesLoading,
  } = useSubjectProfiles();

  const subject = useMemo(
    () => subjects.find((s) => s.subject_name.toLowerCase() === subjectNameParam.toLowerCase()),
    [subjects, subjectNameParam]
  );

  const { percentage } = useSubjectAverage(subject?.subject_name || "");
  const { getPerformance } = useTopicPerformance(subject?.subject_name || "");

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);

  const topics = subject ? getTopicsForSubject(subject.subject_name) : [];
  const profiles = subject ? getProfilesForSubject(subject.subject_name) : [];
  const topicNames = topics.map((t) => t.topic);

  const weakestTopic = useMemo(() => {
    const scored = topicNames
      .map((t) => {
        const p = getPerformance(t);
        return { topic: t, score: p.percentage, attempts: p.questionsAttempted };
      })
      .filter((t) => t.attempts > 0);
    scored.sort((a, b) => a.score - b.score);
    return scored[0] ?? null;
  }, [topicNames, getPerformance]);

  if (subjectsLoading || profilesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!subject) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <Card className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-foreground mb-1">Subject not found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              "{subjectNameParam}" isn't in your subject list.
            </p>
            <Button onClick={() => navigate("/my-subjects")}>Back to subjects</Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const boardLabel = subject.exam_board ? getBoardDisplayName(subject.exam_board) : null;
  const displayName = (subject as any).custom_name || subject.subject_name;

  const handleOpenCreateProfile = () => {
    setEditingProfile(null);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (
    profileName: string,
    profileTopics: string[],
    questionCount: number,
    educationalTier?: string,
    timeLimitMinutes?: number | null,
    advanced?: any,
    writtenQuestionCount?: number,
    structureSettings?: any
  ) => {
    const payload = {
      profile_name: profileName,
      topics: profileTopics,
      question_count: questionCount,
      educational_tier: educationalTier || null,
      time_limit_minutes: timeLimitMinutes ?? null,
      structure_preset: advanced?.structurePreset ?? "custom",
      mcq_count: advanced?.mcqCount ?? 0,
      mcq_position: advanced?.mcqPosition ?? "start",
      mark_distribution: advanced?.markDistribution ?? {},
      include_extended: advanced?.includeExtended ?? false,
      extended_marks: advanced?.extendedMarks ?? 0,
      difficulty_progression: advanced?.difficultyProgression ?? "ascending",
      calculator_policy: advanced?.calculatorPolicy ?? "allowed",
      written_question_count: writtenQuestionCount ?? (questionCount - (advanced?.mcqCount ?? 0)),
      question_structure: structureSettings?.questionStructure ?? "standalone",
      parent_question_count: structureSettings?.parentQuestionCount ?? 4,
      max_parts_per_question: structureSettings?.maxPartsPerQuestion ?? 3,
      mcq_options_count: structureSettings?.mcqOptionsCount ?? 4,
      include_graphs: structureSettings?.includeGraphs ?? false,
      include_tables: structureSettings?.includeTables ?? false,
      studied_texts: (advanced as any)?.studiedTexts ?? null,
      paper_blueprint: (advanced as any)?.paperBlueprint ?? null,
    };
    if (editingProfile) {
      await updateProfile(editingProfile.id, payload);
    } else {
      await createProfile(
        subject.subject_name, profileName, profileTopics, questionCount, educationalTier,
        timeLimitMinutes, advanced, writtenQuestionCount, structureSettings
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-8 max-w-5xl mx-auto w-full">
        {/* Back */}
        <Link
          to="/my-subjects"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All subjects
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4">
          <span
            className="w-3 h-3 rounded-full mt-2.5 shrink-0"
            style={{ backgroundColor: subject.subject_color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {displayName}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {percentage !== null ? `Average ${percentage}%` : "Not yet tested"}
              {" · "}
              {topics.length} {topics.length === 1 ? "topic" : "topics"}
              {" · "}
              {profiles.length} {profiles.length === 1 ? "profile" : "profiles"}
              {boardLabel ? ` · ${boardLabel}` : ""}
            </p>
          </div>
        </div>

        {/* SECTION 1 — Exam Profiles */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Exam Profiles</h2>
            </div>
            <button
              onClick={handleOpenCreateProfile}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-[12.5px] font-semibold hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New profile
            </button>
          </div>

          {profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
              <p className="text-[13px] text-muted-foreground mb-3">
                No exam profiles yet. Create one to set up the structure for your exams and practice quizzes.
              </p>
              <button
                onClick={handleOpenCreateProfile}
                className="text-[13px] text-primary font-semibold hover:underline"
              >
                Create your first profile
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profiles.map((profile) => (
                <ExamProfileCard
                  key={profile.id}
                  profile={profile as any}
                  subjectName={subject.subject_name}
                  onEdit={() => {
                    setEditingProfile(profile);
                    setProfileModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2 — Topic Mastery */}
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Topic Performance</h2>
            </div>
            <p className="text-[12px] text-muted-foreground mt-1 ml-6">
              Across all your exams and practice for {displayName}
            </p>
          </div>

          {weakestTopic && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground">
                  Focus area: {weakestTopic.topic}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  Your average on this topic is {Math.round(weakestTopic.score)}%. A targeted practice session could help.
                </div>
              </div>
              <button
                onClick={() =>
                  navigate(
                    `/create-practice-questions?source=weak_topics&subject=${encodeURIComponent(
                      subject.subject_name
                    )}&subtopic=${encodeURIComponent(weakestTopic.topic)}`
                  )
                }
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-500/90 transition-colors whitespace-nowrap"
              >
                Practice now
              </button>
            </div>
          )}

          <TopicMasteryGrid subjectName={subject.subject_name} topics={topicNames} />
        </section>

        {/* SECTION 3 — Recent Activity */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold text-foreground">Recent Activity</h2>
          </div>
          <RecentActivityList subjectName={subject.subject_name} />
        </section>

        <ExamProfileModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          subjectName={subject.subject_name}
          subjectColor={subject.subject_color}
          availableTopics={topicNames}
          onSave={handleSaveProfile}
          initialData={editingProfile || undefined}
        />
      </div>
    </DashboardLayout>
  );
};

export default SubjectDetail;
