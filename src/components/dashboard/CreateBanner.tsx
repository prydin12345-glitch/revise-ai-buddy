// src/components/dashboard/CreateBanner.tsx
import { Sparkles, FileText, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateBannerProps {
  onCreateExam?: () => void;
  onCreateQuiz?: () => void;
}

export default function CreateBanner({ onCreateExam, onCreateQuiz }: CreateBannerProps) {
  return (
    <section className="relative flex flex-col items-start gap-5 overflow-hidden rounded-[20px] border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:px-6">
      {/* soft glow */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-2xl" />

      <div className="z-10 grid h-[54px] w-[54px] flex-none place-items-center rounded-[15px] bg-primary/15 text-primary">
        <Sparkles className="h-[26px] w-[26px]" />
      </div>

      <div className="z-10 min-w-0 flex-1">
        <h3 className="text-[17.5px] font-extrabold tracking-tight">Create something new</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Spin up a full mock exam or a quick practice quiz in seconds.
        </p>
      </div>

      <div className="z-10 flex w-full flex-wrap gap-3 lg:w-auto lg:flex-nowrap">
        <Button
          onClick={onCreateExam}
          className="h-11 flex-1 gap-2 rounded-xl bg-primary px-[18px] text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 sm:flex-none"
        >
          <FileText className="h-[18px] w-[18px]" /> Create Exam
        </Button>
        <Button
          variant="outline"
          onClick={onCreateQuiz}
          className="h-11 flex-1 gap-2 rounded-xl border-border bg-panel-2 px-[18px] text-sm font-bold hover:border-primary hover:text-primary sm:flex-none"
        >
          <ListChecks className="h-[18px] w-[18px]" /> Create Practice Quiz
        </Button>
      </div>
    </section>
  );
}
