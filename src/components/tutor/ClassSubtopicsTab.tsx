import { useState, useEffect, useCallback } from "react";
import { Plus, X, FileText, ChevronRight, Trash2, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";

interface MasterTopic {
  id: string;
  subject_name: string;
  topic: string;
}

interface ExamProfile {
  id: string;
  subject_name: string;
  profile_name: string;
  topics: string[];
  question_count: number;
}

interface ClassSubtopicsTabProps {
  groupId: string;
  subjectsTaught: string[];
}

export const ClassSubtopicsTab = ({ groupId, subjectsTaught }: ClassSubtopicsTabProps) => {
  const { toast } = useToast();
  const [masterTopics, setMasterTopics] = useState<MasterTopic[]>([]);
  const [examProfiles, setExamProfiles] = useState<ExamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectsTaught[0] || "");

  // Profile creation state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileTopics, setProfileTopics] = useState<string[]>([]);
  const [profileQuestionCount, setProfileQuestionCount] = useState(15);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [topicsRes, profilesRes] = await Promise.all([
        supabase
          .from("subject_master_topics")
          .select("*")
          .eq("user_id", user.id)
          .order("topic"),
        supabase
          .from("subject_exam_profiles")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
      ]);

      if (topicsRes.error) throw topicsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setMasterTopics((topicsRes.data || []) as MasterTopic[]);
      setExamProfiles((profilesRes.data || []) as ExamProfile[]);
    } catch (err) {
      console.error("Error fetching subtopics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const subjectTopics = masterTopics.filter(
    (t) => t.subject_name.toLowerCase() === selectedSubject.toLowerCase()
  );

  const subjectProfiles = examProfiles.filter(
    (p) => p.subject_name.toLowerCase() === selectedSubject.toLowerCase()
  );

  const handleAddTopic = async () => {
    const trimmed = newTopic.trim();
    if (!trimmed || !selectedSubject) return;

    if (subjectTopics.some(t => t.topic.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Topic already exists", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("subject_master_topics")
        .insert({ user_id: user.id, subject_name: selectedSubject, topic: trimmed })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Topic already exists", variant: "destructive" });
          return;
        }
        throw error;
      }

      setMasterTopics(prev => [...prev, data as MasterTopic]);
      setNewTopic("");
    } catch (err) {
      console.error("Error adding topic:", err);
      toast({ title: "Failed to add topic", variant: "destructive" });
    }
  };

  const handleRemoveTopic = async (topicId: string) => {
    try {
      const { error } = await supabase
        .from("subject_master_topics")
        .delete()
        .eq("id", topicId);

      if (error) throw error;
      setMasterTopics(prev => prev.filter(t => t.id !== topicId));
    } catch (err) {
      console.error("Error removing topic:", err);
      toast({ title: "Failed to remove topic", variant: "destructive" });
    }
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim() || profileTopics.length === 0) {
      toast({ title: "Name and at least one topic required", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingProfileId) {
        const { error } = await supabase
          .from("subject_exam_profiles")
          .update({
            profile_name: profileName.trim(),
            topics: profileTopics,
            question_count: profileQuestionCount,
          })
          .eq("id", editingProfileId);

        if (error) throw error;
        toast({ title: "Profile updated" });
      } else {
        const { error } = await supabase
          .from("subject_exam_profiles")
          .insert({
            user_id: user.id,
            subject_name: selectedSubject,
            profile_name: profileName.trim(),
            topics: profileTopics,
            question_count: profileQuestionCount,
          });

        if (error) throw error;
        toast({ title: "Profile created" });
      }

      setProfileModalOpen(false);
      resetProfileForm();
      fetchData();
    } catch (err) {
      console.error("Error saving profile:", err);
      toast({ title: "Failed to save profile", variant: "destructive" });
    }
  };

  const handleDeleteProfile = async () => {
    if (!deleteProfileId) return;
    try {
      const { error } = await supabase
        .from("subject_exam_profiles")
        .delete()
        .eq("id", deleteProfileId);

      if (error) throw error;
      toast({ title: "Profile deleted" });
      setDeleteProfileId(null);
      fetchData();
    } catch (err) {
      toast({ title: "Failed to delete profile", variant: "destructive" });
    }
  };

  const openEditProfile = (profile: ExamProfile) => {
    setEditingProfileId(profile.id);
    setProfileName(profile.profile_name);
    setProfileTopics(profile.topics);
    setProfileQuestionCount(profile.question_count);
    setProfileModalOpen(true);
  };

  const resetProfileForm = () => {
    setEditingProfileId(null);
    setProfileName("");
    setProfileTopics([]);
    setProfileQuestionCount(15);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subject selector (if multiple subjects) */}
      {subjectsTaught.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {subjectsTaught.map((subject) => (
            <Button
              key={subject}
              variant={selectedSubject === subject ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSubject(subject)}
              className="text-xs"
            >
              {subject}
            </Button>
          ))}
        </div>
      )}

      {subjectsTaught.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No subjects assigned to this class yet.</p>
          <p className="text-xs mt-1">Add subjects in the Settings tab.</p>
        </div>
      )}

      {selectedSubject && (
        <>
          {/* Topic chips section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Topics for {selectedSubject}</Label>
              <Badge variant="secondary" className="text-xs">
                {subjectTopics.length} topic{subjectTopics.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {/* Add topic input */}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Algebra, Polynomials..."
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
                className="bg-muted/30 border-border/50 text-sm"
              />
              <Button size="sm" onClick={handleAddTopic} disabled={!newTopic.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Topic chips */}
            {subjectTopics.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No topics added yet. Start typing above to add your curriculum topics.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjectTopics.map((topic) => (
                  <Badge
                    key={topic.id}
                    variant="secondary"
                    className="gap-1.5 py-1.5 px-3 text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    {topic.topic}
                    <button
                      onClick={() => handleRemoveTopic(topic.id)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator className="bg-border/30" />

          {/* Exam Profiles section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Exam Profiles</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetProfileForm();
                  setProfileModalOpen(true);
                }}
                disabled={subjectTopics.length === 0}
                className="text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Profile
              </Button>
            </div>

            {subjectTopics.length === 0 && (
              <p className="text-xs text-muted-foreground">Add topics first to create exam profiles.</p>
            )}

            {subjectProfiles.length === 0 && subjectTopics.length > 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No exam profiles yet. Create one to curate topic subsets for assignments.
              </p>
            )}

            <div className="space-y-2">
              {subjectProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 min-h-[48px] rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{profile.profile_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.topics.length} topics · Max {profile.question_count} Qs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditProfile(profile)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive/70 hover:text-destructive"
                      onClick={() => setDeleteProfileId(profile.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create/Edit Profile Modal */}
      <Dialog open={profileModalOpen} onOpenChange={(open) => { setProfileModalOpen(open); if (!open) resetProfileForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProfileId ? "Edit" : "Create"} Exam Profile</DialogTitle>
            <DialogDescription>
              Select topics from your curriculum to create a curated subset for assignments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm">Profile Name</Label>
              <Input
                placeholder="e.g. Paper 1, Year 1 Pure Maths..."
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Select Topics ({profileTopics.length} selected)</Label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/30 rounded-lg p-3 bg-muted/10">
                {subjectTopics.map((topic) => {
                  const isSelected = profileTopics.includes(topic.topic);
                  return (
                    <button
                      key={topic.id}
                      onClick={() => {
                        setProfileTopics(prev =>
                          isSelected
                            ? prev.filter(t => t !== topic.topic)
                            : [...prev, topic.topic]
                        );
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                        isSelected
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{topic.topic}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Max Questions: {profileQuestionCount}</Label>
              <Slider
                value={[profileQuestionCount]}
                onValueChange={([v]) => setProfileQuestionCount(v)}
                min={5}
                max={50}
                step={1}
                className="py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setProfileModalOpen(false); resetProfileForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={!profileName.trim() || profileTopics.length === 0}>
              {editingProfileId ? "Update" : "Create"} Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Profile Confirmation */}
      <AlertDialog open={!!deleteProfileId} onOpenChange={() => setDeleteProfileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This profile will be permanently deleted. Existing assignments using it are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
