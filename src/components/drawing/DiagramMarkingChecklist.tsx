import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';

export interface MarkingCriterion {
  id: string;
  description: string;
  marks: number;
  hint?: string;
}

interface Props {
  criteria: MarkingCriterion[];
  referenceContent?: React.ReactNode;
  totalMarks: number;
  onComplete: (score: number) => void;
}

export const DiagramMarkingChecklist = ({
  criteria,
  referenceContent,
  totalMarks,
  onComplete,
}: Props) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showRef, setShowRef] = useState(true);

  const score = criteria.reduce(
    (s, c) => s + (checked[c.id] ? c.marks : 0), 0
  );

  const toggle = (id: string) => {
    if (submitted) return;
    setChecked(p => ({ ...p, [id]: !p[id] }));
  };

  const submit = () => {
    setSubmitted(true);
    onComplete(score);
  };

  const pct = totalMarks > 0 ? score / totalMarks : 0;

  return (
    <div style={{
      marginTop: 12,
      border: '1px solid hsl(var(--border))',
      borderRadius: 10,
      background: 'hsl(var(--card))',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        background: 'hsl(var(--muted)/0.4)',
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          Mark your diagram
        </div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
          {score} / {totalMarks} marks
        </div>
      </div>

      {referenceContent && (
        <div style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <button
            onClick={() => setShowRef(s => !s)}
            style={{
              width: '100%', padding: '8px 14px',
              background: 'none', border: 'none',
              cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12, color: 'hsl(var(--foreground))',
              fontFamily: 'inherit',
            }}>
            Compare with correct diagram
            {showRef ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showRef && (
            <div style={{ padding: '8px 14px 12px' }}>
              {referenceContent}
            </div>
          )}
        </div>
      )}

      <div style={{
        padding: '10px 14px 4px',
        fontSize: 11,
        color: 'hsl(var(--muted-foreground))',
      }}>
        Tick each element you correctly included in your diagram:
      </div>

      <div style={{ padding: '0 14px' }}>
        {criteria.map((c, i) => (
          <div key={c.id}
            onClick={() => toggle(c.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 0',
              borderBottom: i < criteria.length - 1
                ? '1px solid hsl(var(--border)/0.5)'
                : 'none',
              cursor: submitted ? 'default' : 'pointer',
              userSelect: 'none',
            }}>
            <div style={{ marginTop: 1, flexShrink: 0 }}>
              {checked[c.id]
                ? <CheckCircle2 size={16} color="hsl(142 71% 45%)" />
                : <Circle size={16} color="hsl(var(--muted-foreground))" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', lineHeight: 1.35 }}>
                {c.description}
              </div>
              {c.hint && (
                <div style={{
                  fontSize: 11, marginTop: 2,
                  color: 'hsl(var(--muted-foreground))',
                  fontStyle: 'italic',
                }}>
                  {c.hint}
                </div>
              )}
            </div>
            <div style={{
              fontSize: 11,
              color: 'hsl(var(--muted-foreground))',
              flexShrink: 0,
            }}>
              {c.marks} {c.marks === 1 ? 'mk' : 'mks'}
            </div>
          </div>
        ))}
      </div>

      {!submitted ? (
        <div style={{ padding: '10px 14px 14px' }}>
          <button onClick={submit} style={{
            width: '100%', padding: '9px',
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            border: 'none', borderRadius: 7,
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Submit self-mark
          </button>
        </div>
      ) : (
        <div style={{
          padding: '10px 14px',
          background: pct >= 0.7
            ? 'hsl(142 71% 45% / 0.08)'
            : pct >= 0.4
            ? 'hsl(25 95% 53% / 0.08)'
            : 'hsl(0 84% 60% / 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: pct >= 0.7
              ? 'hsl(142 71% 45%)'
              : pct >= 0.4
              ? 'hsl(25 95% 53%)'
              : 'hsl(0 84% 60%)',
          }}>
            {score} / {totalMarks} marks
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
            {pct >= 0.7 ? 'Well done'
              : pct >= 0.4 ? 'Partially correct'
              : 'Keep practising'}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagramMarkingChecklist;
