import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ValidationResult {
  isDuplicate: boolean;
  loading: boolean;
  suggestions: string[];
}

export const useExamNameValidator = (table: 'exams' | 'practice_question_sets') => {
  const [result, setResult] = useState<ValidationResult>({
    isDuplicate: false,
    loading: false,
    suggestions: [],
  });
  const debounceRef = useRef<number | null>(null);

  const checkName = useCallback(async (name: string) => {
    if (!name.trim()) {
      setResult({ isDuplicate: false, loading: false, suggestions: [] });
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setResult(prev => ({ ...prev, loading: true }));

    debounceRef.current = window.setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setResult({ isDuplicate: false, loading: false, suggestions: [] });
          return;
        }

        const nameCol = table === 'exams' ? 'title' : 'set_name';
        const userCol = 'user_id';

        const { data: existing } = await supabase
          .from(table)
          .select('id')
          .eq(userCol, user.id)
          .ilike(nameCol, name.trim())
          .limit(1);

        const isDuplicate = (existing?.length ?? 0) > 0;

        const suggestions: string[] = [];
        if (isDuplicate) {
          suggestions.push(`${name.trim()} (2)`);
          suggestions.push(`${name.trim()} - ${format(new Date(), 'dd MMM yyyy')}`);
        }

        setResult({ isDuplicate, loading: false, suggestions });
      } catch {
        setResult({ isDuplicate: false, loading: false, suggestions: [] });
      }
    }, 400);
  }, [table]);

  const reset = useCallback(() => {
    setResult({ isDuplicate: false, loading: false, suggestions: [] });
  }, []);

  return { ...result, checkName, reset };
};
