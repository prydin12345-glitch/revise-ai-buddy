import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen } from "lucide-react";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { ExamProfileModal } from "./ExamProfileModal";
import { AddSubjectModal } from "./AddSubjectModal";
import { SubjectCard } from "./SubjectCard";

export const MySubjectsPanel = () => {
  const { subjects, isLoading: subjectsLoading, refetch: refetchSubjects } = useUserSubjects();
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

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState("");
  const [editingProfile, setEditingProfile] = useState<{
    id: string;
    profile_name: string;
    topics: string[];
    question_count: number;
  } | null>(null);

  if (subjectsLoading || profilesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <>
        <Card className="border-dashed border-2 border-border/50">
          <div className="text-center text-muted-foreground py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-2">No Subjects Yet</p>
            <p className="text-sm max-w-sm mx-auto mb-4">
              Add subjects to start managing your curriculum.
            </p>
            <Button onClick={() => setAddSubjectModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Subject
            </Button>
          </div>
        </Card>
        <AddSubjectModal
          open={addSubjectModalOpen}
          onOpenChange={setAddSubjectModalOpen}
          existingSubjectNames={[]}
          onSubjectAdded={refetchSubjects}
        />
      </>
    );
  }

  const handleAddTopic = async (subject: string, topic: string) => {
    await addTopic(subject, topic);
  };

  const handleOpenCreateProfile = (subject: string) => {
    setActiveSubject(subject);
    setEditingProfile(null);
    setProfileModalOpen(true);
  };

  const handleOpenEditProfile = (
    subject: string,
    profile: { id: string; profile_name: string; topics: string[]; question_count: number }
  ) => {
    setActiveSubject(subject);
    setEditingProfile(profile);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (profileName: string, topics: string[], questionCount: number) => {
    if (editingProfile) {
      await updateProfile(editingProfile.id, { profile_name: profileName, topics, question_count: questionCount });
    } else {
      await createProfile(activeSubject, profileName, topics, questionCount);
    }
  };

  return (
    <>
      {/* Add Subject Button */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => setAddSubjectModalOpen(true)} variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Subject
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            getTopicsForSubject={getTopicsForSubject}
            getProfilesForSubject={getProfilesForSubject}
            handleAddTopic={handleAddTopic}
            removeTopic={removeTopic}
            handleOpenCreateProfile={handleOpenCreateProfile}
            handleOpenEditProfile={handleOpenEditProfile}
            deleteProfile={deleteProfile}
          />
        ))}
      </div>

      <ExamProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        subjectName={activeSubject}
        subjectColor={
          subjects.find((s) => s.subject_name.toLowerCase() === activeSubject.toLowerCase())?.subject_color || "#3B82F6"
        }
        availableTopics={getTopicsForSubject(activeSubject).map((t) => t.topic)}
        onSave={handleSaveProfile}
        initialData={editingProfile || undefined}
      />

      <AddSubjectModal
        open={addSubjectModalOpen}
        onOpenChange={setAddSubjectModalOpen}
        existingSubjectNames={subjects.map((s) => s.subject_name)}
        onSubjectAdded={refetchSubjects}
      />
    </>
  );
};
