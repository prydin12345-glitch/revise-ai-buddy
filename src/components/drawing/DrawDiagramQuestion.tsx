import { useState, useCallback, useEffect, useRef } from 'react';
import { DrawingCanvas } from './DrawingCanvas';
import type { DrawnElement } from './DrawingCanvas';
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
  onSave?: (prefixedDataUrl: string) => void;
  onSaveWithElements?: (prefixedDataUrl: string, elements: DrawnElement[]) => void;
  onAnswerChange?: (prefixedDataUrl: string) => void;
  onScoreChange?: (score: number) => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  isReview?: boolean;
  isExam?: boolean;
  /** Previously-saved drawing (may include or omit the "drawing:" prefix) */
  savedDrawingDataUrl?: string;
  /** Backward-compat alias */
  studentDrawingDataUrl?: string;
  /** Previously-saved drawn elements — restores canvas exactly across navigation */
  initialElements?: DrawnElement[];
}

export { detectDrawQuestion };

export const DrawDiagramQuestion = ({
  questionText,
  subject,
  questionType,
  totalMarks,
  onSave,
  onSaveWithElements,
  onAnswerChange,
  onScoreChange,
  onUnsavedChanges,
  isReview = false,
  isExam = false,
  savedDrawingDataUrl,
  studentDrawingDataUrl,
  initialElements,
}: Props) => {
  const incomingRaw = savedDrawingDataUrl ?? studentDrawingDataUrl ?? '';
  const cleanSavedUrl = incomingRaw.startsWith(DRAWING_PREFIX)
    ? incomingRaw.slice(DRAWING_PREFIX.length)
    : incomingRaw;

  const [savedDataUrl, setSavedDataUrl] = useState(cleanSavedUrl);
  const [workingDataUrl, setWorkingDataUrl] = useState(cleanSavedUrl);
  const [isEditing, setIsEditing] = useState(!cleanSavedUrl);
  const [showMarking, setShowMarking] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [savedElements, setSavedElements] = useState<DrawnElement[]>(initialElements ?? []);
  const [workingElements, setWorkingElements] = useState<DrawnElement[]>(initialElements ?? []);

  // Suppress the first onDrawingChange after the canvas mounts/remounts —
  // the freshly re-encoded SVG is byte-different from savedDataUrl even when
  // nothing has actually been drawn, which would otherwise flag spurious
  // "unsaved changes".
  const isInitialMountRef = useRef(true);

  // Sync if parent provides a new saved URL (e.g., navigating back to question)
  useEffect(() => {
    setSavedDataUrl(cleanSavedUrl);
    setWorkingDataUrl(cleanSavedUrl);
    setIsEditing(!cleanSavedUrl);
    isInitialMountRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanSavedUrl]);

  const hasUnsavedChanges =
    workingDataUrl !== savedDataUrl && workingDataUrl !== '';

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

  const handleDrawingChange = useCallback((url: string) => {
    // Ignore the first emission after (re)mounting the canvas — it's just
    // the canvas re-encoding the existing saved drawing, not a real edit.
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      setWorkingDataUrl(url);
      return;
    }
    setWorkingDataUrl(url);
    const hasChanges = url !== savedDataUrl && url !== '';
    onUnsavedChanges?.(hasChanges);
  }, [savedDataUrl, onUnsavedChanges]);

  const handleElementsChange = useCallback((els: DrawnElement[]) => {
    setWorkingElements(els);
  }, []);

  const handleSave = useCallback(() => {
    if (!workingDataUrl) return;
    const prefixed = `${DRAWING_PREFIX}${workingDataUrl}`;
    isInitialMountRef.current = true;
    setSavedDataUrl(workingDataUrl);
    setSavedElements(workingElements);
    setIsEditing(false);
    onUnsavedChanges?.(false);
    onSave?.(prefixed);
    onSaveWithElements?.(prefixed, workingElements);
    onAnswerChange?.(prefixed);
  }, [workingDataUrl, workingElements, onSave, onSaveWithElements, onAnswerChange, onUnsavedChanges]);

  const handleEdit = useCallback(() => {
    isInitialMountRef.current = true;
    setWorkingElements(savedElements);
    setIsEditing(true);
    setShowMarking(false);
    setScore(null);
  }, [savedElements]);

  // ── Review mode ────────────────────────────────────────────────────────
  if (isReview) {
    const drawingUrl = cleanSavedUrl;
    return (
      <div style={{ marginTop: 12 }}>
        {drawingUrl ? (
          <div style={{
            border: '1px solid hsl(var(--border))',
            borderRadius: 8, overflow: 'hidden', marginBottom: 10,
          }}>
            <div style={{
              padding: '6px 12px',
              background: 'hsl(var(--muted)/0.3)',
              borderBottom: '1px solid hsl(var(--border))',
              fontSize: 11, fontWeight: 700,
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>Your diagram</div>
            <div style={{ padding: 8, background: 'white' }}>
              <img src={drawingUrl} alt="Your diagram"
                style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          </div>
        ) : (
          <div style={{
            padding: 14,
            border: '1px dashed hsl(var(--border))',
            borderRadius: 8,
            color: 'hsl(var(--muted-foreground))',
            fontSize: 12, fontStyle: 'italic', marginBottom: 10,
            textAlign: 'center',
          }}>
            No diagram submitted for this question
          </div>
        )}
        {referenceContent && (
          <div style={{
            border: '1px solid hsl(var(--border))',
            borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              padding: '6px 12px',
              background: 'hsl(142 71% 45% / 0.06)',
              borderBottom: '1px solid hsl(var(--border))',
              fontSize: 11, fontWeight: 700,
              color: 'hsl(142 71% 45%)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>Correct diagram</div>
            <div style={{ padding: 8 }}>{referenceContent}</div>
          </div>
        )}
        <div style={{
          marginTop: 10, padding: '10px 14px',
          background: 'hsl(var(--muted)/0.3)', borderRadius: 8,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 600, marginBottom: 6,
            color: 'hsl(var(--foreground))',
          }}>Marking criteria:</div>
          {criteria.map(c => (
            <div key={c.id} style={{
              fontSize: 12,
              color: 'hsl(var(--muted-foreground))',
              marginBottom: 3, paddingLeft: 8,
            }}>
              • {c.description} ({c.marks} {c.marks === 1 ? 'mark' : 'marks'})
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div style={{ marginTop: 12 }}>
        <DrawingCanvas
          onDrawingChange={handleDrawingChange}
          showAxes={info.diagramCategory === 'economics'}
          axisLabels={info.axisLabels}
        />

        <div style={{
          marginTop: 10, display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <button
            onClick={handleSave}
            disabled={!workingDataUrl}
            style={{
              flex: 1, padding: '10px 16px',
              background: workingDataUrl ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              border: 'none', borderRadius: 8,
              color: workingDataUrl ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              fontSize: 13, fontWeight: 600,
              cursor: workingDataUrl ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <path d="M11 12H3a1 1 0 01-1-1V3a1 1 0 011-1h7l2 2v7a1 1 0 01-1 1z"
                stroke="currentColor" strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 12V8.5h-5V12M4.5 2v3h4"
                stroke="currentColor" strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {savedDataUrl ? 'Save changes' : 'Save diagram'}
          </button>

          {savedDataUrl && (
            <button
              onClick={() => {
                setWorkingDataUrl(savedDataUrl);
                setIsEditing(false);
                onUnsavedChanges?.(false);
              }}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                color: 'hsl(var(--muted-foreground))',
                fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              Discard changes
            </button>
          )}
        </div>

        {!workingDataUrl && (
          <div style={{
            marginTop: 8, fontSize: 11,
            color: 'hsl(var(--muted-foreground))',
            textAlign: 'center', fontStyle: 'italic',
          }}>
            Draw your diagram above then click Save diagram
          </div>
        )}
      </div>
    );
  }

  // ── Saved state ────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        border: '2px solid hsl(142 71% 45% / 0.3)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 10,
      }}>
        <div style={{
          padding: '8px 14px',
          background: 'hsl(142 71% 45% / 0.08)',
          borderBottom: '1px solid hsl(142 71% 45% / 0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600,
            color: 'hsl(142 71% 45%)',
          }}>
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <circle cx={7} cy={7} r={6}
                stroke="hsl(142 71% 45%)" strokeWidth={1.5} />
              <path d="M4 7l2 2 4-4"
                stroke="hsl(142 71% 45%)" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Diagram saved
          </div>
          <button
            onClick={handleEdit}
            style={{
              padding: '4px 12px',
              background: 'transparent',
              border: '1px solid hsl(var(--border))',
              borderRadius: 5, fontSize: 11,
              color: 'hsl(var(--foreground))',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width={11} height={11} viewBox="0 0 11 11" fill="none">
              <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z"
                stroke="currentColor" strokeWidth={1.3}
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit diagram
          </button>
        </div>
        <div style={{ padding: 10, background: 'white' }}>
          <img
            src={savedDataUrl}
            alt="Saved diagram"
            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4 }}
          />
        </div>
      </div>

      {!isExam && !showMarking && score === null && (
        <button
          onClick={() => setShowMarking(true)}
          style={{
            width: '100%', padding: '9px',
            background: 'hsl(var(--primary))',
            border: 'none', borderRadius: 8,
            color: 'hsl(var(--primary-foreground))',
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Mark my diagram
        </button>
      )}

      {!isExam && showMarking && (
        <DiagramMarkingChecklist
          criteria={criteria}
          referenceContent={referenceContent}
          totalMarks={totalMarks}
          onComplete={(s) => {
            setScore(s);
            onScoreChange?.(s);
          }}
        />
      )}

      {!isExam && score !== null && (
        <div style={{
          marginTop: 10, padding: '9px 14px',
          background: score >= totalMarks * 0.7
            ? 'hsl(142 71% 45% / 0.1)'
            : 'hsl(25 95% 53% / 0.1)',
          border: `1px solid ${score >= totalMarks * 0.7
            ? 'hsl(142 71% 45% / 0.3)'
            : 'hsl(25 95% 53% / 0.3)'}`,
          borderRadius: 8, fontSize: 13, fontWeight: 600,
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
