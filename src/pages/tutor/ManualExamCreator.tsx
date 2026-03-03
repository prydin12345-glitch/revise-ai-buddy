import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Plus, GripVertical, Trash2, Check, Save, Eye, EyeOff, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualQuestionEditor } from "@/components/tutor/ManualQuestionEditor";
import { ManualQuestionPreview } from "@/components/tutor/ManualQuestionPreview";
import { MarkingPreferenceSelector } from "@/components/tutor/MarkingPreferenceSelector";
import { ExamCompositionSidebar } from "@/components/tutor/ExamCompositionSidebar";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

// ---- types ----
interface QuestionDraft {
  id: string;
  questionText: string;
  expectedAnswer: string;
  maxMarks: number;
  topicTag: string;
  questionType: string;
}

const newQuestion = (): QuestionDraft => ({
  id: crypto.randomUUID(),
  questionText: "",
  expectedAnswer: "",
  maxMarks: 2,
  topicTag: "",
  questionType: "short_answer",
});

const EDUCATIONAL_TIERS = [
  { id: "secondary_14_16", name: "Level 1 — High School" },
  { id: "college_16_18", name: "Level 2 — College" },
  { id: "university_18plus", name: "Level 3 — University" },
];

// ---- Sortable question card ----
function SortableQuestionCard({
  q,
  index,
  isActive,
  onSelect,
  onDelete,
  questionsCount,
}: {
  q: QuestionDraft;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  questionsCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all duration-200",
        isDragging && "opacity-50",
        isActive
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border hover:border-muted-foreground/30 bg-card/40",
        !isActive && "opacity-70 hover:opacity-100"
      )}
      onClick={onSelect}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex-shrink-0">
        {index + 1}
      </span>
      <span className="text-sm truncate flex-1 text-foreground/80">
        {q.questionText.slice(0, 60) || "Untitled question"}
      </span>
      <span className="text-xs text-muted-foreground flex-shrink-0">{q.maxMarks}m</span>
      {questionsCount > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ---- Main page ----
export default function ManualExamCreator() {
  const navigate = useNavigate();

  // Exam-level state
  const [examTitle, setExamTitle] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3B82F6");
  const [educationalTier, setEducationalTier] = useState("");
  const [markingPreference, setMarkingPreference] = useState("ai_assisted");
  const [showAnswers, setShowAnswers] = useState(false);

  // Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeQ = questions[activeIdx] ?? questions[0];

  // Save state
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reordered);
    // Keep active on the same question
    setActiveIdx(reordered.findIndex((q) => q.id === activeQ.id));
  };

  const updateActive = useCallback(
    (patch: Partial<QuestionDraft>) => {
      setQuestions((prev) => prev.map((q, i) => (i === activeIdx ? { ...q, ...patch } : q)));
    },
    [activeIdx]
  );

  const addQuestion = () => {
    const q = newQuestion();
    setQuestions((prev) => [...prev, q]);
    setActiveIdx(questions.length);
  };

  const deleteQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => Math.min(prev, questions.length - 2));
  };

  // Auto-save (debounced)
  useEffect(() => {
    if (!examTitle.trim() || !subjectName) return;
    const t = setTimeout(() => {
      handleSave(true);
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, examTitle, subjectName, markingPreference]);

  const handleSave = async (silent = false) => {
    if (!examTitle.trim()) {
      if (!silent) toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (!subjectName) {
      if (!silent) toast({ title: "Subject required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Save questions to question bank
      const questionIds: string[] = [];
      for (const q of questions) {
        if (!q.questionText.trim()) continue;
        const { data, error } = await supabase
          .from("tutor_question_bank" as any)
          .upsert({
            id: q.id,
            tutor_id: user.id,
            question_text: q.questionText,
            question_type: q.questionType,
            expected_answer: q.expectedAnswer || null,
            max_marks: q.maxMarks,
            topic_tag: q.topicTag || null,
            subject_name: subjectName,
            marking_preference: markingPreference,
            estimated_minutes: Math.ceil(q.maxMarks * 1.5),
          } as any, { onConflict: "id" })
          .select("id")
          .single();
        if (error) throw error;
        questionIds.push((data as any).id);
      }

      if (!silent) {
        toast({ title: "Exam saved", description: `${questionIds.length} questions saved to your question bank.` });
      }
      setLastSaved(new Date());
    } catch (err: any) {
      if (!silent) toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tutor/exams")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Input
          placeholder="Exam title…"
          value={examTitle}
          onChange={(e) => setExamTitle(e.target.value)}
          className="max-w-xs bg-transparent border-none text-lg font-semibold focus-visible:ring-0 px-0"
        />
        <div className="flex-1" />
        {/* Auto-save indicator */}
        {lastSaved && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 animate-pulse">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowAnswers(!showAnswers)} className="gap-1 text-xs">
          {showAnswers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showAnswers ? "Hide" : "Show"} Answers
        </Button>
        <Button size="sm" onClick={() => handleSave(false)} disabled={saving} className="gap-1">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* LEFT: Editor + question list */}
          <ResizablePanel defaultSize={55} minSize={35}>
            <div className="h-full overflow-y-auto p-4 space-y-5">
              {/* Exam metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SubjectSelector
                  value={subjectName}
                  color={subjectColor}
                  onValueChange={setSubjectName}
                  onColorChange={setSubjectColor}
                  showLabel={false}
                />
                <Select value={educationalTier} onValueChange={setEducationalTier}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Educational level…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATIONAL_TIERS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}</SelectContent>
                </Select>
              </div>

              {/* Marking preference */}
              <MarkingPreferenceSelector value={markingPreference} onChange={setMarkingPreference} />

              {/* Question list (sortable) */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {questions.map((q, i) => (
                      <SortableQuestionCard
                        key={q.id}
                        q={q}
                        index={i}
                        isActive={i === activeIdx}
                        onSelect={() => setActiveIdx(i)}
                        onDelete={() => deleteQuestion(i)}
                        questionsCount={questions.length}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button variant="outline" size="sm" onClick={addQuestion} className="w-full gap-1 border-dashed">
                <Plus className="h-4 w-4" /> Add Question
              </Button>

              {/* Active question editor */}
              <div className="pt-2 border-t border-border">
                <ManualQuestionEditor
                  questionText={activeQ.questionText}
                  expectedAnswer={activeQ.expectedAnswer}
                  maxMarks={activeQ.maxMarks}
                  topicTag={activeQ.topicTag}
                  subjectName={subjectName}
                  educationalTier={educationalTier}
                  onQuestionTextChange={(v) => updateActive({ questionText: v })}
                  onExpectedAnswerChange={(v) => updateActive({ expectedAnswer: v })}
                  onMaxMarksChange={(v) => updateActive({ maxMarks: v })}
                  onTopicTagChange={(v) => updateActive({ topicTag: v })}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT: Preview + sidebar */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <div className="h-full overflow-y-auto p-4 space-y-6">
              {/* Live preview */}
              <div className="rounded-xl border border-border bg-card/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Student Preview</p>
                {questions.length === 0 || !questions.some((q) => q.questionText.trim()) ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-lg font-semibold text-foreground/60 mb-1">Your masterpiece starts here</p>
                    <p className="text-sm text-muted-foreground">Add your first question to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {questions.map((q, i) => (
                      <div
                        key={q.id}
                        className={cn(
                          "transition-opacity duration-300",
                          i !== activeIdx && "opacity-40"
                        )}
                      >
                        <ManualQuestionPreview
                          questionNumber={i + 1}
                          questionText={q.questionText}
                          maxMarks={q.maxMarks}
                          topicTag={q.topicTag}
                          expectedAnswer={q.expectedAnswer}
                          showAnswer={showAnswers}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Composition sidebar */}
              <ExamCompositionSidebar
                questions={questions.map((q) => ({
                  id: q.id,
                  questionText: q.questionText,
                  maxMarks: q.maxMarks,
                  topicTag: q.topicTag,
                }))}
                subjectColor={subjectColor}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
