import { detectCircuitConfig } from './circuit-detector';
import type { CircuitConfig } from './types';
import { needsCircuitTopology } from '../../../supabase/functions/_shared/physics-resource-validation';
import { hasPhysicsFigureContract } from '@/lib/physics-assessment-figure';
import { usesPhysicsGenerationContract } from '../../../supabase/functions/_shared/physics-generation-policy';

/**
 * Resolves circuit config for a question.
 * Priority 1: Use AI-generated diagram_config saved in database.
 * Priority 2: Fall back to client-side text detection.
 */
export function getCircuitConfig(
  question: {
    question_text?: string;
    questionText?: string;
    diagram_config?: any;
    diagramConfig?: any;
    chart_data?: any;
    topic_tag?: string;
    subject_id?: string;
    subject?: string;
  },
  subjectId?: string,
  generationContext?: unknown,
): CircuitConfig | null {
  const effectiveSubject =
    subjectId ?? question.subject ?? question.subject_id ?? '';

  // Biology hard-guard: never render circuit for biology, even from saved config
  const subjLower = effectiveSubject.toLowerCase();
  const isBiologySubject =
    /biology|life.?science|human.?biology|biolog|anatomy|physiology|biomedical|health.?science|environmental.?science|marine.?biology|ecology|genetics|microbiology/i.test(
      subjLower,
    );
  if (isBiologySubject) return null;
  // The shared Physics component owns versioned resources, including circuits.
  if (hasPhysicsFigureContract(question) || usesPhysicsGenerationContract(generationContext)) return null;

  const text = question.question_text || question.questionText || '';
  // A saved or inferred capacitor picture must not be injected into a graph,
  // induction or concept-only question simply because it mentions electricity.
  if (!needsCircuitTopology(text)) return null;

  // Priority 1 — saved AI-generated config
  if (question.diagram_config ?? question.diagramConfig) {
    try {
      const saved = typeof (question.diagram_config ?? question.diagramConfig) === 'string'
        ? JSON.parse(question.diagram_config ?? question.diagramConfig)
        : question.diagram_config ?? question.diagramConfig;

      if (saved?.type === 'circuit' && saved?.nodes?.length > 0 && saved?.wires?.length > 0) {
        return saved as CircuitConfig;
      }
    } catch (e) {
      console.warn('Failed to parse saved diagram_config:', e);
    }
  }

  // Priority 2 — client-side text detection
  // An existing chart/table is the supplied figure; do not invent another.
  if (question.chart_data || question.diagram_config || question.diagramConfig) return null;
  return detectCircuitConfig(text, question.topic_tag, effectiveSubject);
}
