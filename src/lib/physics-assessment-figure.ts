import { detectDiagramConfig } from '@/components/mechanics/diagram-detector';
import { detectPhysicsDiagram } from '@/components/physics/physics-detector';
import { detectDrawQuestion } from '@/components/drawing/draw-question-detector';
import { isPhysicsDiagramType, parsePhysicsDiagramConfig, physicsFigureIssues, readPhysicsFigureContract, savedPhysicsDiagram } from '../../supabase/functions/_shared/physics-diagram-contract';
import type { MechanicsConfig } from '@/components/mechanics/types';
import type { PhysicsDiagramConfig } from '@/components/physics/types';
import type { CircuitConfig } from '@/components/circuit/types';
import { usesPhysicsGenerationContract } from '../../supabase/functions/_shared/physics-generation-policy';

export interface PhysicsFigureQuestion {
  question_text?: unknown;
  questionText?: unknown;
  question_type?: string;
  diagram_config?: unknown;
  diagramConfig?: unknown;
  chart_data?: unknown;
  figure_urls?: unknown;
  subject?: string;
}

export const physicsDiagramTypes = ['ray_diagram', 'wave_diagram', 'magnetic_field', 'nuclear_decay', 'electromagnetic_spectrum'];
export type AssessmentPhysicsConfig = MechanicsConfig | PhysicsDiagramConfig | CircuitConfig;
export type ResolvedPhysicsFigure =
  | { status: 'ready'; config: AssessmentPhysicsConfig; source: 'saved' | 'legacy' }
  | { status: 'missing' }
  | { status: 'none' };

export function rawPhysicsFigure(question: PhysicsFigureQuestion): unknown {
  const raw = question.diagram_config ?? question.diagramConfig;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

/** A versioned question must never silently return to inference from its prose. */
export function hasPhysicsFigureContract(question: PhysicsFigureQuestion): boolean {
  const raw = rawPhysicsFigure(question);
  return !!raw && typeof raw === 'object' && ('physics_figure_version' in raw || 'diagram_intent' in raw);
}

export function resolveAssessmentPhysicsFigure(question: PhysicsFigureQuestion, subject?: string, generationContext?: unknown): ResolvedPhysicsFigure {
  const raw = rawPhysicsFigure(question);
  const versioned = hasPhysicsFigureContract(question);
  const contract = readPhysicsFigureContract(raw);
  if (usesPhysicsGenerationContract(generationContext) && !versioned) return { status: 'missing' };
  if (versioned) {
    if (!contract || physicsFigureIssues({ ...question, question_text: question.question_text ?? question.questionText }).length) return { status: 'missing' };
    if (contract.intent !== 'setup') return { status: 'none' };
  }
  if (raw !== null && raw !== undefined) {
    const type = raw && typeof raw === 'object' && 'type' in raw ? raw.type : undefined;
    if (type === 'circuit' && !versioned) return { status: 'none' };
    // Charts, circuits and other subjects retain their own resource renderer.
    if (!isPhysicsDiagramType(type)) return versioned ? { status: 'missing' } : { status: 'none' };
    const parsed = parsePhysicsDiagramConfig(raw);
    return parsed.success && savedPhysicsDiagram(question)
      ? { status: 'ready', config: parsed.config as AssessmentPhysicsConfig, source: 'saved' }
      : { status: 'missing' };
  }
  if (question.chart_data || (Array.isArray(question.figure_urls) && question.figure_urls.length)) return { status: 'none' };
  const text = typeof question.question_text === 'string' ? question.question_text : typeof question.questionText === 'string' ? question.questionText : '';
  const effectiveSubject = subject ?? question.subject;
  if (effectiveSubject && /biology|chemistry|economics/i.test(effectiveSubject)) return { status: 'none' };
  if (detectDrawQuestion(text, effectiveSubject, question.question_type).needsDrawingCanvas) return { status: 'none' };
  const legacy = detectDiagramConfig(text) ?? detectPhysicsDiagram(text, effectiveSubject);
  return legacy ? { status: 'ready', config: legacy, source: 'legacy' } : { status: 'none' };
}

/** Saved structured figures replace old image resources for the same question. */
export function usesSavedPhysicsFigure(question: PhysicsFigureQuestion, generationContext?: unknown): boolean {
  return hasPhysicsFigureContract(question) || usesPhysicsGenerationContract(generationContext) || resolveAssessmentPhysicsFigure(question).status === 'ready' && !!rawPhysicsFigure(question);
}
