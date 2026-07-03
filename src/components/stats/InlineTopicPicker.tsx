import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { X, Plus, Search, Check } from "lucide-react";
import { fuzzyMatch } from "@/lib/subtopic-dictionary";

interface InlineTopicPickerProps {
  allTopics: string[];
  selectedTopics: string[];
  onToggle: (topic: string) => void;
  subjectColor: string;
}

export const InlineTopicPicker = ({
  allTopics,
  selectedTopics,
  onToggle,
  subjectColor,
}: InlineTopicPickerProps) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const unselected = allTopics.filter((t) => !selectedTopics.includes(t));
    if (!search.trim()) return unselected.slice(0, 60);
    return unselected.filter((t) => fuzzyMatch(search, t)).slice(0, 60);
  }, [allTopics, selectedTopics, search]);

  const isCustom =
    search.trim().length > 0 &&
    !allTopics.some((t) => t.toLowerCase() === search.trim().toLowerCase()) &&
    !selectedTopics.some((t) => t.toLowerCase() === search.trim().toLowerCase());

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !search.trim()) return;
    e.preventDefault();
    const exact = filtered.find((t) => t.toLowerCase() === search.trim().toLowerCase());
    if (exact) onToggle(exact);
    else if (isCustom) onToggle(search.trim());
    else if (filtered.length > 0) onToggle(filtered[0]);
    setSearch("");
  };

  return (
    <div className="space-y-2.5">
      {/* Selected chips — always visible above the search */}
      <div
        className="rounded-xl border border-border/50 bg-muted/20 p-2.5 min-h-[52px]"
        aria-label="Selected topics"
      >
        {selectedTopics.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground text-center py-1.5">
            No topics selected yet. Search or type a custom topic below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => onToggle(topic)}
                className="group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-transform hover:scale-[0.97]"
                style={{
                  backgroundColor: subjectColor + "22",
                  color: subjectColor,
                  border: `1px solid ${subjectColor}44`,
                }}
              >
                {topic}
                <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search topics or type & press Enter to add custom…"
          className="h-9 pl-9 text-sm"
        />
      </div>

      {/* Inline suggestion list */}
      <div className="rounded-xl border border-border/50 bg-card/40 max-h-52 overflow-y-auto">
        {isCustom && (
          <button
            type="button"
            onClick={() => {
              onToggle(search.trim());
              setSearch("");
            }}
            className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-muted/60 transition-colors border-b border-border/40"
          >
            <Plus className="h-3.5 w-3.5" style={{ color: subjectColor }} />
            <span>
              Add <span className="font-semibold" style={{ color: subjectColor }}>"{search.trim()}"</span>
            </span>
          </button>
        )}
        {filtered.length === 0 && !isCustom && (
          <p className="text-[12px] text-muted-foreground text-center py-4">
            {search.trim() ? "No matches. Type a name and press Enter to add." : "All topics selected."}
          </p>
        )}
        {filtered.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => onToggle(topic)}
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted/60 transition-colors flex items-center justify-between group"
          >
            <span className="truncate">{topic}</span>
            <Check
              className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 shrink-0"
              style={{ color: subjectColor }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
