import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, BookOpen, Search } from "lucide-react";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { AddSubjectModal } from "./AddSubjectModal";
import { SubjectCard } from "@/components/subjects/SubjectCard";

export const SubjectsList = () => {
  const { subjects, isLoading: subjectsLoading, refetch: refetchSubjects } = useUserSubjects();
  const { getProfilesForSubject, loading: profilesLoading } = useSubjectProfiles();

  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.subject_name.toLowerCase().includes(q));
  }, [subjects, query]);

  if (subjectsLoading || profilesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <>
        <div className="rounded-2xl border-2 border-dashed border-border/60 py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No subjects yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
            Add your subjects to start generating practice questions and tracking your progress topic by topic.
          </p>
          <Button onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add your first subject
          </Button>
        </div>
        <AddSubjectModal
          open={addOpen}
          onOpenChange={setAddOpen}
          existingSubjectNames={[]}
          existingColours={[]}
          onSubjectAdded={refetchSubjects}
        />
      </>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects…"
            className="pl-9 h-9 bg-[hsl(220_8%_13%)] border-[hsl(220_6%_20%)] focus-visible:ring-1"
          />
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5 h-9 shrink-0">
          <Plus className="h-4 w-4" />
          Add subject
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            profileCount={getProfilesForSubject(subject.subject_name).length}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No subjects match "{query}"
        </div>
      )}

      <AddSubjectModal
        open={addOpen}
        onOpenChange={setAddOpen}
        existingSubjectNames={subjects.map((s) => s.subject_name)}
        existingColours={subjects.map((s) => s.subject_color)}
        onSubjectAdded={refetchSubjects}
      />
    </div>
  );
};
