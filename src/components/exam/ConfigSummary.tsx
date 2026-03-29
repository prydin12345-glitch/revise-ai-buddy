import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";

interface ConfigSummaryProps {
  examBoard?: string | null;
  educationalLevel?: string | null;
  subject?: string | null;
  questionCount?: number | null;
  timeLimit?: number | null;
}

export const ConfigSummary = ({ examBoard, educationalLevel, subject, questionCount, timeLimit }: ConfigSummaryProps) => {
  const navigate = useNavigate();

  const hasBoard = examBoard && examBoard !== "none";

  const rows = [
    {
      label: "Exam Board",
      value: hasBoard ? getBoardDisplayName(examBoard) : "General style",
      missing: false,
      missingMsg: "",
    },
    {
      label: "Level",
      value: educationalLevel ? (LEVEL_DISPLAY_NAMES[educationalLevel] ?? educationalLevel) : null,
      missing: !educationalLevel,
      missingMsg: "Not set — set in Settings",
    },
    {
      label: "Subject",
      value: subject || null,
      missing: !subject,
      missingMsg: "Not selected",
    },
    ...(questionCount ? [{
      label: "Questions",
      value: `${questionCount} questions`,
      missing: false,
      missingMsg: "",
    }] : []),
    {
      label: "Time Limit",
      value: timeLimit ? `${timeLimit} minutes` : "No limit",
      missing: false,
      missingMsg: "",
    },
  ].filter(r => r.value || r.missing);

  const hasMissing = !educationalLevel;

  return (
    <div className="rounded-lg bg-muted/30 border border-border p-3.5 mb-4 space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Configuration Summary
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={row.missing ? "text-muted-foreground/60 italic" : "text-foreground font-medium"}>
              {row.missing ? row.missingMsg : row.value}
            </span>
          </div>
        ))}
      </div>

      {hasMissing && (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Set your level in{" "}
            <button
              onClick={() => navigate("/settings")}
              className="underline text-amber-400 hover:text-amber-300"
            >
              Settings
            </button>{" "}
            for better questions
          </span>
        </div>
      )}
    </div>
  );
};
