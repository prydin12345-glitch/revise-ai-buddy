import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  created_at: string;
  updated_at: string;
}

export const useSubjectProfiles = () => {
  const [masterTopics, setMasterTopics] = useState<MasterTopic[]>([]);
  const [examProfiles, setExamProfiles] = useState<ExamProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
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
      console.error("Error fetching subject profiles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getTopicsForSubject = useCallback(
    (subject: string) =>
      masterTopics.filter(
        (t) => t.subject_name.toLowerCase() === subject.toLowerCase()
      ),
    [masterTopics]
  );

  const getProfilesForSubject = useCallback(
    (subject: string) =>
      examProfiles.filter(
        (p) => p.subject_name.toLowerCase() === subject.toLowerCase()
      ),
    [examProfiles]
  );

  const addTopic = async (subject: string, topic: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("subject_master_topics")
        .insert({ user_id: user.id, subject_name: subject, topic })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Topic already exists");
          return;
        }
        throw error;
      }
      setMasterTopics((prev) => [...prev, data as MasterTopic]);
    } catch (err) {
      console.error("Error adding topic:", err);
      toast.error("Failed to add topic");
    }
  };

  const removeTopic = async (topicId: string) => {
    try {
      const { error } = await supabase
        .from("subject_master_topics")
        .delete()
        .eq("id", topicId);

      if (error) throw error;
      setMasterTopics((prev) => prev.filter((t) => t.id !== topicId));
    } catch (err) {
      console.error("Error removing topic:", err);
      toast.error("Failed to remove topic");
    }
  };

  const createProfile = async (
    subject: string,
    profileName: string,
    topics: string[],
    questionCount: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("subject_exam_profiles")
        .insert({
          user_id: user.id,
          subject_name: subject,
          profile_name: profileName,
          topics,
          question_count: questionCount,
        })
        .select()
        .single();

      if (error) throw error;
      setExamProfiles((prev) => [...prev, data as ExamProfile]);
      toast.success("Exam profile created");
    } catch (err) {
      console.error("Error creating profile:", err);
      toast.error("Failed to create profile");
    }
  };

  const updateProfile = async (
    profileId: string,
    updates: Partial<Pick<ExamProfile, "profile_name" | "topics" | "question_count">>
  ) => {
    try {
      const { data, error } = await supabase
        .from("subject_exam_profiles")
        .update(updates)
        .eq("id", profileId)
        .select()
        .single();

      if (error) throw error;
      setExamProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? (data as ExamProfile) : p))
      );
      toast.success("Profile updated");
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error("Failed to update profile");
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from("subject_exam_profiles")
        .delete()
        .eq("id", profileId);

      if (error) throw error;
      setExamProfiles((prev) => prev.filter((p) => p.id !== profileId));
      toast.success("Profile deleted");
    } catch (err) {
      console.error("Error deleting profile:", err);
      toast.error("Failed to delete profile");
    }
  };

  return {
    masterTopics,
    examProfiles,
    loading,
    getTopicsForSubject,
    getProfilesForSubject,
    addTopic,
    removeTopic,
    createProfile,
    updateProfile,
    deleteProfile,
    refetch: fetchAll,
  };
};
