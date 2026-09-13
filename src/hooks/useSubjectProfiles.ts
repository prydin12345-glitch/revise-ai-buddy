import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/profile-context-client";
import { normaliseAssessmentTier } from "@/lib/assessment-tier";
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
  educational_tier: string | null;
  time_limit_minutes: number | null;
  structure_preset: string | null;
  mcq_count: number | null;
  mcq_position: string | null;
  mark_distribution: Record<number, number> | null;
  include_extended: boolean | null;
  extended_marks: number | null;
  difficulty_progression: string | null;
  calculator_policy: string | null;
  written_question_count: number | null;
  question_structure: string | null;
  parent_question_count: number | null;
  max_parts_per_question: number | null;
  mcq_options_count: number | null;
  include_graphs: boolean | null;
  include_tables: boolean | null;
  exam_board: string | null;
  /** Foundation / Higher / not_tiered. null = unknown (legacy profile). */
  assessment_tier: string | null;
  created_at: string;
  updated_at: string;
}

/** The column does not exist yet (migration not applied) — not a real failure. */
export const isMissingColumnError = (error: {
  code?: string | null;
  message?: string | null;
} | null): boolean => {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /assessment_tier/i.test(error.message ?? "");
};

export type TierPersistStatus = "unchanged" | "saved" | "unsupported" | "failed";

export interface TierPersistResult {
  profile: ExamProfile;
  status: TierPersistStatus;
  message?: string;
}

/**
 * Writes the assessment tier in its OWN statement, so the rest of the profile
 * still saves while the assessment-tier migration is pending. A missing column
 * ("unsupported") is reported separately from a genuine write failure
 * ("failed") — the caller must not claim success for the latter.
 */
export const persistAssessmentTier = async (
  profileId: string,
  rawTier: string | null,
  current: ExamProfile,
  client: { from: typeof supabase.from } = supabase,
): Promise<TierPersistResult> => {
  const tier = normaliseAssessmentTier(rawTier);
  if (tier === (current.assessment_tier ?? null)) {
    return { profile: current, status: "unchanged" };
  }
  const { data, error } = await client
    .from("subject_exam_profiles")
    .update({ assessment_tier: tier })
    .eq("id", profileId)
    .select()
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      console.warn("Assessment tier column not available yet:", error.message);
      return { profile: current, status: "unsupported", message: error.message };
    }
    console.error("Assessment tier save failed:", error.message);
    return { profile: current, status: "failed", message: error.message };
  }
  if (!data) {
    return { profile: current, status: "failed", message: "Profile not found" };
  }
  return { profile: data as unknown as ExamProfile, status: "saved" };
};

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
    questionCount: number,
    educationalTier?: string,
    timeLimitMinutes?: number | null,
    advanced?: {
      assessmentTier?: string | null;
      examBoard?: string | null;
      structurePreset?: string;
      mcqCount?: number;
      mcqPosition?: string;
      markDistribution?: Record<number, number>;
      includeExtended?: boolean;
      extendedMarks?: number;
      difficultyProgression?: string;
      calculatorPolicy?: string;
    },
    writtenQuestionCount?: number,
    structureSettings?: {
      questionStructure?: string;
      parentQuestionCount?: number;
      maxPartsPerQuestion?: number;
      mcqOptionsCount?: number;
      includeGraphs?: boolean;
      includeTables?: boolean;
    }
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
          // The board was silently dropped before, so profiles lost their board.
          exam_board: advanced?.examBoard ?? null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      const saved = await persistAssessmentTier(
        (data as ExamProfile).id,
        advanced?.assessmentTier ?? null,
        data as ExamProfile,
      );
      setExamProfiles((prev) => [...prev, saved]);
      toast.success("Exam profile created");
    } catch (err) {
      console.error("Error creating profile:", err);
      toast.error("Failed to create profile");
    }
  };

  const updateProfile = async (
    profileId: string,
    updates: Partial<Pick<ExamProfile,
      "profile_name" | "topics" | "question_count" | "educational_tier" | "time_limit_minutes" |
      "structure_preset" | "mcq_count" | "mcq_position" | "mark_distribution" |
      "include_extended" | "extended_marks" | "difficulty_progression" | "calculator_policy" |
      "written_question_count" | "question_structure" | "parent_question_count" | "max_parts_per_question" |
      "mcq_options_count" | "include_graphs" | "include_tables" | "exam_board" | "assessment_tier"
    >>
  ) => {
    try {
      const { data, error } = await supabase
        .from("subject_exam_profiles")
        .update(updates as any)
        .eq("id", profileId)
        .select()
        .single();

      if (error) throw error;
      const saved = await persistAssessmentTier(
        profileId,
        updates.assessment_tier ?? null,
        data as ExamProfile,
      );
      setExamProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? saved : p))
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
