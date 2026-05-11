import { useState } from 'react';
import { Sigma, Maximize2, X } from 'lucide-react';
import { MathsDiagramDraw } from './MathsDiagramDraw';
import { detectMathsDiagram } from './maths-detector';
import { detectDrawQuestion } from '@/components/drawing/draw-question-detector';
import type { MathsDiagramConfig } from './types';

interface Props {
  questionText: string;
  subject?: string;
  diagramConfig?: MathsDiagramConfig | null;
  isSubmitted?: boolean;
  isReview?: boolean;
  isExam?: boolean;
  isPracticeQuiz?: boolean;
}

const typeLabel: Record<string, string> = {
  probability_tree: 'Probability Tree Diagram',
  venn_two: 'Venn Diagram',
  venn_three: 'Venn Diagram (3 sets)',
  two_way_table: 'Two-Way Frequency Table',
  sample_space: 'Sample Space Diagram',
  punnett_maths: 'Probability Square',
};

export const MathsFigurePanel = ({
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

  // Suppress when the drawing canvas owns the question (matches
  // EconomicsFigurePanel behaviour).
  const drawInfo = detectDrawQuestion(questionText, subject);
  if (drawInfo.needsDrawingCanvas) return null;

  const config = diagramConfig ?? detectMathsDiagram(questionText, subject);
  if (!config) return null;

  // Reveal contract:
  //   - review:   always show
  //   - exam:     handled by isExam early return above
  //   - practice: hidden until submit; after submit show "Show answer"
  //               button which toggles reveal
  //   - other:    show by default (preview / non-quiz contexts)
  const shouldShow = isReview
    ? true
    : isPracticeQuiz
      ? (isSubmitted && revealed)
      : (isSubmitted || revealed || true);

  // Show reveal button only in practice quiz, post-submit, when not yet revealed.
  const showRevealButton =
    isPracticeQuiz && isSubmitted && !isReview && !revealed;
  // Show hide button when revealed (only outside review).
  const showHideButton = !isReview && revealed;

  const label = typeLabel[config.type] ?? 'Maths Diagram';

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
            <Sigma size={13} />
            {label}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {showRevealButton && (
              <button
                onClick={() => setRevealed(true)}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  background: 'hsl(221 83% 53% / 0.12)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 5,
                  cursor: 'pointer',
                  color: 'hsl(var(--foreground))',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                }}
              >
                Show answer
              </button>
            )}
            {showHideButton && (
              <button
                onClick={() => setRevealed(false)}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 5,
                  cursor: 'pointer',
                  color: 'hsl(var(--foreground))',
                  fontFamily: 'inherit',
                }}
              >
                Hide answer
              </button>
            )}
            {shouldShow && (
              <button
                onClick={() => setExpanded(true)}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', padding: 3,
                  color: 'hsl(var(--muted-foreground))',
                }}
                aria-label="Enlarge diagram"
              >
                <Maximize2 size={13} />
              </button>
            )}
          </div>
        </div>

        {shouldShow ? (
          <div style={{ padding: '12px 8px', maxWidth: 820, margin: '0 auto' }}>
            <MathsDiagramDraw
              config={config}
              isPracticeQuiz={isPracticeQuiz}
              isSubmitted={isSubmitted}
              isAnswerRevealed={shouldShow}
            />
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
          onClick={() => setExpanded(false)}
        >
          <div
            style={{
              background: 'hsl(var(--card))',
              borderRadius: 14, padding: 24,
              width: '100%', maxWidth: 900,
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setExpanded(false)}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none',
                cursor: 'pointer',
                color: 'hsl(var(--muted-foreground))',
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: 'hsl(221 83% 53%)',
              marginBottom: 16,
            }}>
              {label}
            </div>
            <MathsDiagramDraw
              config={config}
              isPracticeQuiz={isPracticeQuiz}
              isSubmitted={isSubmitted}
              isAnswerRevealed={shouldShow}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MathsFigurePanel;
