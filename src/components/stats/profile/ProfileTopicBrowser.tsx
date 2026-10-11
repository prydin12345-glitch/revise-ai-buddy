import { useMemo, useState } from "react";
import { Search, Plus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function cleanProfileTopic(raw: string): string {
  const markdown = raw.match(/\[([^\]]+)\]\([^)]*\)/);
  return (markdown ? markdown[1] : raw)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface ProfileTopicBrowserProps {
  allTopics: string[];
  selectedTopics: string[];
  onChange: (topics: string[]) => void;
  subjectName: string;
  accent: string;
  locked?: boolean;
}

export function ProfileTopicBrowser({
  allTopics,
  selectedTopics,
  onChange,
  subjectName,
  accent,
  locked = false,
}: ProfileTopicBrowserProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "selected">("all");
  const [sort, setSort] = useState("original");
  const [adding, setAdding] = useState(false);
  const [newTopics, setNewTopics] = useState("");
  const [notice, setNotice] = useState("");
  const selected = (topic: string) =>
    selectedTopics.some((value) => value.toLowerCase() === topic.toLowerCase());
  const topics = useMemo(() => {
    const unique = new Map<string, string>();
    for (const topic of [...allTopics, ...selectedTopics])
      if (!unique.has(topic.toLowerCase()))
        unique.set(topic.toLowerCase(), topic);
    return Array.from(unique.values());
  }, [allTopics, selectedTopics]);
  const filtered = topics.filter(
    (topic) =>
      (filter !== "selected" || selected(topic)) &&
      topic.toLowerCase().includes(search.trim().toLowerCase()),
  );
  if (sort === "alphabetical") filtered.sort((a, b) => a.localeCompare(b));
  const toggle = (topic: string) => {
    if (locked) return;
    onChange(
      selected(topic)
        ? selectedTopics.filter(
            (value) => value.toLowerCase() !== topic.toLowerCase(),
          )
        : [...selectedTopics, topic],
    );
  };
  const add = async () => {
    const incoming = new Map<string, string>();
    for (const topic of newTopics
      .split(",")
      .map(cleanProfileTopic)
      .filter((value) => value.length > 1)) {
      if (!selected(topic)) incoming.set(topic.toLowerCase(), topic);
    }
    const additions = Array.from(incoming.values());
    if (!additions.length) {
      setNotice("Enter a new topic to add.");
      return;
    }
    onChange([...selectedTopics, ...additions]);
    setNewTopics("");
    setAdding(false);
    setNotice("");
    const customs = additions.filter(
      (topic) =>
        !allTopics.some((value) => value.toLowerCase() === topic.toLowerCase()),
    );
    if (customs.length) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from("user_custom_topics").upsert(
            customs.map((topic) => ({
              user_id: user.id,
              subject_name: subjectName,
              topic,
            })),
            {
              onConflict: "user_id,subject_name,topic",
              ignoreDuplicates: true,
            },
          );
          if (error)
            setNotice(
              "Topics added to this profile. Saving them to your topic library failed.",
            );
        }
      } catch {
        setNotice(
          "Topics added to this profile. Saving them to your topic library failed.",
        );
      }
    }
  };

  return (
    <section aria-label="Topics" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Topics</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {selectedTopics.length} selected{locked ? " · Preset" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[140px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search topics"
            placeholder="Search topics"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <select
          aria-label="Sort topics"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="original">Original order</option>
          <option value="alphabetical">A–Z</option>
        </select>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Topic filter">
          {(["all", "selected"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${filter === value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {value === "all" ? "All topics" : "Selected"}
            </button>
          ))}
        </div>
        {!locked && (
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
            className="flex min-h-9 items-center gap-1 text-xs font-medium text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your own
          </button>
        )}
      </div>
      {adding && !locked && (
        <div className="rounded-md border border-border bg-background p-3">
          <div className="flex gap-2">
            <Input
              aria-label="New topics"
              placeholder="One topic, or several separated by commas"
              value={newTopics}
              onChange={(event) => setNewTopics(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void add();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => void add()}
              disabled={!newTopics.trim()}
              size="sm"
              className="h-10"
            >
              Add
            </Button>
          </div>
        </div>
      )}
      <div
        className="max-h-[224px] overflow-y-auto overscroll-contain rounded-md border border-border bg-background"
        aria-label="Available topics"
      >
        {filtered.length ? (
          filtered.map((topic) => (
            <label
              key={topic}
              className={`flex min-h-11 items-start gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 ${locked ? "cursor-default" : "cursor-pointer hover:bg-muted/40"}`}
            >
              <input
                type="checkbox"
                className="sr-only peer"
                checked={selected(topic)}
                disabled={locked}
                onChange={() => toggle(topic)}
              />
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
                style={
                  selected(topic)
                    ? {
                        backgroundColor: accent,
                        borderColor: accent,
                        color: "white",
                      }
                    : undefined
                }
              >
                {selected(topic) && <Check className="h-3 w-3" />}
              </span>
              <span className="text-sm leading-5">{topic}</span>
            </label>
          ))
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {search
              ? "No topics match your search."
              : filter === "selected"
                ? "Choose the topics you want to practise."
                : "Add the topics you study."}
          </p>
        )}
      </div>
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}
