import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, FileText, Pencil, Trash2, BookOpen, Layers } from "lucide-react";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { ExamProfileModal } from "./ExamProfileModal";
import { AddSubjectModal } from "./AddSubjectModal";
import { TopicSearchInput } from "./TopicSearchInput";
import { motion, AnimatePresence } from "framer-motion";

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
        {subjects.map((subject) => {
          const subjectTopics = getTopicsForSubject(subject.subject_name);
          const subjectProfiles = getProfilesForSubject(subject.subject_name);

          return (
            <Card key={subject.id} className="overflow-hidden relative group transition-shadow hover:shadow-lg">
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

                {/* Topic Chips */}
                <div className="min-h-[40px]">
                  {subjectTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      <AnimatePresence mode="popLayout">
                        {subjectTopics.map((t) => (
                          <motion.div
                            key={t.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Badge
                              variant="secondary"
                              className="gap-1 cursor-pointer group/chip hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full px-3 py-1"
                              onClick={() => removeTopic(t.id)}
                            >
                              {t.topic}
                              <X className="h-3 w-3 opacity-50 group-hover/chip:opacity-100 transition-opacity" />
                            </Badge>
                          </motion.div>
                        ))}
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
        })}
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
