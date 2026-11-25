import { useQuery } from "@tanstack/react-query";
import { useWorkspaceQueryScope } from "./use-workspace-query-client";
import { profilesQuery } from "@/lib/workspace-summary-queries";
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normaliseAssessmentTier } from "@/lib/assessment-tier";
import { buildCustomProfilePayload, type ProfileSaveArgs, type ProfileSavePayload, type ProfileSaveResult } from "@/lib/custom-profile-save";
import { toast } from "sonner";

export interface MasterTopic {
  id: string;
  subject_name: string;
  topic: string;
}

export interface ExamProfile {
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
  profile_template?: unknown;
  paper_blueprint?: import("@/integrations/supabase/types").Json;
  studied_texts?: import("@/integrations/supabase/types").Json;
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
  return /assessment_tier/i.test(error.message ?? "") &&
    /does not exist|could not find|not found|schema cache/i.test(error.message ?? "");
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
  const currentTier = current.assessment_tier ?? null;
  if (rawTier === currentTier || tier === currentTier) {
    return { profile: current, status: "unchanged" };
  }
  try {
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
  } catch (error) {
    return { profile: current, status: "failed", message: error instanceof Error ? error.message : "Tier save failed" };
  }
};

export const useSubjectProfiles = () => {
  const { store, client } = useWorkspaceQueryScope();
  const query = useQuery(profilesQuery(store), client);
  const masterTopics = query.data?.masterTopics || [];
  const examProfiles = query.data?.examProfiles || [];
  const loading = query.isPending;
  const error = query.error ? "Couldn’t load exam profiles. Try again." : null;
  const fetchAll = useCallback(() => query.refetch({ cancelRefetch: false }), [query.refetch]);
  const setMasterTopics = async (update: (rows: MasterTopic[]) => MasterTopic[]) => {
    await client.cancelQueries({ queryKey: ["workspace-profiles"] });
    client.setQueryData<NonNullable<typeof query.data>>(["workspace-profiles"], previous => ({ masterTopics: update(previous?.masterTopics || []), examProfiles: previous?.examProfiles || [] }));
  };
  const setExamProfiles = async (update: (rows: ExamProfile[]) => ExamProfile[]) => {
    await client.cancelQueries({ queryKey: ["workspace-profiles"] });
    client.setQueryData<NonNullable<typeof query.data>>(["workspace-profiles"], previous => ({ masterTopics: previous?.masterTopics || [], examProfiles: update(previous?.examProfiles || []) }));
  };
  useEffect(() => {
    const refresh = () => { void fetchAll(); };
    window.addEventListener("examly-profiles-updated", refresh);
    return () => window.removeEventListener("examly-profiles-updated", refresh);
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
      await setMasterTopics((prev) => [...prev, data as MasterTopic]);
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
      await setMasterTopics((prev) => prev.filter((t) => t.id !== topicId));
    } catch (err) {
      console.error("Error removing topic:", err);
      toast.error("Failed to remove topic");
    }
  };

  const createProfile = async (subject: string, ...args: ProfileSaveArgs): Promise<ProfileSaveResult> => {
    let profileId: string | undefined;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        const message = "Sign in to save an exam profile";
        toast.error(message);
        return { ok: false, message };
      }

      const { assessment_tier: requestedTier, ...corePayload } = buildCustomProfilePayload(...args);

      const { data, error } = await supabase
        .from("subject_exam_profiles")
        .insert({
          user_id: user.id,
          subject_name: subject,
          ...corePayload,
        } as any)
        .select()
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error("The created profile was not returned");
      profileId = data.id;
      const tierResult = await persistAssessmentTier(
        profileId,
        requestedTier,
        data as ExamProfile,
      );
      await setExamProfiles((prev) => [...prev.filter(p => p.id !== profileId), tierResult.profile]);
      if (tierResult.status === "failed" || tierResult.status === "unsupported") {
        const message = "Profile created, but the assessment tier did not save. Retry to update this profile.";
        toast.error(message);
        return { ok: false, profileId, message };
      }
      toast.success("Exam profile created");
      return { ok: true, profileId };
    } catch (err) {
      console.error("Error creating profile:", err);
      const message = profileId
        ? "Profile created, but saving did not finish. Retry to update this profile."
        : "Failed to create profile";
      toast.error(message);
      return { ok: false, message, ...(profileId ? { profileId } : {}) };
    }
  };

  const updateProfile = async (
    profileId: string,
    updates: Partial<ProfileSavePayload>
  ): Promise<ProfileSaveResult> => {
    let coreSaved = false;
    try {
      // The tier is written separately so this statement still works while the
      // assessment-tier column is pending. Omitting the key leaves the stored
      // tier untouched; only an explicit key changes it.
      const tierRequested = Object.prototype.hasOwnProperty.call(
        updates,
        "assessment_tier",
      );
      const { assessment_tier: requestedTier, ...coreUpdates } = updates;

      const query = Object.keys(coreUpdates).length
        ? supabase
            .from("subject_exam_profiles")
            .update(coreUpdates as any)
            .eq("id", profileId)
            .select()
        : supabase
            .from("subject_exam_profiles")
            .select("*")
            .eq("id", profileId);

      const { data, error } = await query.single();

      if (error) throw error;
      if (!data?.id) throw new Error("Profile not found");
      coreSaved = true;

      const tierResult = tierRequested
        ? await persistAssessmentTier(
            profileId,
            requestedTier ?? null,
            data as ExamProfile,
          )
        : { profile: data as ExamProfile, status: "unchanged" as const };

      await setExamProfiles((prev) =>
        prev.some(p => p.id === profileId)
          ? prev.map((p) => (p.id === profileId ? tierResult.profile : p))
          : [...prev, tierResult.profile]
      );
      if (tierResult.status === "failed" || tierResult.status === "unsupported") {
        const message = "Profile saved, but the assessment tier did not save. Retry to finish saving.";
        toast.error(message);
        return { ok: false, profileId, message };
      }
      toast.success("Profile updated");
      return { ok: true, profileId };
    } catch (err) {
      console.error("Error updating profile:", err);
      const message = coreSaved
        ? "Profile saved, but saving did not finish. Retry to finish saving."
        : "Failed to update profile";
      toast.error(message);
      return { ok: false, profileId, message };
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from("subject_exam_profiles")
        .delete()
        .eq("id", profileId);

      if (error) throw error;
      await setExamProfiles((prev) => prev.filter((p) => p.id !== profileId));
      toast.success("Profile deleted");
      return true;
    } catch (err) {
      console.error("Error deleting profile:", err);
      toast.error("Failed to delete profile");
      return false;
    }
  };

  return {
    masterTopics,
    examProfiles,
    loading,
    error,
    getTopicsForSubject,
    getProfilesForSubject,
    addTopic,
    removeTopic,
    createProfile,
    updateProfile,
    deleteProfile,
    refetch: fetchAll,
    retry: fetchAll,
  };
};
