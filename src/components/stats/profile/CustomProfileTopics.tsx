import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { cleanProfileTopic } from "./ProfileTopicBrowser";

export interface CustomProfileTopicsProps {
  topics: string[];
  allTopics: string[];
  getTopicLabel: (topic: string) => string;
  onChange: (topics: string[]) => void;
  onRename: (topic: string, label: string) => void;
  disabled?: boolean;
  locked?: boolean;
  onUndo: () => void;
  canUndo: boolean;
  subjectName: string;
  accent: string;
}

type TopicView = "profile" | "library";
type Editor = { kind: "add" } | { kind: "rename"; topic: string };
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const iconButton = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50";
const lockedTitle = "Choose Custom in Exam settings to change topics in this guided profile.";
const libraryFailure = "Topics added to this profile. Saving them to your topic library failed.";
const duplicateTitle = "This topic is saved more than once. Remove duplicate entries before editing its display name.";

/** The parent owns canonical topics, labels and undo. Browsing only changes this view. */
export function CustomProfileTopics({
  topics, allTopics, getTopicLabel, onChange, onRename, disabled = false, locked = false,
  onUndo, canUndo, subjectName, accent,
}: CustomProfileTopicsProps) {
  const id = useId();
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<TopicView>("profile");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("original");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addedLibrary, setAddedLibrary] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingLibrary, setSavingLibrary] = useState(false);
  const blocked = disabled || locked;
  const query = search.trim().toLowerCase();
  const library = useMemo(() => [...new Set([...allTopics, ...addedLibrary])], [allTopics, addedLibrary]);
  // Occurrence keys let identical saved rows be selected/removed independently.
  const occurrences = new Map<string, number>();
  const profileRows = topics.map((topic, index) => {
    const occurrence = occurrences.get(topic) ?? 0;
    occurrences.set(topic, occurrence + 1);
    return { topic, index, key: JSON.stringify([topic, occurrence]), label: getTopicLabel(topic) };
  });
  const rows = view === "profile" ? profileRows : library.map((topic, index) => ({
    topic, index, key: topic, label: getTopicLabel(topic),
  }));
  const filtered = rows.filter(row => [row.topic, row.label].some(value => value.toLowerCase().includes(query)));
  if (sort === "alphabetical") filtered.sort((a, b) => a.label.localeCompare(b.label) || a.index - b.index);
  const selectedRows = profileRows.filter(row => selected.has(row.key));
  const hiddenSelected = selectedRows.length - filtered.filter(row => selected.has(row.key)).length;
  const allShownSelected = filtered.length > 0 && filtered.every(row => selected.has(row.key));
  const wouldRemoveAll = selectedRows.length > 0 && selectedRows.length >= topics.length;

  const changeView = (next: TopicView) => {
    setView(next);
    setSearch("");
    setSelected(new Set());
    setSelecting(false);
  };
  const remove = (keys: Set<string>) => {
    if (blocked) return;
    const next = profileRows.filter(row => !keys.has(row.key)).map(row => row.topic);
    if (!next.length || next.length === topics.length) return;
    onChange(next);
    setSelected(new Set());
    setNotice("");
  };
  const toggleLibrary = (topic: string) => {
    if (blocked) return;
    // Only intentional removal of this exact canonical value can remove saved rows.
    if (topics.includes(topic)) {
      remove(new Set(profileRows.filter(row => row.topic === topic).map(row => row.key)));
    } else if (!topics.some(value => value.toLowerCase() === topic.toLowerCase())) {
      onChange([...topics, topic]);
      setSelected(new Set());
    }
  };
  const openEditor = (next: Editor, trigger: HTMLButtonElement) => {
    if (blocked) return;
    editorTrigger.current = trigger;
    setInput(next.kind === "rename" ? getTopicLabel(next.topic) : "");
    setError("");
    setEditor(next);
  };
  const saveToLibrary = async (additions: string[]) => {
    const customs = additions.filter(topic => !allTopics.some(value => value.toLowerCase() === topic.toLowerCase()));
    if (!customs.length) return;
    setAddedLibrary(current => [...current, ...customs]);
    setSavingLibrary(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { setNotice(libraryFailure); return; }
      const { error: saveError } = await supabase.from("user_custom_topics").upsert(
        customs.map(topic => ({ user_id: user.id, subject_name: subjectName, topic })),
        { onConflict: "user_id,subject_name,topic", ignoreDuplicates: true },
      );
      if (saveError) setNotice(libraryFailure);
    } catch {
      setNotice(libraryFailure);
    } finally {
      setSavingLibrary(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (blocked || !editor) return;
    if (editor.kind === "rename") {
      const label = input.trim();
      if (!label || label.length > 180) { setError("Enter a topic name of 1–180 characters."); return; }
      if (!topics.includes(editor.topic)) { setError("This topic is no longer in your profile."); return; }
      if (occurrences.get(editor.topic) !== 1) { setError(duplicateTitle); return; }
      onRename(editor.topic, label);
    } else {
      if (savingLibrary) return;
      const existing = new Set(topics.map(topic => topic.toLowerCase()));
      const incoming = new Map<string, string>();
      for (const topic of input.split(/[,\r\n]+/).map(cleanProfileTopic).filter(value => value.length > 1)) {
        if (!existing.has(topic.toLowerCase())) incoming.set(topic.toLowerCase(), topic);
      }
      const additions = [...incoming.values()];
      if (!additions.length) { setError("Enter a new topic to add. Duplicate topics are skipped."); return; }
      onChange([...topics, ...additions]);
      setNotice("");
      setSelected(new Set());
      void saveToLibrary(additions);
    }
    setEditor(null);
  };
  const views = [
    { value: "profile" as const, label: "In this profile", count: topics.length },
    { value: "library" as const, label: "Topic library", count: library.length },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden font-sans text-foreground">
      <aside aria-label="Browse topics" className="hidden w-48 shrink-0 overflow-y-auto border-r border-border px-3 py-6 md:block lg:w-52">
        <p className="mb-4 px-3 text-xs font-medium text-muted-foreground">Topics</p>
        <nav aria-label="Topic views" className="space-y-1">
          {views.map(option => (
            <button key={option.value} type="button" aria-pressed={view === option.value}
              onClick={() => changeView(option.value)}
              className={cn("flex min-h-11 w-full items-center justify-between gap-3 border-l-2 px-3 py-3 text-left text-xs", focusRing,
                view === option.value ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <span>{option.label}</span><span className="font-normal tabular-nums text-muted-foreground">{option.count}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section aria-label="Profile topics" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{view === "profile" ? "Topics" : "Topic library"}</h2>
            <button type="button" disabled={blocked || savingLibrary} aria-label="Add topic"
              title={locked ? lockedTitle : "Add topic"} className={cn(iconButton, focusRing)}
              onClick={event => openEditor({ kind: "add" }, event.currentTarget)}>
              <Plus aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {locked && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{lockedTitle}</p>}
          <div className="flex items-center gap-2.5">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input ref={searchInput} type="search" aria-label="Search topics" placeholder="Search topics…"
                value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 rounded-md bg-transparent pl-9 text-xs" />
            </div>
            {view === "profile" && <Button type="button" variant="outline" disabled={blocked} aria-pressed={selecting}
              title={locked ? lockedTitle : undefined} onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}
              className="min-h-11 rounded-md px-3 text-xs font-normal">
              {selecting ? "Done selecting" : "Select topics"}
            </Button>}
          </div>
          <select aria-label="Topic view" value={view} onChange={event => changeView(event.target.value as TopicView)}
            className={cn("mt-2.5 min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-xs md:hidden", focusRing)}>
            {views.map(option => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
          </select>
          <div className="mt-1 flex min-h-11 flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
            <p role="status" aria-live="polite">{query ? `${filtered.length} of ${rows.length} topics` : `${topics.length} topics in this profile`}</p>
            <div className="flex flex-wrap items-center gap-x-3">
              <select aria-label="Sort topics" value={sort} onChange={event => setSort(event.target.value)}
                className={cn("min-h-11 max-w-full bg-transparent text-xs", focusRing)}>
                <option value="original">Original order</option><option value="alphabetical">A–Z</option>
              </select>
              {canUndo && <button type="button" disabled={blocked} aria-label="Undo last topic change"
                title={locked ? lockedTitle : "Undo last topic change"}
                onClick={() => { if (!blocked) { setSelected(new Set()); setNotice(""); onUndo(); } }}
                className={cn("inline-flex min-h-11 items-center gap-1 disabled:opacity-50", focusRing)}>
                <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />Undo
              </button>}
            </div>
          </div>
          {selecting && view === "profile" && <div className="border-b border-border text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <span>{selectedRows.length} selected{hiddenSelected > 0 && ` (${hiddenSelected} outside this view)`}</span>
              <div className="flex items-center gap-x-3">
                <button type="button" disabled={blocked || !filtered.length} className={cn("min-h-11 disabled:opacity-50", focusRing)}
                  onClick={() => {
                    if (blocked) return;
                    setSelected(current => {
                      const next = new Set(current);
                      filtered.forEach(row => allShownSelected ? next.delete(row.key) : next.add(row.key));
                      return next;
                    });
                  }}>{allShownSelected ? "Deselect shown" : "Select shown"}</button>
                <button type="button" disabled={blocked || !selectedRows.length || wouldRemoveAll}
                  aria-label="Remove selected topics" title={locked ? lockedTitle : "Remove selected topics"}
                  aria-describedby={wouldRemoveAll ? `${id}-keep-one` : undefined}
                  onClick={() => remove(new Set(selectedRows.map(row => row.key)))}
                  className={cn(iconButton, "hover:text-destructive", focusRing)}>
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
            {wouldRemoveAll && <p id={`${id}-keep-one`} className="pb-3">Keep at least one topic in your profile.</p>}
          </div>}
          {notice && <p role="status" className="pb-2 text-xs text-muted-foreground">{notice}</p>}
        </div>
        <div aria-label="Topic list" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-6">
          <h3 className="border-b border-border py-3 text-xs font-medium text-muted-foreground">{view === "profile" ? "Included topics" : "Choose topics to include"}</h3>
          {!filtered.length ? <p className="py-10 text-center text-sm text-muted-foreground">
            {query ? "No matching topics. Try another search." : view === "profile" ? "No topics yet. Add a topic to get started." : "No topics in your library yet."}
          </p> : <ul className="divide-y divide-border/60">
            {filtered.map(row => {
              const included = topics.includes(row.topic);
              const caseMatch = !included && topics.find(topic => topic.toLowerCase() === row.topic.toLowerCase());
              const lastLibraryTopic = included && topics.every(topic => topic === row.topic);
              return <li key={row.key}>
                <article aria-label={row.label} className="flex min-h-20 min-w-0 items-center gap-1 py-2">
                  {(selecting || view === "library") && <label className="flex h-11 w-11 shrink-0 items-center justify-center">
                    <input type="checkbox" aria-label={`${view === "library" ? "Include" : "Select"} ${row.label}`}
                      checked={view === "library" ? included || !!caseMatch : selected.has(row.key)}
                      disabled={blocked || (view === "library" && (!!caseMatch || lastLibraryTopic))}
                      title={locked ? lockedTitle : caseMatch ? `Already included as ${caseMatch}.` : lastLibraryTopic ? "Keep at least one topic in your profile." : undefined}
                      onChange={() => {
                        if (blocked) return;
                        if (view === "library") toggleLibrary(row.topic);
                        else setSelected(current => {
                          const next = new Set(current);
                          if (next.has(row.key)) next.delete(row.key); else next.add(row.key);
                          return next;
                        });
                      }} style={{ accentColor: accent }} className={cn("h-4 w-4", focusRing)} />
                  </label>}
                  <div className="min-w-0 flex-1 py-1">
                    <p className="break-words text-sm font-medium leading-relaxed [overflow-wrap:anywhere]">{row.label}</p>
                    {row.label !== row.topic && <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">Original name: {row.topic}</p>}
                  </div>
                  {view === "profile" && <div className="ml-1 flex shrink-0 items-center">
                    <button type="button" disabled={blocked || occurrences.get(row.topic) > 1} aria-label={`Edit ${row.label}`}
                      title={locked ? lockedTitle : occurrences.get(row.topic) > 1 ? duplicateTitle : `Edit ${row.label}`}
                      onClick={event => openEditor({ kind: "rename", topic: row.topic }, event.currentTarget)} className={cn(iconButton, focusRing)}>
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={blocked || topics.length <= 1} aria-label={`Remove ${row.label}`}
                      title={locked ? lockedTitle : topics.length <= 1 ? "Keep at least one topic in your profile." : `Remove ${row.label}`}
                      onClick={() => remove(new Set([row.key]))} className={cn(iconButton, "hover:text-destructive", focusRing)}>
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>}
                </article>
              </li>;
            })}
          </ul>}
        </div>
      </section>
      <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}>
        <DialogContent hideCloseButton className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
          onCloseAutoFocus={event => {
            event.preventDefault();
            const trigger = editorTrigger.current;
            if (trigger?.isConnected && !trigger.disabled) trigger.focus(); else searchInput.current?.focus();
          }}>
          <DialogHeader>
            <DialogTitle>{editor?.kind === "add" ? "Add topics" : "Edit topic"}</DialogTitle>
            <DialogDescription>{editor?.kind === "add"
              ? "Enter topics separated by commas or new lines. Duplicate topics will be skipped."
              : "Change the display name. Your quiz history stays linked to the original topic."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate className="space-y-4">
            <fieldset disabled={blocked} className="space-y-2">
              <label htmlFor={`${id}-name`} className="text-xs font-medium">{editor?.kind === "add" ? "New topics" : "Topic name"}</label>
              {editor?.kind === "add" ? <Textarea id={`${id}-name`} value={input} autoFocus rows={5}
                onChange={event => { setInput(event.target.value); setError(""); }}
                aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
                placeholder="One topic per line, or separated by commas" />
                : <Input id={`${id}-name`} value={input} maxLength={180} autoFocus
                  onChange={event => { setInput(event.target.value); setError(""); }}
                  aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />}
            </fieldset>
            {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
            <DialogFooter className="flex-row justify-end gap-2 space-x-0">
              <Button type="button" variant="outline" onClick={() => setEditor(null)} className="min-h-11">Cancel</Button>
              <Button type="submit" disabled={blocked || (editor?.kind === "add" && savingLibrary)} className="min-h-11">
                {editor?.kind === "add" ? "Add" : "Done"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
