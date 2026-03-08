import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const VALID_CATEGORIES = [
  'english_language', 'english_literature', 'mathematics',
  'biology', 'chemistry', 'physics', 'geography', 'history',
  'business', 'computer_science', 'psychology', 'sociology',
  'art_design', 'music', 'physical_education', 'other'
] as const;

export type SubjectCategory = typeof VALID_CATEGORIES[number];

export const CATEGORY_LABELS: Record<string, string> = {
  english_language: 'English Language',
  english_literature: 'English Literature',
  mathematics: 'Mathematics',
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  geography: 'Geography',
  history: 'History',
  business: 'Business / Economics',
  computer_science: 'Computer Science',
  psychology: 'Psychology',
  sociology: 'Sociology / Humanities',
  art_design: 'Art & Design',
  music: 'Music / Performing Arts',
  physical_education: 'Physical Education',
  other: 'Other',
};

export const useSubjectCategory = (subjectName: string) => {
  const [category, setCategory] = useState<SubjectCategory>("other");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!subjectName) {
      setCategory("other");
      setIsLoading(false);
      return;
    }

    const fetchCategory = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("user_subjects")
          .select("subject_category")
          .eq("user_id", user.id)
          .ilike("subject_name", subjectName)
          .maybeSingle();

        if (data?.subject_category && data.subject_category !== 'other') {
          setCategory(data.subject_category as SubjectCategory);
        } else if (data) {
          // Category is 'other' or null — trigger classification
          const classified = await classifyAndUpdate(subjectName, user.id);
          setCategory(classified);
        } else {
          setCategory("other");
        }
      } catch (error) {
        console.error("Error fetching subject category:", error);
        setCategory("other");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategory();
  }, [subjectName]);

  const updateCategory = async (newCategory: SubjectCategory) => {
    setCategory(newCategory);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_subjects")
        .update({ subject_category: newCategory })
        .eq("user_id", user.id)
        .ilike("subject_name", subjectName);
    } catch (error) {
      console.error("Error updating subject category:", error);
    }
  };

  return { category, isLoading, updateCategory };
};

async function classifyAndUpdate(subjectName: string, userId: string): Promise<SubjectCategory> {
  try {
    const { data, error } = await supabase.functions.invoke('classify-subject', {
      body: { subjectName },
    });

    if (error) throw error;

    const category = (data?.category || 'other') as SubjectCategory;

    // Save to DB
    await supabase
      .from("user_subjects")
      .update({ subject_category: category })
      .eq("user_id", userId)
      .ilike("subject_name", subjectName);

    return category;
  } catch (error) {
    console.error("Error classifying subject:", error);
    return "other";
  }
}

export const classifySubjectName = async (subjectName: string): Promise<SubjectCategory> => {
  try {
    const { data, error } = await supabase.functions.invoke('classify-subject', {
      body: { subjectName },
    });
    if (error) throw error;
    return (data?.category || 'other') as SubjectCategory;
  } catch {
    return 'other';
  }
};
