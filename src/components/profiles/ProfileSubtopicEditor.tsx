import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronRight, Pencil, Plus, RotateCcw, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { profileTopicLabel, profileTopicNotes } from "@/lib/profile-topic-presentation";
import type { ProfileTemplate } from "../../../supabase/functions/_shared/profile-template";
import type { ProfileEvidence } from "../../../supabase/functions/_shared/profile-evidence";

export interface ProfileSubtopicEditorProps {
  template: ProfileTemplate;
  evidence: ProfileEvidence | null;
  disabled?: boolean;
  onRenameTopic: (topic: string, label: string, notes: string) => void;
  onRemoveTopics: (topics: string[]) => void;
  onAddTopic: (label: string, notes: string) => void;
  onRestoreTopics: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

type Source = NonNullable<ProfileEvidence["topicDetails"]>[number]["sources"][number];
type Editor = { kind: "add" } | { kind: "rename"; topic: string };

interface TopicRow {
  topic: string;
  label: string;
  notes: string;
  code: string;
  added: boolean;
  renamed: boolean;
  path: string[];
  sources: Source[];
  filter: string;
}

const ALL = "all";
const UNGROUPED = "ungrouped";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function topicName(topic: string) {
  const match = topic.match(/^((?:[A-Za-z]{1,3})?\d+(?:\.\d+)*[A-Za-z]?)\s+(.+)$/);
  return match ? { code: match[1], name: match[2] } : { code: "", name: topic };
}

/** The parent owns all template mutations and history; filters only change this view. */
export function ProfileSubtopicEditor({
  template, evidence, disabled = false, onRenameTopic, onRemoveTopics, onAddTopic,
  onRestoreTopics, onUndo, canUndo,
}: ProfileSubtopicEditorProps) {
  const id = useId();
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(ALL);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const query = search.trim().toLocaleLowerCase();

  const documents = useMemo(
    () => new Map(evidence?.documents.map(document => [document.id, document.title]) ?? []),
    [evidence],
  );
  const { rows, filters } = useMemo(() => {
    const details = new Map<string, NonNullable<ProfileEvidence["topicDetails"]>[number]>();
    for (const detail of evidence?.topicDetails ?? [])
      if (!details.has(detail.topic)) details.set(detail.topic, detail);
    const added = new Set(template.addedTopics ?? []);
    const leaves = [...new Set(template.topics)].filter(topic => topic.trim()).map(topic => {
      // A student addition must never inherit source provenance from a matching name.
      const detail = added.has(topic) ? undefined : details.get(topic);
      const canonical = topicName(topic);
      const alias = profileTopicLabel(template, topic);
      return {
        topic,
        label: alias && alias !== topic ? alias : canonical.name,
        notes: profileTopicNotes(template, topic),
        code: canonical.code,
        added: added.has(topic),
        renamed: !!alias && alias !== topic,
        path: detail?.path.filter(part => part.trim()) ?? [],
        sources: detail?.sources.filter(source =>
          Number.isInteger(source.page) && source.page > 0 && source.text.trim(),
        ) ?? [],
      };
    });
    // Skip shared wrapper headings so a subject with one root can still browse its sections.
    const paths = leaves.map(row => row.path).filter(path => path.length);
    let level = 0;
    while (paths.length && paths.every(path =>
      path.length > level + 1 && path[level] === paths[0][level],
    )) level++;
    const filterMap = new Map<string, { value: string; label: string; count: number }>();
    const rows: TopicRow[] = leaves.map(row => {
      const value = row.path.length ? JSON.stringify(row.path.slice(0, level + 1)) : UNGROUPED;
      const existing = filterMap.get(value);
      if (existing) existing.count++;
      else filterMap.set(value, {
        value, label: row.path[level] ?? "Ungrouped subtopics", count: 1,
      });
      return { ...row, filter: value };
    });
    return { rows, filters: [...filterMap.values()] };
  }, [template, evidence]);

  const activeFilter = filters.some(option => option.value === filter) ? filter : ALL;
  const filtered = rows.filter(row =>
    (activeFilter === ALL || row.filter === activeFilter) &&
    [row.topic, row.label, row.notes, ...row.path,
      ...row.sources.flatMap(source => [source.text, documents.get(source.documentId) ?? ""])]
      .some(text => text.toLocaleLowerCase().includes(query)),
  );
  const groups = new Map<string, { path: string[]; rows: TopicRow[] }>();
  for (const row of filtered) {
    const key = JSON.stringify(row.path);
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { path: row.path, rows: [row] });
  }
  const selectedTopics = rows.filter(row => selected.has(row.topic)).map(row => row.topic);
  const hiddenSelected = selectedTopics.length - filtered.filter(row => selected.has(row.topic)).length;
  const allShownSelected = filtered.length > 0 && filtered.every(row => selected.has(row.topic));
  const wouldRemoveAll = selectedTopics.length > 0 && selectedTopics.length >= rows.length;
  const sourceTopics = evidence?.facts.topics ?? [];
  const coverageChanged = sourceTopics.length > 0 &&
    (rows.length !== new Set(sourceTopics).size || rows.some(row => !sourceTopics.includes(row.topic)));
  const addLimitReached = rows.length >= 400 || (template.addedTopics?.length ?? 0) >= 40;

