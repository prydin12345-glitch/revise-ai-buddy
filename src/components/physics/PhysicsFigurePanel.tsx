import { useState } from 'react';
import { Atom, Maximize2, X } from 'lucide-react';
import { PhysicsDiagramDraw } from './PhysicsDiagramDraw';
import { detectPhysicsDiagram, isPhysicsAnswerDiagram } from './physics-detector';
import { detectDrawQuestion } from '@/components/drawing/draw-question-detector';
import type { PhysicsDiagramConfig } from './types';

interface Props {
  questionText: string;
  subject?: string;
  diagramConfig?: PhysicsDiagramConfig | null;
  isSubmitted?: boolean;
  isReview?: boolean;
  isExam?: boolean;
  isPracticeQuiz?: boolean;
}

const typeLabel: Record<string, string> = {
  ray_diagram: 'Ray Diagram',
  wave_diagram: 'Wave Diagram',
  magnetic_field: 'Magnetic Field Diagram',
  nuclear_decay: 'Nuclear Decay Diagram',
  electromagnetic_spectrum: 'Electromagnetic Spectrum',
};

export const PhysicsFigurePanel = ({
  questionText,
  subject,
  diagramConfig,
  isSubmitted = false,
  isReview = false,
  isExam = false,
  isPracticeQuiz = false,
}: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);

  if (isExam) return null;

  // Defer to drawing canvas when applicable
  const drawInfo = detectDrawQuestion(questionText, subject);
  if (drawInfo.needsDrawingCanvas) return null;

  const config = diagramConfig ?? detectPhysicsDiagram(questionText, subject);
  if (!config) return null;

  // Question-aid diagrams are always visible. Answer diagrams stay hidden
  // until the student submits (and reveals) or is in review mode.
  const isAnswer = isPhysicsAnswerDiagram(questionText, config);

  const shouldShow = isAnswer
    ? (isReview
        ? true
        : isPracticeQuiz
          ? (isSubmitted && revealed)
          : true)
    : true;

  const showRevealButton = isAnswer && isPracticeQuiz && isSubmitted && !isReview && !revealed;
  const showHideButton = isAnswer && !isReview && revealed;

  const label = typeLabel[config.type] ?? 'Physics Diagram';

  return (
    <>
      <div style={{
        margin: '12px 0',
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 14px',
          background: 'hsl(221 83% 53% / 0.08)',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600,
            color: 'hsl(221 83% 53%)',
          }}>
            <Atom size={13} />
            {label}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {showRevealButton && (
              <button onClick={() => setRevealed(true)}
                style={{
                  fontSize: 11, padding: '3px 10px',
                  background: 'hsl(221 83% 53% / 0.12)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 5, cursor: 'pointer',
                  color: 'hsl(var(--foreground))',
                  fontFamily: 'inherit', fontWeight: 600,
                }}>
                Show answer
              </button>
            )}
            {showHideButton && (
              <button onClick={() => setRevealed(false)}
                style={{
                  fontSize: 11, padding: '3px 10px',
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 5, cursor: 'pointer',
                  color: 'hsl(var(--foreground))',
                  fontFamily: 'inherit',
                }}>
                Hide answer
              </button>
            )}
            {shouldShow && (
              <button onClick={() => setExpanded(true)}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', padding: 3,
                  color: 'hsl(var(--muted-foreground))',
                }}
                aria-label="Enlarge diagram">
                <Maximize2 size={13} />
              </button>
            )}
          </div>
        </div>

        {shouldShow ? (
          <div style={{ padding: '12px 8px', maxWidth: 820, margin: '0 auto' }}>
            <PhysicsDiagramDraw config={config} />
          </div>
        ) : isPracticeQuiz && !isSubmitted ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            color: 'hsl(var(--muted-foreground))',
            fontSize: 12, fontStyle: 'italic',
          }}>
            Submit your answer to reveal the correct diagram
          </div>
        ) : isPracticeQuiz && isSubmitted && !revealed ? (
          <div style={{
            padding: '20px', textAlign: 'center',
            color: 'hsl(var(--muted-foreground))',
            fontSize: 12, fontStyle: 'italic',
          }}>
            Click Show answer to see the correct diagram
          </div>
        ) : null}
      </div>

      {expanded && shouldShow && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 24,
          }}
          onClick={() => setExpanded(false)}>
          <div
            style={{
              background: 'hsl(var(--card))',
              borderRadius: 14, padding: 24,
              width: '100%', maxWidth: 900,
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setExpanded(false)}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none',
                cursor: 'pointer',
                color: 'hsl(var(--muted-foreground))',
              }}
              aria-label="Close">
              <X size={18} />
            </button>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: 'hsl(221 83% 53%)',
              marginBottom: 16,
            }}>
              {label}
            </div>
            <PhysicsDiagramDraw config={config} />
          </div>
        </div>
      )}
    </>
  );
};

export default PhysicsFigurePanel;
