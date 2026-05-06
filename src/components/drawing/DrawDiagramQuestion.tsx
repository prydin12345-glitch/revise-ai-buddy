import { useState, useCallback } from 'react';
import { DrawingCanvas } from './DrawingCanvas';
import { DiagramMarkingChecklist } from './DiagramMarkingChecklist';
import { generateMarkingCriteria } from './diagram-marking-criteria';
import { detectDrawQuestion } from './draw-question-detector';
import { detectEconomicsDiagram } from '@/components/economics/economics-detector';
import { EconomicsDiagramDraw } from '@/components/economics/EconomicsDiagramDraw';

export const DRAWING_PREFIX = 'drawing:';

export const isDrawingAnswer = (answer: string | null | undefined): boolean =>
  (answer ?? '').startsWith(DRAWING_PREFIX);

export const getDrawingDataUrl = (answer: string | null | undefined): string =>
  (answer ?? '').startsWith(DRAWING_PREFIX)
    ? (answer ?? '').slice(DRAWING_PREFIX.length)
    : (answer ?? '');

interface Props {
  questionText: string;
  subject?: string;
  questionType?: string;
  totalMarks: number;
  onAnswerChange?: (prefixedDataUrl: string) => void;
  onScoreChange?: (score: number) => void;
  isReview?: boolean;
  isExam?: boolean;
  studentDrawingDataUrl?: string;
}

export { detectDrawQuestion };

export const DrawDiagramQuestion = ({
  questionText,
  subject,
  questionType,
  totalMarks,
  onAnswerChange,
  onScoreChange,
  isReview = false,
  isExam = false,
  studentDrawingDataUrl,
}: Props) => {
  const initial = getDrawingDataUrl(studentDrawingDataUrl);
  const [dataUrl, setDataUrl] = useState(initial);
  const [showMarking, setShowMarking] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const info = detectDrawQuestion(questionText, subject, questionType);
  const economicsConfig = detectEconomicsDiagram(questionText, subject);
  const criteria = generateMarkingCriteria(
    questionText,
    info.diagramCategory ?? 'generic',
    totalMarks,
  );

  const referenceContent = economicsConfig
    ? <EconomicsDiagramDraw config={economicsConfig} />
    : null;

  const handleChange = useCallback((url: string) => {
    setDataUrl(url);
    onAnswerChange?.(`${DRAWING_PREFIX}${url}`);
  }, [onAnswerChange]);

  const handleMarkingComplete = useCallback((s: number) => {
    setScore(s);
    onScoreChange?.(s);
  }, [onScoreChange]);

  if (isReview) {
    return (
      <div style={{ marginTop: 12 }}>
        {dataUrl ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'hsl(var(--foreground))' }}>
              Your diagram:
            </div>
            <img
              src={dataUrl}
              alt="Student diagram"
              style={{
                width: '100%', maxWidth: 520,
                border: '1px solid hsl(var(--border))',
                borderRadius: 8, background: 'white',
              }}
            />
          </>
        ) : (
          <div style={{
            padding: 16, textAlign: 'center',
            color: 'hsl(var(--muted-foreground))',
            fontSize: 12, fontStyle: 'italic',
            border: '1px dashed hsl(var(--border))',
            borderRadius: 8,
          }}>
            No diagram submitted
          </div>
        )}
        {referenceContent && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'hsl(var(--foreground))' }}>
              Correct diagram:
            </div>
            {referenceContent}
          </div>
        )}
        <div style={{
          marginTop: 14,
          padding: 12,
          background: 'hsl(var(--muted)/0.4)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'hsl(var(--foreground))' }}>
            Marking criteria:
          </div>
          {criteria.map(c => (
            <div key={c.id} style={{
              fontSize: 12, color: 'hsl(var(--muted-foreground))',
              padding: '2px 0',
            }}>
              • {c.description} ({c.marks} {c.marks === 1 ? 'mark' : 'marks'})
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <DrawingCanvas
        onDrawingChange={handleChange}
        showAxes={info.diagramCategory === 'economics'}
        axisLabels={info.axisLabels}
      />

      {/* Practice mode: inline self-mark */}
      {!isExam && dataUrl && !showMarking && score === null && (
        <button
          onClick={() => setShowMarking(true)}
          style={{
            width: '100%', marginTop: 10,
            padding: '9px',
            background: 'hsl(var(--primary))',
            border: 'none', borderRadius: 8,
            color: 'hsl(var(--primary-foreground))',
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          Mark my diagram
        </button>
      )}

      {/* Exam mode: show saved confirmation only */}
      {isExam && dataUrl && (
        <div style={{
          marginTop: 8,
          padding: '7px 12px',
          background: 'hsl(142 71% 45% / 0.08)',
          border: '1px solid hsl(142 71% 45% / 0.2)',
          borderRadius: 6,
          fontSize: 12,
          color: 'hsl(142 71% 45%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <circle cx={7} cy={7} r={6} stroke="hsl(142 71% 45%)" strokeWidth={1.5} />
            <path d="M4 7l2 2 4-4" stroke="hsl(142 71% 45%)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Diagram saved — you can continue to the next question
        </div>
      )}

      {!isExam && showMarking && (
        <DiagramMarkingChecklist
          criteria={criteria}
          referenceContent={referenceContent}
          totalMarks={totalMarks}
          onComplete={handleMarkingComplete}
        />
      )}

      {!isExam && score !== null && (
        <div style={{
          marginTop: 10,
          padding: '10px',
          background: score >= totalMarks * 0.7
            ? 'hsl(142 71% 45% / 0.1)'
            : 'hsl(25 95% 53% / 0.1)',
          border: `1px solid ${score >= totalMarks * 0.7
            ? 'hsl(142 71% 45% / 0.3)'
            : 'hsl(25 95% 53% / 0.3)'}`,
          borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          textAlign: 'center',
          color: score >= totalMarks * 0.7
            ? 'hsl(142 71% 45%)'
            : 'hsl(25 95% 53%)',
        }}>
          {score} / {totalMarks} marks
        </div>
      )}
    </div>
  );
};

export default DrawDiagramQuestion;
