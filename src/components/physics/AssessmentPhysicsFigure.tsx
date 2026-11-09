import MechanicsDraw from '@/components/mechanics/MechanicsDraw';
import MechanicsFigurePanel from '@/components/mechanics/MechanicsFigurePanel';
import type { MechanicsConfig } from '@/components/mechanics/types';
import { PhysicsDiagramDraw } from './PhysicsDiagramDraw';
import { PhysicsFigurePanel } from './PhysicsFigurePanel';
import type { PhysicsDiagramConfig } from './types';
import { CircuitDraw } from '@/components/circuit';
import type { CircuitConfig } from '@/components/circuit/types';
import { physicsDiagramTypes, resolveAssessmentPhysicsFigure, type AssessmentPhysicsConfig, type PhysicsFigureQuestion } from '@/lib/physics-assessment-figure';

export function StructuredPhysicsDraw({ config }: { config: AssessmentPhysicsConfig }) {
  if (config.type === 'circuit') return <CircuitDraw config={config as CircuitConfig} />;
  return physicsDiagramTypes.includes(config.type)
    ? <PhysicsDiagramDraw config={config as PhysicsDiagramConfig} mode="assessment" />
    : <MechanicsDraw config={config as MechanicsConfig} />;
}

/** All assessment surfaces share the saved setup and the same legacy boundary. */
export function AssessmentPhysicsFigure({ question, subject, generationContext, isExam = false, isReview = false, isSubmitted = false, isPracticeQuiz = false }: {
  question: PhysicsFigureQuestion;
  subject?: string;
  generationContext?: unknown;
  isExam?: boolean;
  isReview?: boolean;
  isSubmitted?: boolean;
  isPracticeQuiz?: boolean;
}) {
  const figure = resolveAssessmentPhysicsFigure(question, subject, generationContext);
  if (figure.status === 'none') return null;
  if (figure.status === 'missing') return <p role="alert" className="my-3 text-sm text-destructive">The saved Physics figure is unavailable. Please report this question.</p>;
  if (figure.source === 'legacy') {
    if (physicsDiagramTypes.includes(figure.config.type)) return <PhysicsFigurePanel questionText={String(question.question_text ?? question.questionText ?? '')}
      subject={subject ?? question.subject} diagramConfig={figure.config as PhysicsDiagramConfig} isExam={isExam} isReview={isReview} isSubmitted={isSubmitted} isPracticeQuiz={isPracticeQuiz} />;
    return <MechanicsFigurePanel config={figure.config as MechanicsConfig} isExam={isExam} />;
  }
  return <figure className="my-4 w-full overflow-hidden rounded-lg border bg-white p-3 text-slate-900 [--foreground:222_47%_11%] [--muted-foreground:215_16%_35%] [--background:0_0%_100%] [--border:215_20%_65%] [--primary:221_83%_40%]" aria-label="Saved Physics setup figure" data-physics-figure="saved">
    <StructuredPhysicsDraw config={figure.config} />
    <figcaption className="mt-2 text-center text-xs text-slate-600">Figure — not to scale</figcaption>
  </figure>;
}
