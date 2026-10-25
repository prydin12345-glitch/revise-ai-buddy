import { Component, useEffect, useState, type ReactNode, type ComponentProps } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StatsWrongQuestion } from "@/lib/subject-profile-stats";
import { legacyExpectedAnswer, readReleasedRevisit, type ReleasedRevisit, type ReleasedRevisitQuestion } from "@/lib/revisit-question";
import { Button } from "@/components/ui/button";
import { MathRenderer } from "@/components/MathRenderer";
import { ResponseReview } from "@/components/responses/ResponseReview";
import { formatBiologyEssayKey } from "@/lib/biology-essay";
import { AssessmentBiologyFigure } from "@/components/biology/AssessmentBiologyFigure";
import { MathsFigurePanel } from "@/components/maths";
import { MechanicsFigurePanel, detectDiagramConfig } from "@/components/mechanics";
import { CircuitFigurePanel } from "@/components/circuit";
import { getCircuitConfig } from "@/components/circuit/getCircuitConfig";
import { PhysicsFigurePanel } from "@/components/physics";
import { EconomicsFigurePanel } from "@/components/economics/EconomicsFigurePanel";
import { InsertPanel } from "@/components/insert/InsertPanel";
import { isTickXTable, parseMarkdownToTableGrid, generateCorrectAnswerDisplay } from "@/components/exam/TableGridQuestion";
import { getChartData, getCorrectChartData } from "@/utils/chartData";
import { LineChart, isLineChartQuestion } from "@/components/graph/LineChart";
import {
  BoxPlotChart, isBoxPlotQuestion, HistogramChart, isHistogramQuestion,
  DataTableChart, isDataTableQuestion, BarChart, isBarChartQuestion,
  PieChart, isPieChartQuestion, CumulativeFrequencyChart, isCumulativeFrequencyQuestion,
  FrequencyPolygonChart, isFrequencyPolygonQuestion, ClimateChart, isClimateChartQuestion,
} from "@/components/graph";

interface State { review: ReleasedRevisit | null; error: string | null; loading: boolean; insert: unknown[]; insertUnavailable: boolean; insertLoading: boolean }
const emptyState: State = { review: null, error: null, loading: true, insert: [], insertUnavailable: false, insertLoading: false };

export default function QuestionRevisitContent({ row }: { row: StatsWrongQuestion }) {
  const [state, setState] = useState<State>(emptyState);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let current = true;
    setState(emptyState);
    const open = async () => {
      try {
        const { data, error } = await withDeadline(supabase.functions.invoke("get-exam-questions", { body: { examId: row.examId } }));
        if (error) throw new Error("Couldn’t open this marked review. It may be unavailable or inaccessible to your account.");
        const review = readReleasedRevisit(data, row.examId, row.questionId);
        if (!current) return;
        // Inserts are saved public paper resources. Read them only after the
        // endpoint has freshly authorised this exact marked review.
        setState({ review, error: null, loading: false, insert: [], insertUnavailable: false, insertLoading: true });
        try {
          const { data: exam, error: insertError } = await withDeadline(supabase.from("exams").select("insert_figures").eq("id", row.examId).single());
          if (!current) return;
          setState({ review, error: null, loading: false, insert: Array.isArray(exam?.insert_figures) ? exam.insert_figures : [], insertUnavailable: !!insertError, insertLoading: false });
        } catch {
          // An optional booklet failure must not discard an authorised question.
          if (current) setState({ review, error: null, loading: false, insert: [], insertUnavailable: true, insertLoading: false });
        }
      } catch (error) {
        if (current) setState({ ...emptyState, loading: false, error: error instanceof Error ? error.message : "Couldn’t open this marked review. Please retry." });
      }
    };
    void open();
    return () => { current = false; };
  }, [row.examId, row.questionId, attempt]);
  const destination = `/exam/${encodeURIComponent(row.examId)}/review?q=${encodeURIComponent(row.questionNumber)}`;
  if (state.loading) return <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true"/>Opening your marked review…</div>;
  if (!state.review) return <div className="space-y-4 py-4" role="alert"><AlertCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true"/><p className="text-sm leading-relaxed">{state.error}</p><Button variant="outline" onClick={() => retry(value => value + 1)}>Retry review</Button><Button variant="link" asChild><Link to={destination}>Open full exam review</Link></Button></div>;
  const { question, answer } = state.review;
  return <ReviewRenderBoundary destination={destination}>
    <div className="stats-question-context text-xs text-muted-foreground">{row.examTitle}</div>
    <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold tracking-tight">Question {question.question_number}</h2><span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{answer.score} / {question.marks} marks</span></div>
    <section className="space-y-3 border-t border-border pt-4" aria-label="Question">
      <MathRenderer content={question.question_text} question={question} latex={question.question_latex} hasMath={!!question.has_math} className="text-sm leading-relaxed"/>
      {question.response_definition ? <ResponseReview question={question} answerText={answer.answer_text} solutionsReleased/> : <>
        <LegacyOptions options={question.options}/>
        <SavedQuestionResources question={question} subject={row.subject}/>
        <section className="stats-expected-answer rounded-lg border border-success/25 bg-success/5 p-4" aria-labelledby="stats-expected-answer-heading"><h3 id="stats-expected-answer-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold text-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true"/>Expected answer</h3><ExpectedAnswer value={expectedLegacyValue(question)}/></section>
      </>}
    </section>
    {state.insertLoading && <p role="status" className="text-xs text-muted-foreground">Loading saved paper resources…</p>}
    {!!state.insert.length && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-medium">Saved paper resources</summary><InsertPanel figures={state.insert}/></details>}
    {state.insertUnavailable && <p className="text-xs text-muted-foreground">The saved resource booklet couldn’t load. Open the full exam review to retry its resources.</p>}
    <p className="text-xs leading-relaxed text-muted-foreground">This question and its expected answer come from your released marked review.</p>
    <Button asChild className="w-full"><Link to={destination}>Open full exam review</Link></Button>
  </ReviewRenderBoundary>;
}

