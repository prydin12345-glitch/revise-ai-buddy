// src/components/dashboard/CreateBanner.tsx
import { Sparkles, FileText, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateBannerProps {
  onCreateExam?: () => void;
  onCreateQuiz?: () => void;
}

export default function CreateBanner({ onCreateExam, onCreateQuiz }: CreateBannerProps) {
  return (
    <section className="flex flex-col items-start gap-5 rounded-lg border border-border bg-card p-5 sm:p-6 xl:flex-row xl:items-center">
      <div className="z-10 min-w-0 flex-1">
        <h3 className="text-lg font-semibold tracking-tight">Your next practice session</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Choose a timed mock paper or a focused practice quiz.
        </p>
      </div>

      <div className="z-10 flex w-full flex-wrap gap-3 xl:w-auto xl:flex-nowrap">
        <Button
          onClick={onCreateExam}
          className="min-h-11 flex-1 gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:flex-none"
        >
          <FileText className="h-[18px] w-[18px]" /> Create Exam
        </Button>
        <Button
          variant="outline"
          onClick={onCreateQuiz}
          className="min-h-11 flex-1 gap-2 rounded-md border-border bg-card px-4 text-sm font-semibold hover:bg-muted sm:flex-none"
        >
          <ListChecks className="h-[18px] w-[18px]" /> Create Practice Quiz
        </Button>
      </div>
    </section>
  );
}
