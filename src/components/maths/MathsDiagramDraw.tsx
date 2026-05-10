import { ProbabilityTreeDiagram } from './diagrams/ProbabilityTreeDiagram';
import { VennTwoDiagram, VennThreeDiagram } from './diagrams/VennDiagram';
import { TwoWayTableDiagram } from './diagrams/TwoWayTableDiagram';
import { SampleSpaceDiagram } from './diagrams/SampleSpaceDiagram';
import { PunnettSquareDiagram } from '@/components/biology/diagrams/PunnettSquareDiagram';
import type { MathsDiagramConfig } from './types';

interface Props {
  config: MathsDiagramConfig;
  isPracticeQuiz?: boolean;
  isSubmitted?: boolean;
  /** True once the student has chosen to reveal the worked answer. */
  isAnswerRevealed?: boolean;
}

export const MathsDiagramDraw = ({
  config,
  isPracticeQuiz = false,
  isSubmitted = false,
  isAnswerRevealed = false,
}: Props) => {
  switch (config.type) {
    case 'probability_tree':
      return <ProbabilityTreeDiagram config={config} />;
    case 'venn_two':
      return <VennTwoDiagram config={config} />;
    case 'venn_three':
      return <VennThreeDiagram config={config} />;
    case 'two_way_table':
      return (
        <TwoWayTableDiagram
          config={config}
          isPracticeQuiz={isPracticeQuiz}
          isSubmitted={isSubmitted}
          isAnswerRevealed={isAnswerRevealed}
        />
      );
    case 'sample_space':
      return <SampleSpaceDiagram config={config} />;
    case 'punnett_maths':
      return (
        <PunnettSquareDiagram
          config={{
            type: 'punnett_square',
            crossType: 'monohybrid',
            parent1: config.parent1,
            parent2: config.parent2,
            dominantTrait: 'A',
            recessiveTrait: 'a',
          }}
        />
      );
    default:
      if (typeof window !== 'undefined' && (import.meta as any)?.env?.DEV) {
        console.warn(`MathsDiagramDraw: no renderer for type "${(config as any).type}"`);
      }
      return null;
  }
};

export default MathsDiagramDraw;
