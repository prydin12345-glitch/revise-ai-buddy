import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DiagramMarkingChecklist } from './DiagramMarkingChecklist';
import { generateMarkingCriteria } from './diagram-marking-criteria';
import { detectDrawQuestion } from './draw-question-detector';
import { getDrawingDataUrl } from './DrawDiagramQuestion';
import { detectEconomicsDiagram } from '@/components/economics/economics-detector';
import { EconomicsDiagramDraw } from '@/components/economics/EconomicsDiagramDraw';

export interface DrawQuestionForReview {
  id: string;
  questionText: string;
  subject?: string;
  questionType?: string;
  marks: number;
  studentDrawingDataUrl: string;
}

interface Props {
  questions: DrawQuestionForReview[];
  onComplete: (scores: Record<string, number>) => void;
  onDismiss?: () => void;
}

export const SelfMarkReviewModal = ({ questions, onComplete, onDismiss }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});

  const current = questions[currentIndex];
  if (!current) return null;

  const totalQuestions = questions.length;
  const completedCount = Object.keys(scores).length;
  const allComplete = completedCount === totalQuestions;

  const economicsConfig = detectEconomicsDiagram(current.questionText, current.subject);
  const referenceContent = economicsConfig
    ? <EconomicsDiagramDraw config={economicsConfig} />
    : null;

  const criteria = generateMarkingCriteria(
    current.questionText,
    detectDrawQuestion(current.questionText, current.subject, current.questionType).diagramCategory ?? 'generic',
    current.marks,
  );

  const raw = current.studentDrawingDataUrl ?? '';
  const drawingUrl = raw.startsWith('drawing:')
    ? raw.slice('drawing:'.length)
    : raw.startsWith('data:')
      ? raw
      : '';

  const handleScore = (s: number) => {
    setScores(prev => ({ ...prev, [current.id]: s }));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'hsl(var(--background))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 12,
        width: '100%',
        maxWidth: 1100,
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
              Self-mark your diagram questions
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
              Compare your diagrams with the correct answers and award yourself marks honestly.
              {totalQuestions > 1 && ` ${completedCount} of ${totalQuestions} marked.`}
            </div>
          </div>
          {totalQuestions > 1 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => setCurrentIndex(i)}
                  style={{
                    width: scores[q.id] !== undefined ? 12 : 8,
                    height: scores[q.id] !== undefined ? 12 : 8,
                    borderRadius: '50%',
                    background: i === currentIndex
                      ? 'hsl(var(--primary))'
                      : scores[q.id] !== undefined
                        ? 'hsl(142 71% 45%)'
                        : 'hsl(var(--muted))',
                    border: 'none', cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
          )}
          {onDismiss && (
            <button onClick={onDismiss} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))', padding: 4,
            }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{
            fontSize: 14, color: 'hsl(var(--foreground))', marginBottom: 14,
            padding: 12, background: 'hsl(var(--muted)/0.3)', borderRadius: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>
              Question {currentIndex + 1} of {totalQuestions}
            </div>
            {current.questionText}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: referenceContent ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
            gap: 16, marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'hsl(var(--foreground))' }}>
                Your diagram
              </div>
              {drawingUrl ? (
                <img src={drawingUrl} alt="Your diagram" style={{
                  width: '100%', border: '1px solid hsl(var(--border))',
                  borderRadius: 8, background: 'white',
                }} />
              ) : (
                <div style={{
                  padding: 24, textAlign: 'center',
                  color: 'hsl(var(--muted-foreground))', fontSize: 12, fontStyle: 'italic',
                  border: '1px dashed hsl(var(--border))', borderRadius: 8,
                }}>
                  No diagram submitted
                </div>
              )}
            </div>
            {referenceContent && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'hsl(var(--foreground))' }}>
                  Correct diagram
                </div>
                <div style={{
                  padding: 8, background: 'white',
                  border: '1px solid hsl(var(--border))', borderRadius: 8,
                }}>
                  {referenceContent}
                </div>
              </div>
            )}
          </div>

          <DiagramMarkingChecklist
            key={current.id}
            criteria={criteria}
            referenceContent={null}
            totalMarks={current.marks}
            onComplete={handleScore}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid hsl(var(--border))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 14px', borderRadius: 6,
              background: 'transparent', border: '1px solid hsl(var(--border))',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === 0 ? 0.4 : 1,
              color: 'hsl(var(--foreground))', fontSize: 13,
            }}>
            <ChevronLeft size={14} /> Previous
          </button>

          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
            {allComplete ? (
              <span style={{ color: 'hsl(142 71% 45%)', fontWeight: 600 }}>
                All diagrams marked — {Object.values(scores).reduce((a, b) => a + b, 0)}/
                {questions.reduce((a, q) => a + q.marks, 0)} marks
              </span>
            ) : `${completedCount} of ${totalQuestions} marked`}
          </div>

          {currentIndex < totalQuestions - 1 ? (
            <button
              onClick={() => setCurrentIndex(i => i + 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 6,
                background: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => allComplete && onComplete(scores)}
              disabled={!allComplete}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 6,
                background: allComplete ? 'hsl(142 71% 45%)' : 'hsl(var(--muted))',
                color: allComplete ? 'white' : 'hsl(var(--muted-foreground))',
                border: 'none', cursor: allComplete ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 600,
              }}>
              <CheckCircle2 size={14} />
              {allComplete ? 'See my results' : 'Mark all diagrams first'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelfMarkReviewModal;
