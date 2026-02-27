import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, X, FileText, Pencil, Trash2, BookOpen } from "lucide-react";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { ExamProfileModal } from "./ExamProfileModal";

export const MySubjectsPanel = () => {
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

  const [newTopicInputs, setNewTopicInputs] = useState<Record<string, string>>({});
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState("");
  const [editingProfile, setEditingProfile] = useState<{
    id: string;
    profile_name: string;
    topics: string[];
    question_count: number;
  } | null>(null);

  if (subjectsLoading || profilesLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Subjects Yet</p>
            <p className="text-sm">
              Add subjects during onboarding or when creating exams to see them here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleAddTopic = async (subject: string) => {
    const topic = newTopicInputs[subject]?.trim();
    if (!topic) return;
    await addTopic(subject, topic);
    setNewTopicInputs((prev) => ({ ...prev, [subject]: "" }));
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

  const handleSaveProfile = async (
    profileName: string,
    topics: string[],
    questionCount: number
  ) => {
    if (editingProfile) {
      await updateProfile(editingProfile.id, {
        profile_name: profileName,
        topics,
        question_count: questionCount,
      });
    } else {
      await createProfile(activeSubject, profileName, topics, questionCount);
    }
  };

  return (
    <>
      <Accordion type="multiple" className="space-y-3">
        {subjects.map((subject) => {
          const subjectTopics = getTopicsForSubject(subject.subject_name);
          const subjectProfiles = getProfilesForSubject(subject.subject_name);
          const topicNames = subjectTopics.map((t) => t.topic);

          return (
            <AccordionItem
              key={subject.id}
              value={subject.id}
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: subject.subject_color }}
                  />
                  <span className="font-semibold">{subject.subject_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {subjectTopics.length} topics
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {subjectProfiles.length} profiles
                  </Badge>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-4 space-y-5">
                {/* Master Topics */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Master Topics</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a topic..."
                      value={newTopicInputs[subject.subject_name] || ""}
                      onChange={(e) =>
                        setNewTopicInputs((prev) => ({
                          ...prev,
                          [subject.subject_name]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTopic(subject.subject_name);
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddTopic(subject.subject_name)}
                      disabled={!newTopicInputs[subject.subject_name]?.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {subjectTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {subjectTopics.map((t) => (
                        <Badge
                          key={t.id}
                          variant="secondary"
                          className="gap-1 cursor-pointer hover:bg-destructive/10"
                          onClick={() => removeTopic(t.id)}
                        >
                          {t.topic}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No topics added yet. Type a topic above and press Enter.
                    </p>
                  )}
                </div>

                {/* Exam Profiles */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Exam Profiles</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCreateProfile(subject.subject_name)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Profile
                    </Button>
                  </div>

                  {subjectProfiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No exam profiles yet. Create one to pre-fill topics and question counts when generating exams.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subjectProfiles.map((profile) => (
                        <Card key={profile.id} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium text-sm truncate">
                                  {profile.profile_name}
                                </span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {profile.question_count} Q
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {profile.topics.slice(0, 6).map((t) => (
                                  <Badge
                                    key={t}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {t}
                                  </Badge>
                                ))}
                                {profile.topics.length > 6 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{profile.topics.length - 6} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() =>
                                  handleOpenEditProfile(subject.subject_name, profile)
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteProfile(profile.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <ExamProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        subjectName={activeSubject}
        availableTopics={
          getTopicsForSubject(activeSubject).map((t) => t.topic)
        }
        onSave={handleSaveProfile}
        initialData={editingProfile || undefined}
      />
    </>
  );
};
