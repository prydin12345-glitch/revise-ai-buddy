import BiologyFigurePanel from './BiologyFigurePanel';
import type { BiologyDiagramConfig } from './types';
import { isBiologyDiagram, savedBiologyDiagram } from '@/lib/biology-assessment-resources';

interface Props {
  question: {question_text?: unknown; diagram_config?: unknown; diagramConfig?: unknown};
  /** Set only after the page has received released solutions from the server. */
  solutionsReleased?: boolean;
}

export function AssessmentBiologyFigure({question, solutionsReleased = false}: Props) {
  const config = savedBiologyDiagram(question);
  if (!config) return [question.diagram_config, question.diagramConfig].some(isBiologyDiagram)
    ? <p role="alert" className="my-3 text-sm text-destructive">The saved figure is inconsistent with this question. Please report this question.</p>
    : null;
  return <BiologyFigurePanel config={config as BiologyDiagramConfig} isExam={!solutionsReleased}
    mode={solutionsReleased ? 'solution' : 'assessment'} />;
}
