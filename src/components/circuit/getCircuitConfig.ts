import { detectCircuitConfig } from './circuit-detector';
import type { CircuitConfig } from './types';

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
    topic_tag?: string;
    subject_id?: string;
    subject?: string;
  },
  subjectId?: string,
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

  // Priority 1 — saved AI-generated config
  if (question.diagram_config) {
    try {
      const saved = typeof question.diagram_config === 'string'
        ? JSON.parse(question.diagram_config)
        : question.diagram_config;

      if (saved?.type === 'circuit' && saved?.nodes?.length > 0 && saved?.wires?.length > 0) {
        return saved as CircuitConfig;
      }
    } catch (e) {
      console.warn('Failed to parse saved diagram_config:', e);
    }
  }

  // Priority 2 — client-side text detection
  const text = question.question_text || question.questionText || '';
  return detectCircuitConfig(text, question.topic_tag, effectiveSubject);
}
