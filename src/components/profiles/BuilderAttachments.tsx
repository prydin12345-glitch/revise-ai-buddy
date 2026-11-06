import { useId, useRef } from "react";
import { CheckCircle2, Clock3, FileText, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  BuilderAttachment,
  BuilderAttachmentStatus,
} from "@/hooks/useBuilderAttachments";

const statuses: Record<BuilderAttachmentStatus, string> = {
  attached: "Attached",
  reading: "Reading syllabus…",
  checked: "Checked",
  needs_recheck: "Details changed — ready to check again",
  error: "Needs attention",
};
const sizeLabel = (size: number) =>
  size >= 1_000_000
    ? `${(size / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1000))} KB`;

interface Props {
  files: BuilderAttachment[];
  busy: boolean;
  error?: string;
  active: boolean;
  showPicker?: boolean;
  disabled?: boolean;
  onSelect: (files: File[]) => unknown;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function BuilderAttachments({
  files,
  busy,
  error,
  active,
  showPicker = true,
  disabled = false,
  onSelect,
  onRemove,
  onClear,
}: Props) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  if (!showPicker && !files.length && !error) return null;
  return (
    <section
      aria-label="Syllabus attachments"
      className="min-w-0 space-y-3"
      aria-busy={busy}
    >
      {showPicker && (
        <div className="space-y-1.5">
          <label
            htmlFor={id}
            className="block text-xs font-medium text-muted-foreground"
          >
            Syllabus or assessment brief
          </label>
          <Input
            ref={picker}
            id={id}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.txt,application/pdf,text/plain"
            disabled={disabled || busy}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              const selected = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (selected.length) void onSelect(selected);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled || busy}
            aria-describedby={`${id}-hint`}
            onClick={() => picker.current?.click()}
          >
            {files.length ? "Replace files" : "Choose files"}
          </Button>
          <p
            id={`${id}-hint`}
            className="text-xs leading-relaxed text-muted-foreground"
          >
            Up to 3 readable PDF or text files, 3 MB each and 6 MB total. PDFs
            can contain up to 240 pages.
          </p>
        </div>
      )}
      {files.length > 0 && (
        <>
          <ul aria-label="Attached source files" className="space-y-2">
            {files.map((file) => {
              const StatusIcon =
                file.status === "checked"
                  ? CheckCircle2
                  : file.status === "needs_recheck"
                    ? RefreshCw
                    : file.status === "reading"
                      ? Clock3
                      : FileText;
              return (
                <li
                  key={file.id}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-muted/30 p-3"
                >
                  <FileText
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                      {file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {sizeLabel(file.size)}
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                      <StatusIcon
                        aria-hidden="true"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      />
                      {active
                        ? statuses[file.status]
                        : "Not used for this build"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Remove ${file.name}`}
                    disabled={disabled || busy}
                    onClick={() => onRemove(file.id)}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
          {files.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || busy}
              onClick={onClear}
            >
              Remove all files
            </Button>
          )}
        </>
      )}
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Reading the selected files…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger-border bg-danger-muted p-3 text-sm text-foreground"
        >
          {error}
        </p>
      )}
    </section>
  );
}