  const toggle = (current: Set<string>, topic: string) => {
    const next = new Set(current);
    if (next.has(topic)) next.delete(topic);
    else next.add(topic);
    return next;
  };
  const remove = (topics: string[]) => {
    if (disabled || !topics.length || rows.length - topics.length < 1) return;
    onRemoveTopics(topics);
    setSelected(new Set());
  };
  const openEditor = (next: Editor, trigger: HTMLButtonElement) => {
    editorTrigger.current = trigger;
    const row = next.kind === "rename" ? rows.find(row => row.topic === next.topic) : undefined;
    setLabel(row?.label ?? "");
    setNotes(row?.notes ?? "");
    setError("");
    setEditor(next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || !editor) return;
    const value = label.trim();
    if (!value) { setError("Enter a subtopic name."); return; }
    if (editor.kind === "add") {
      if (addLimitReached) { setError("This profile has reached its limit for added subtopics."); return; }
      if (rows.some(row => row.topic.toLocaleLowerCase() === value.toLocaleLowerCase())) {
        setError("This subtopic is already in your profile."); return;
      }
      onAddTopic(value, notes.trim());
    } else {
      if (!rows.some(row => row.topic === editor.topic)) {
        setError("This subtopic is no longer in your profile."); return;
      }
      // Preserve the original canonical label when only the student's notes changed.
      const row = rows.find(row => row.topic === editor.topic)!;
      const nextLabel = !row.renamed && value === row.label ? editor.topic : value;
      onRenameTopic(editor.topic, nextLabel, notes.trim());
    }
    setEditor(null);
  };

  const options = [{ value: ALL, label: "All subtopics", count: rows.length }, ...filters];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden font-sans text-foreground">
      <aside aria-label="Browse your syllabus" className="hidden w-48 shrink-0 overflow-y-auto border-r border-border bg-muted/15 px-3 py-6 md:block lg:w-52">
        <p className="mb-3 px-3 text-10 font-semibold uppercase tracking-wider text-muted-foreground">Browse your syllabus</p>
        <nav aria-label="Filter subtopics" className="space-y-1">
          {options.map(option => (
            <button key={option.value} type="button" aria-pressed={activeFilter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-xs leading-relaxed", focusRing,
                activeFilter === option.value ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.label}</span>
              <span className="shrink-0 text-11 tabular-nums">{option.count}</span>
            </button>
          ))}
        </nav>
        <p className="mx-3 mt-6 border-t border-border pt-5 text-11 leading-relaxed text-muted-foreground">
          Choose a group to focus the list. Your whole profile stays included.
        </p>
      </aside>

