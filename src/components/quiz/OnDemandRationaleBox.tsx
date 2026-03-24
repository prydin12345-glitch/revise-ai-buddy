import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2 } from "lucide-react";

interface Props {
  question: { id: string; question_text: string; correct_answer?: string | null; rationale?: string | null };
  subjectName: string;
}

export const OnDemandRationaleBox = ({ question, subjectName }: Props) => {
  const [rationale, setRationale] = useState<string | null>(question.rationale ?? null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(!!question.rationale);

  const handleExplain = async () => {
    if (rationale) { setShow(true); return; }
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('generate-rationale', {
        body: {
          questionId: question.id,
          questionText: question.question_text,
          correctAnswer: question.correct_answer,
          subject: subjectName,
        },
      });
      if (data?.rationale) { setRationale(data.rationale); setShow(true); }
    } finally { setLoading(false); }
  };

  return (
    <div className="mt-4 pt-4 border-t">
      {!show ? (
        <Button variant="ghost" size="sm" onClick={handleExplain} disabled={loading} className="text-xs text-muted-foreground">
          {loading ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Explaining...</> : <><Lightbulb className="w-3 h-3 mr-1" /> Explain this answer</>}
        </Button>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Quick Insight</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{rationale}</p>
        </div>
      )}
    </div>
  );
};