function expectedLegacyValue(question: ReleasedRevisitQuestion): unknown {
  const value = legacyExpectedAnswer(question);
  if (isTickXTable(question.question_text) && value && typeof value === "object") {
    const table = parseMarkdownToTableGrid(question.question_text);
    const keys = "correctAnswers" in value ? value.correctAnswers : value;
    if (table && keys && typeof keys === "object" && !Array.isArray(keys)) {
      const selections: Record<string, number[]> = {};
      const entries = Object.entries(keys);
      if (entries.every(([, selected]) => Array.isArray(selected) && selected.every(index => typeof index === "number" && Number.isInteger(index)))) {
        for (const [id, selected] of entries) selections[id] = selected as number[];
        const display = generateCorrectAnswerDisplay(table, undefined, selections);
        if (display) return display;
      }
    }
  }
  return value;
}

function LegacyOptions({ options }: { options: unknown }) {
  if (!Array.isArray(options)) return null;
  const texts = options.map(option => typeof option === "string" ? option : option && typeof option === "object" && typeof option.text === "string" ? option.text : null);
  if (!texts.length || texts.some(value => value === null)) return null;
  return <ol className="space-y-2 rounded-lg border border-border p-3" aria-label="Question options">{texts.map((text, index) => <li key={index} className="flex items-start gap-3 text-sm"><span className="font-semibold">{String.fromCharCode(65 + index)}.</span><MathRenderer content={text!.replace(/^[A-Za-z][.)]\s*/, "")}/></li>)}</ol>;
}

function ExpectedAnswer({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <p className="text-sm text-muted-foreground">An expected answer wasn’t supplied for this question. Open the full exam review for its marking feedback.</p>;
  const essay = formatBiologyEssayKey(value);
  if (typeof value === "string" || essay !== String(value)) return <MathRenderer content={essay} className="text-sm leading-relaxed"/>;
  if (typeof value === "number" || typeof value === "boolean") return <p className="text-sm">{String(value)}</p>;
  if (Array.isArray(value)) return <ul className="list-disc space-y-2 pl-5">{value.map((entry, i) => <li key={i}><ExpectedAnswer value={entry}/></li>)}</ul>;
  if (typeof value === "object") return <dl className="space-y-3">{Object.entries(value).map(([key, entry]) => <div key={key}><dt className="mb-1 text-xs font-semibold capitalize">{key.replace(/_/g, " ")}</dt><dd><ExpectedAnswer value={entry}/></dd></div>)}</dl>;
  return null;
}

function ChartResource({ chart }: { chart: ReturnType<typeof getChartData> }) {
  if (!chart) return null;
  if (isBoxPlotQuestion(chart)) return <BoxPlotChart chartData={chart}/>;
  if (isHistogramQuestion(chart)) return <HistogramChart chartData={chart}/>;
  if (isLineChartQuestion(chart)) return <LineChart chartData={chart}/>;
  if (isDataTableQuestion(chart)) return <DataTableChart chartData={chart}/>;
  if (isBarChartQuestion(chart)) return <BarChart chartData={chart}/>;
  if (isPieChartQuestion(chart)) return <PieChart chartData={chart}/>;
  if (isCumulativeFrequencyQuestion(chart)) return <CumulativeFrequencyChart chartData={chart}/>;
  if (isFrequencyPolygonQuestion(chart)) return <FrequencyPolygonChart chartData={chart}/>;
  if (isClimateChartQuestion(chart)) return <ClimateChart chartData={chart}/>;
  return null;
}

function SavedQuestionResources({ question, subject }: { question: ReleasedRevisitQuestion; subject: string }) {
  const mechanics = detectDiagramConfig(question.question_text);
  const circuit = getCircuitConfig(question, subject);
  const config = question.diagram_config;
  const savedPhysics = config && typeof config === "object" && "type" in config && ["ray_diagram", "wave_diagram", "magnetic_field", "nuclear_decay", "electromagnetic_spectrum"].includes(String(config.type));
  const physicsConfig = savedPhysics ? config as ComponentProps<typeof PhysicsFigurePanel>["diagramConfig"] : null;
  return <>
    <ChartResource chart={getChartData(question)}/>
    <AssessmentBiologyFigure question={question} solutionsReleased/>
    {mechanics && <MechanicsFigurePanel config={mechanics}/>}
    {circuit && <CircuitFigurePanel config={circuit}/>}
    <MathsFigurePanel questionText={question.question_text} subject={subject} diagramConfig={null} isReview isSubmitted/>
    <EconomicsFigurePanel questionText={question.question_text} subject={subject} diagramConfig={null} isReview isSubmitted/>
    <PhysicsFigurePanel questionText={question.question_text} subject={subject} diagramConfig={physicsConfig} isReview isSubmitted/>
    {getCorrectChartData(question) && <section className="space-y-2"><h3 className="text-xs font-semibold">Expected chart</h3><ChartResource chart={getCorrectChartData(question)}/></section>}
  </>;
}

class ReviewRenderBoundary extends Component<{ children: ReactNode; destination: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" className="space-y-3 text-sm"><p>This saved question couldn’t be displayed here. Open the full review to see its complete resources and marking feedback.</p><Button asChild variant="outline"><Link to={this.props.destination}>Open full exam review</Link></Button></div> : this.props.children;
  }
}

async function withDeadline<T>(read: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(read), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("This review took too long to load. Please retry.")), 15_000); })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
