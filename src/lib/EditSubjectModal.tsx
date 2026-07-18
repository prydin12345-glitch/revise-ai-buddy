import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { EXAM_BOARD_OPTIONS } from "@/lib/board-scrubber";
import { SUBJECT_ICON_POOL, defaultIconIdFor } from "@/lib/subjectIcons";
import { toast } from "sonner";

const COLOUR_SWATCHES = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#F59E0B", "#22C55E", "#14B8A6", "#06B6D4", "#64748B"];

interface EditSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: {
    id: string;
    subject_name: string;
    exam_board?: string | null;
    subject_color?: string | null;
    subject_icon?: string | null;
  };
  onSaved: () => void;
}

export const EditSubjectModal = ({ open, onOpenChange, subject, onSaved }: EditSubjectModalProps) => {
  const [board, setBoard] = useState<string>("");
  const [colour, setColour] = useState<string>("#3B82F6");
  const [iconId, setIconId] = useState<string>("book");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBoard(subject.exam_board || "");
      setColour(subject.subject_color || "#3B82F6");
      setIconId(subject.subject_icon || defaultIconIdFor(subject.subject_name));
    }
  }, [open, subject]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("user_subjects")
      .update({
        exam_board: board || null,
        subject_color: colour,
        subject_icon: iconId,
      } as any)
      .eq("id", subject.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save changes — try again.");
      return;
    }
    toast.success("Subject updated");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit {subject.subject_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Exam board</Label>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-[13px]"
            >
              <option value="">No board set</option>
              {EXAM_BOARD_OPTIONS.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Changing the board only affects new exams and quizzes — your profiles, attempts and history stay exactly as they are.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Colour</Label>
            <div className="flex flex-wrap gap-2">
              {COLOUR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setColour(c)}
                  className={`w-7 h-7 rounded-full transition-transform duration-150 ${colour === c ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Symbol</Label>
            <div className="grid grid-cols-5 gap-2">
              {SUBJECT_ICON_POOL.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={() => setIconId(id)}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-150 ${
                    iconId === id
                      ? "text-white scale-105"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  }`}
                  style={iconId === id ? { backgroundColor: colour } : undefined}
                >
                  <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
