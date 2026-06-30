import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { useSubjectAverage } from "@/hooks/useSubjectAverage";
import { SubjectCard } from "@/components/stats/SubjectCard";
import { ExamProfileModal } from "@/components/stats/ExamProfileModal";

const SubjectDetail = () => {
  const { subjectName: raw } = useParams<{ subjectName: string }>();
  const subjectNameParam = raw ? decodeURIComponent(raw) : "";
  const navigate = useNavigate();

  const { subjects, isLoading: subjectsLoading } = useUserSubjects();
  const {
    getTopicsForSubject,
    getProfilesForSubject,
    addTopic,
    removeTopic,
    createProfile,
    updateProfile,
    deleteProfile,
    loading: profilesLoading,
  } = useSubjectProfiles();

  const subject = useMemo(
    () => subjects.find((s) => s.subject_name.toLowerCase() === subjectNameParam.toLowerCase()),
    [subjects, subjectNameParam]
  );

  const { percentage } = useSubjectAverage(subject?.subject_name || "");

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);

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

  const handleOpenCreateProfile = () => {
    setEditingProfile(null);
    setProfileModalOpen(true);
  };
  const handleOpenEditProfile = (_subject: string, profile: any) => {
    setEditingProfile(profile);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (
    profileName: string,
    topics: string[],
    questionCount: number,
    educationalTier?: string,
    timeLimitMinutes?: number | null,
    advanced?: any,
    writtenQuestionCount?: number,
    structureSettings?: any
  ) => {
    const payload = {
      profile_name: profileName,
      topics,
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
    };
    if (editingProfile) {
      await updateProfile(editingProfile.id, payload);
    } else {
      await createProfile(
        subject.subject_name, profileName, topics, questionCount, educationalTier,
        timeLimitMinutes, advanced, writtenQuestionCount, structureSettings
      );
    }
  };

  const topicCount = getTopicsForSubject(subject.subject_name).length;
  const profileCount = getProfilesForSubject(subject.subject_name).length;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto w-full">
        {/* Back */}
        <Link
          to="/my-subjects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All subjects
        </Link>

        {/* Hero */}
        <div className="flex items-start gap-4">
          <span
            className="w-3 h-3 rounded-full mt-2 shrink-0"
            style={{ backgroundColor: subject.subject_color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {subject.subject_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {percentage !== null ? `Average ${percentage}%` : "Not yet tested"}
              {" · "}
              {topicCount} {topicCount === 1 ? "topic" : "topics"}
              {" · "}
              {profileCount} {profileCount === 1 ? "profile" : "profiles"}
              {subject.exam_board ? ` · ${subject.exam_board.toUpperCase()}` : ""}
            </p>
          </div>
        </div>

        {/* Reuse the existing SubjectCard for full management UI */}
        <SubjectCard
          subject={subject}
          getTopicsForSubject={getTopicsForSubject}
          getProfilesForSubject={getProfilesForSubject}
          handleAddTopic={addTopic}
          removeTopic={removeTopic}
          handleOpenCreateProfile={handleOpenCreateProfile}
          handleOpenEditProfile={handleOpenEditProfile}
          deleteProfile={deleteProfile}
          allSubjects={subjects}
        />

        <ExamProfileModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          subjectName={subject.subject_name}
          subjectColor={subject.subject_color}
          availableTopics={getTopicsForSubject(subject.subject_name).map((t) => t.topic)}
          onSave={handleSaveProfile}
          initialData={editingProfile || undefined}
        />
      </div>
    </DashboardLayout>
  );
};

export default SubjectDetail;
