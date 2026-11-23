import { useState, type ReactNode } from "react";
import { Check, Clock3, FileText, Pencil, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSubtopicEditor } from "./ProfileSubtopicEditor";
import type { ProfileTemplate } from "../../../supabase/functions/_shared/profile-template";
import type { ProfileEvidence } from "../../../supabase/functions/_shared/profile-evidence";

interface Props {
  template: ProfileTemplate;
  evidence: ProfileEvidence | null;
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  disabled: boolean;
  settings: ReactNode;
  source: ReactNode;
  canUndo: boolean;
  onUndo: () => void;
  onRestoreTopics: () => void;
  onRenameTopic: (topic: string, label: string, notes: string) => void;
  onRemoveTopics: (topics: string[]) => void;
  onAddTopic: (label: string, notes: string) => void;
}

/** A view over the complete validated draft; tabs never reconstruct its data. */
export function AIProfileReview({ template, evidence, name, onNameChange, onClose,
  disabled, settings, source, canUndo, onUndo, onRestoreTopics, onRenameTopic,
  onRemoveTopics, onAddTopic }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [tab, setTab] = useState("topics");
  const sourceChanged = !!evidence && (template.addedTopics?.length ||
    evidence.facts.topics.some(topic => !template.topics.includes(topic)));
  const identity = template.identity;
  const modeLabel = template.mode === "full_mock" ? "Full mock" :
    template.mode === "short_practice" ? "Short practice" : "Custom assessment";

  return <section className="flex min-h-0 flex-1 flex-col" aria-label="AI exam profile editor">
    <header className="shrink-0 px-4 pb-3 pt-5 sm:px-7 sm:pb-4 sm:pt-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Your exam profile
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            {editingName ? <Input autoFocus aria-label="Profile name" maxLength={120}
              className="min-h-11 min-w-0 text-base" value={name} disabled={disabled}
              onChange={event => onNameChange(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); setEditingName(false); } }}
              onBlur={() => setEditingName(false)} /> : <h2 className="min-w-0 break-words font-serif text-[26px] font-semibold leading-tight sm:text-[30px]">
                {name || identity.subject + " · " + identity.component}
              </h2>}
            <Button type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0"
              aria-label={editingName ? "Finish editing profile name" : "Edit profile name"}
              disabled={disabled} onMouseDown={event => event.preventDefault()}
              onClick={() => setEditingName(!editingName)}>
              {editingName ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 break-words text-xs leading-relaxed text-muted-foreground">
            {identity.organisation} · {identity.qualification} · {identity.subject}
            <span className="mx-2 text-border" aria-hidden="true">/</span>
            <span className="font-medium text-foreground">{identity.component}</span>
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" className="-mr-1 -mt-1 h-11 w-11 shrink-0"
          aria-label="Close profile builder" onClick={onClose} disabled={disabled}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {template.durationMinutes} minutes</span>
        <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {template.marks} marks</span>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary sm:text-xs">{modeLabel}</span>
      </div>
    </header>
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList aria-label="Profile sections" className="h-auto w-full shrink-0 justify-start gap-5 rounded-none border-x-0 border-t-0 border-b border-border bg-transparent px-4 py-0 sm:gap-7 sm:px-7">
        {[["topics", "Subtopics"], ["settings", "Exam settings"], ["source", "Syllabus & source"]].map(([value, label]) =>
          <TabsTrigger key={value} value={value} onClick={() => setTab(value)} className="min-h-12 rounded-none border-b-2 border-transparent px-0 py-3 text-[11px] text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:text-xs">
            {label}{value === "topics" && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">{template.topics.length}</span>}
          </TabsTrigger>)}
      </TabsList>
      <TabsContent value="topics" className="m-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        {!!sourceChanged && <div role="status" className="shrink-0 border-b border-warning/20 bg-warning-light px-4 py-2.5 text-xs leading-relaxed sm:px-7">
          Your topic coverage has changed. This is a customised profile.
          <Button type="button" variant="link" size="sm" className="ml-1 h-auto min-h-8 px-1 py-0 text-xs"
            onClick={onRestoreTopics} disabled={disabled}>Restore full paper</Button>
        </div>}
        <ProfileSubtopicEditor template={template} evidence={evidence} disabled={disabled}
          onRenameTopic={onRenameTopic} onRemoveTopics={onRemoveTopics} onAddTopic={onAddTopic}
          onRestoreTopics={onRestoreTopics} onUndo={onUndo} canUndo={canUndo} />
      </TabsContent>
      <TabsContent value="settings" className="m-0 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
        <h3 className="font-serif text-2xl font-semibold">Exam settings</h3>
        <p className="mb-5 mt-1 text-xs leading-relaxed text-muted-foreground">Your paper details and question layout, together in one place.</p>
        {settings}
      </TabsContent>
      <TabsContent value="source" className="m-0 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
        <h3 className="font-serif text-2xl font-semibold">Syllabus & source</h3>
        <p className="mb-5 mt-1 text-xs leading-relaxed text-muted-foreground">See where the assessment details and subtopics came from.</p>
        {source}
      </TabsContent>
    </Tabs>
  </section>;
}