      <section aria-label="Profile subtopics" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 px-4 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-serif text-22 font-semibold tracking-tight">Your subtopics</h2>
              <p className="mt-1.5 text-11 leading-relaxed text-muted-foreground">Find a topic, see what it covers, or make a change.</p>
            </div>
            <Button type="button" variant="outline" disabled={disabled || addLimitReached}
              onClick={event => openEditor({ kind: "add" }, event.currentTarget)}
              className="shrink-0 gap-1.5 rounded-lg px-2.5 text-11 font-medium sm:px-3">
              <Plus aria-hidden="true" />Add subtopic
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input id={`${id}-search`} type="search" aria-label="Search subtopics and source outcomes"
                value={search} onChange={event => setSearch(event.target.value)}
                placeholder="Search subtopics or source outcomes…" className="rounded-lg bg-muted/10 pl-9 text-xs" />
            </div>
            <Button type="button" variant="outline" disabled={disabled} aria-pressed={selecting}
              onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}
              className="hidden rounded-lg px-3 text-11 font-medium md:inline-flex">
              {selecting ? "Done selecting" : "Select topics"}
            </Button>
          </div>
          <select aria-label="Filter by syllabus group" value={activeFilter}
            onChange={event => setFilter(event.target.value)}
            className={cn("mt-2.5 min-h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-xs text-muted-foreground md:hidden", focusRing)}>
            {options.map(option => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
          </select>
          <div className="mt-1 flex min-h-11 flex-wrap items-center justify-between gap-x-3 text-10 text-muted-foreground">
            <p role="status" aria-live="polite">
              {query || activeFilter !== ALL
                ? `${filtered.length} of ${rows.length} subtopics`
                : `${rows.length} ${rows.length === 1 ? "subtopic" : "subtopics"} · ${groups.size} ${groups.size === 1 ? "section" : "sections"}`}
            </p>
            <div className="flex flex-wrap items-center gap-x-3">
              {coverageChanged && (
                <button type="button" disabled={disabled} onClick={onRestoreTopics}
                  className={cn("inline-flex min-h-11 items-center gap-1 text-11 hover:text-primary disabled:opacity-50", focusRing)}>
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />Restore subtopics
                </button>
              )}
              {canUndo && (
                <button type="button" disabled={disabled} onClick={onUndo} aria-label="Undo last topic change"
                  className={cn("inline-flex min-h-11 items-center gap-1 text-11 text-primary disabled:opacity-50", focusRing)}>
                  <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />Undo
                </button>
              )}
              <button type="button" disabled={disabled} aria-pressed={selecting}
                onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}
                className={cn("min-h-11 text-11 hover:text-primary disabled:opacity-50 md:hidden", focusRing)}>
                {selecting ? "Done selecting" : "Select multiple"}
              </button>
            </div>
          </div>
          {selecting && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 text-11 text-primary">
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="py-2 font-semibold">{selectedTopics.length} selected{hiddenSelected > 0 && ` (${hiddenSelected} outside this view)`}</span>
                <div className="flex flex-wrap items-center gap-x-3">
                  <button type="button" disabled={disabled || !filtered.length}
                    onClick={() => setSelected(current => {
                      const next = new Set(current);
                      filtered.forEach(row => allShownSelected ? next.delete(row.topic) : next.add(row.topic));
                      return next;
                    })}
                    className={cn("min-h-11 disabled:opacity-50", focusRing)}>
                    {allShownSelected ? "Deselect shown" : "Select shown"}
                  </button>
                  <button type="button" disabled={disabled || !selectedTopics.length || wouldRemoveAll}
                    onClick={() => remove(selectedTopics)} aria-describedby={wouldRemoveAll ? `${id}-keep-one` : undefined}
                    className={cn("min-h-11 font-semibold text-destructive disabled:opacity-50", focusRing)}>
                    Remove selected
                  </button>
                </div>
              </div>
              {wouldRemoveAll && <p id={`${id}-keep-one`} className="pb-3 text-muted-foreground">Keep at least one subtopic in your profile.</p>}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6" aria-label="Subtopic list">
          {!rows.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No subtopics yet. Add a subtopic to get started.</p>
          ) : !filtered.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <p>No matching subtopics. Try another search or group.</p>
              <button type="button" onClick={() => { setSearch(""); setFilter(ALL); }}
                className={cn("mt-2 min-h-11 text-xs text-primary", focusRing)}>Clear filters</button>
            </div>
          ) : [...groups.entries()].map(([key, group], groupIndex) => (
            <section key={key} aria-labelledby={`${id}-group-${groupIndex}`} className="mb-5 min-w-0">
              <div className="flex items-start justify-between gap-3 pb-3 pt-3">
                <div className="min-w-0">
                  <h3 id={`${id}-group-${groupIndex}`} className="break-words text-xs font-semibold text-foreground/80 [overflow-wrap:anywhere]">
                    {group.path[group.path.length - 1] ?? (groups.size === 1 ? "Subtopics" : "Ungrouped subtopics")}
                  </h3>
                  {group.path.length > 1 && <p className="mt-1 break-words text-9 uppercase tracking-wide text-muted-foreground [overflow-wrap:anywhere]">{group.path.slice(0, -1).join(" / ")}</p>}
                </div>
                <span className="shrink-0 pt-0.5 text-10 text-muted-foreground">{group.rows.length} {group.rows.length === 1 ? "subtopic" : "subtopics"}</span>
              </div>
              <ul className="space-y-2">
                {group.rows.map((row, rowIndex) => {
                  const open = !!query || opened.has(row.topic);
                  const hasMore = !!(row.sources.length || row.notes);
                  const contentId = `${id}-source-${groupIndex}-${rowIndex}`;
                  const firstSource = row.sources[0];
                  return (
                    <li key={row.topic}>
                      <article aria-label={row.label} className="min-w-0 rounded-xl border border-border bg-card">
                        <div className="flex min-h-20 min-w-0 items-center gap-0 py-2 pl-0.5 pr-1 sm:pr-2">
                          {selecting && (
                            <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                              <input type="checkbox" aria-label={`Select ${row.label}`} checked={selected.has(row.topic)} disabled={disabled}
                                onChange={() => setSelected(current => toggle(current, row.topic))}
                                className={cn("h-4 w-4 accent-primary", focusRing)} />
                            </label>
                          )}
                          {hasMore ? (
                            <button type="button" aria-label={`${open ? "Hide" : "Show"} source outcomes and notes for ${row.label}`}
                              aria-expanded={open} aria-controls={contentId} onClick={() => setOpened(current => toggle(current, row.topic))}
                              className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-primary", focusRing)}>
                              <ChevronRight aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
                            </button>
                          ) : <span aria-hidden="true" className="w-4 shrink-0 sm:w-11" />}
                          <div className="min-w-0 flex-1 py-1">
                            <h4 className="break-words text-sm font-semibold leading-relaxed [overflow-wrap:anywhere]">
                              {row.code && <span className="mb-0.5 block text-10 font-normal text-muted-foreground sm:mb-0 sm:mr-2 sm:inline">{row.code}</span>}
                              {row.label}
                            </h4>
                            {(row.added || row.renamed || row.notes) && (
                              <span className="mt-1 inline-block rounded bg-warning-light px-1.5 py-0.5 text-9 font-medium text-warning">
                                {row.added ? "Added by you" : "Edited by you"}
                              </span>
                            )}
                            {row.renamed && <p className="mt-1 break-words text-10 leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{!row.added && (row.sources.length || sourceTopics.includes(row.topic)) ? "Original source name" : "Original name"}: {row.topic}</p>}
                            <p className="mt-1 break-words text-10 leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                              {firstSource ? <>{documents.get(firstSource.documentId) || "Source document"} · PDF page {firstSource.page}{row.sources.length > 1 && ` · +${row.sources.length - 1} source ${row.sources.length === 2 ? "passage" : "passages"}`}</>
                                : row.added ? "Your own subtopic" : "No source detail saved"}
                            </p>
                          </div>
                          <div className="ml-1 flex shrink-0 items-center sm:ml-2">
                            <button type="button" disabled={disabled} aria-label={`Edit ${row.label}`}
                              onClick={event => openEditor({ kind: "rename", topic: row.topic }, event.currentTarget)}
                              className={cn("inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-10 text-muted-foreground hover:bg-primary/5 hover:text-primary disabled:opacity-50", focusRing)}>
                              <Pencil aria-hidden="true" className="h-3.5 w-3.5" /><span className="hidden lg:inline">Edit</span>
                            </button>
                            <button type="button" disabled={disabled || rows.length <= 1} aria-label={`Remove ${row.label}`}
                              title={rows.length <= 1 ? "Keep at least one subtopic in your profile." : `Remove ${row.label}`}
                              onClick={() => remove([row.topic])}
                              className={cn("inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-10 text-muted-foreground hover:bg-destructive/5 hover:text-destructive disabled:opacity-50", focusRing)}>
                              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /><span className="hidden lg:inline">Remove</span>
                            </button>
                          </div>
                        </div>
                        {hasMore && open && (
                          <div id={contentId} className="min-w-0 space-y-4 pb-4 pl-5 pr-4 sm:pl-11">
                            {row.sources.length > 0 && (
                              <div>
                                <p className="mb-2 text-10 font-semibold uppercase tracking-wide text-muted-foreground">Source outcomes</p>
                                <ul aria-label={`Source outcomes for ${row.label}`} className="space-y-4">
                                  {row.sources.map((source, index) => (
                                    <li key={`${source.documentId}:${source.page}:${index}`} className="min-w-0">
                                      <p className="mb-1 break-words text-10 text-muted-foreground [overflow-wrap:anywhere]">{documents.get(source.documentId) || "Source document"} · physical PDF page {source.page}</p>
                                      <blockquote className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{source.text}</blockquote>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {row.notes && <div className="rounded-lg bg-muted/30 p-3">
                              <p className="mb-1 text-10 font-semibold text-muted-foreground">Your notes · written by you</p>
                              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed [overflow-wrap:anywhere]">{row.notes}</p>
                            </div>}
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl sm:max-w-md"
          onCloseAutoFocus={event => { event.preventDefault(); editorTrigger.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editor?.kind === "add" ? "Add subtopic" : "Edit subtopic"}</DialogTitle>
            <DialogDescription>
              {editor?.kind === "add" ? "Add a subtopic of your own. It will be marked as added by you."
                : "Your name and notes stay separate from the original syllabus wording."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate className="space-y-4">
            <fieldset disabled={disabled} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor={`${id}-name`} className="text-xs font-medium">Subtopic name</label>
                <Input id={`${id}-name`} value={label} onChange={event => { setLabel(event.target.value); setError(""); }}
                  maxLength={180} autoFocus aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
              </div>
              <div className="space-y-2">
                <label htmlFor={`${id}-notes`} className="text-xs font-medium">Your notes <span className="font-normal text-muted-foreground">(optional)</span></label>
                <Textarea id={`${id}-notes`} value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000}
                  placeholder="Anything you want to remember about this topic…" rows={4} />
                <p className="text-11 leading-relaxed text-muted-foreground">These are your personal notes, separate from the source outcomes.</p>
              </div>
            </fieldset>
            {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
            <DialogFooter className="flex-row justify-end gap-2 space-x-0">
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
              <Button type="submit" disabled={disabled}>Done</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
