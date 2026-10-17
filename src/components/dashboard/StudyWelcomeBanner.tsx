import { useStudyPeriod } from "@/hooks/use-study-period";
import { cn } from "@/lib/utils";
import StudyCorner from "./StudyCorner";
import "@/styles/study-welcome.css";

export default function StudyWelcomeBanner({ name, className }: { name: string; className?: string }) {
  const period = useStudyPeriod();

  return (
    <header className={cn("study-welcome", className)} data-period={period}>
      <div className="study-welcome-copy">
        <p className="text-sm font-medium text-foreground/75">Good {period},</p>
        <h1 className="study-welcome-name">{name.split(" ")[0]}</h1>
        <p className="study-welcome-message">Make a little room for revision.</p>
      </div>
      <StudyCorner period={period} />
    </header>
  );
}
