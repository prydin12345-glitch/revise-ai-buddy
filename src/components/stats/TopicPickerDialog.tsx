// FILE: src/components/stats/TopicPickerDialog.tsx
// Full-screen topic picker: search-and-add on the left (~75%), your chosen
// topics on the right. Supports comma-separated BULK adding (markdown links
// like [Hazards](url) are cleaned to their text), and custom topics are
// persisted to the user's account so practice-quiz search finds them later.

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Search, Check } from "lucide-react";

interface TopicPickerDialogProps {
  allTopics: string[];
  selectedTopics: string[];
  onChange: (topics: string[]) => void;
  subjectColor: string;
  subjectName: string;
}

/** "[Hazards](https://...)" -> "Hazards"; trims stray brackets/urls. */
function cleanTopic(raw: string): string {
  let t = raw.trim();
  const md = t.match(/\[([^\]]+)\]\([^)]*\)/);
  if (md) t = md[1];
  t = t.replace(/https?:\/\/\S+/g, "").replace(/[\[\]()]/g, "").trim();
  return t.replace(/\s+/g, " ");
}

export function TopicPickerDialog({ allTopics, selectedTopics, onChange, subjectColor, subjectName }: TopicPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    // Bulk mode: don't filter while the user is pasting a comma list
    if (q.includes(",")) return allTopics;
    return q ? allTopics.filter((t) => t.toLowerCase().includes(q)) : allTopics;
  }, [allTopics, search]);

  const isSelected = (t: string) => selectedTopics.some((s) => s.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) =>
    onChange(isSelected(t) ? selectedTopics.filter((s) => s.toLowerCase() !== t.toLowerCase()) : [...selectedTopics, t]);

  /** Add from the search box: comma-splits, cleans links, dedupes, persists customs. */
  const addFromSearch = async () => {
    const parts = search.split(",").map(cleanTopic).filter((t) => t.length > 1);
    if (parts.length === 0) return;
    const additions = parts.filter((t) => !isSelected(t));
    if (additions.length) onChange([...selectedTopics, ...additions]);
    setSearch("");
    // Persist any topics not in the presaved list to the user's account so
    // practice-quiz search can suggest them in future. Fire-and-forget.
    const customs = additions.filter((t) => !allTopics.some((a) => a.toLowerCase() === t.toLowerCase()));
    if (customs.length) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("user_custom_topics").upsert(
            customs.map((topic) => ({ user_id: user.id, subject_name: subjectName, topic })),
            { onConflict: "user_id,subject_name,topic", ignoreDuplicates: true }
          );
        }
      } catch (e) { console.warn("custom topic save failed", e); }
    }
  };

  const bulkCount = search.includes(",") ? search.split(",").map(cleanTopic).filter((t) => t.length > 1).length : 0;

  return (
    <>
      {/* Trigger + selected summary shown in the profile modal */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
          {selectedTopics.length === 0 && (
            <p className="text-xs text-muted-foreground self-center">No topics yet — pick at least one.</p>
          )}
          {selectedTopics.slice(0, 8).map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border"
              style={{ borderColor: subjectColor + "55", color: subjectColor, backgroundColor: subjectColor + "10" }}>
              {t}
              <button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t}`}><X className="h-3 w-3 opacity-60" /></button>
            </span>
          ))}
          {selectedTopics.length > 8 && (
            <span className="text-xs text-muted-foreground self-center">+{selectedTopics.length - 8} more</span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
          <Search className="h-3.5 w-3.5 mr-1.5" />
          {selectedTopics.length ? "Add or manage topics" : "Choose topics"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60">
            <DialogTitle>Choose topics</DialogTitle>
            <DialogDescription className="text-xs">
              Search the {subjectName} list, or type your own — separate several with commas to add them all at once.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex min-h-0">
            {/* Left ~75%: search + add */}
            <div className="flex-[3] min-w-0 flex flex-col border-r border-border/60">
              <div className="p-4 pb-2 flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFromSearch(); } }}
                  placeholder="Search, or type new topics (comma-separate for bulk)\u2026"
                  className="h-9"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={addFromSearch} disabled={!search.trim()}
                  style={{ backgroundColor: subjectColor }} className="text-white shrink-0 hover:opacity-90">
                  <Plus className="h-4 w-4 mr-1" />
                  {bulkCount > 1 ? `Add ${bulkCount}` : "Add"}
                </Button>
              </div>
              {bulkCount > 1 && (
                <p className="px-4 pb-1 text-[11px]" style={{ color: subjectColor }}>
                  {bulkCount} topics detected — they'll be added separately.
                </p>
              )}
              <div className="flex-1 overflow-y-auto px-4 pb-4 accent-scroll" style={{ "--scroll-accent": subjectColor } as React.CSSProperties}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2">
                  {filtered.map((t) => {
                    const sel = isSelected(t);
                    return (
                      <button key={t} type="button" onClick={() => toggle(t)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${sel ? "font-medium" : "border-border/50 hover:bg-muted/50"}`}
                        style={sel ? { borderColor: subjectColor, backgroundColor: subjectColor + "10", color: subjectColor } : undefined}>
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border shrink-0 ${sel ? "border-transparent" : "border-border"}`}
                          style={sel ? { backgroundColor: subjectColor } : undefined}>
                          {sel && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="truncate">{t}</span>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && !search.includes(",") && (
                    <p className="text-xs text-muted-foreground col-span-2 py-6 text-center">
                      No matches — press Add to create "{cleanTopic(search)}" as a new topic.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right ~25%: chosen */}
            <div className="flex-1 min-w-[170px] flex flex-col bg-muted/20">
              <p className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Chosen ({selectedTopics.length})
              </p>
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5 accent-scroll" style={{ "--scroll-accent": subjectColor } as React.CSSProperties}>
                {selectedTopics.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">Nothing yet.</p>
                )}
                {selectedTopics.map((t) => (
                  <div key={t} className="flex items-center gap-1.5 rounded-md bg-background border border-border/60 px-2 py-1.5">
                    <span className="text-[11px] truncate flex-1">{t}</span>
                    <button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t}`}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-border/60">
            <Button onClick={() => setOpen(false)} style={{ backgroundColor: subjectColor }} className="text-white hover:opacity-90">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
