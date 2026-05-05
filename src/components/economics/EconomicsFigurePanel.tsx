import { useState } from 'react';
import { TrendingUp, Maximize2, X } from 'lucide-react';
import { EconomicsDiagramDraw } from './EconomicsDiagramDraw';
import { detectEconomicsDiagram } from './economics-detector';
import { detectDrawQuestion } from '@/components/drawing/DrawDiagramQuestion';
import type { EconomicsDiagramConfig } from './types';

interface Props {
  questionText: string;
  subject?: string;
  diagramConfig?: EconomicsDiagramConfig | null;
  isSubmitted?: boolean;
  isReview?: boolean;
}

const typeLabel: Record<string, string> = {
  supply_demand: 'Supply and Demand Diagram',
  ppf: 'Production Possibility Frontier',
  lorenz_curve: 'Lorenz Curve',
  break_even: 'Break-Even Chart',
  aggregate_demand_supply: 'Aggregate Demand and Supply',
  market_failure: 'Market Failure Diagram',
  circular_flow: 'Circular Flow of Income',
};

export const EconomicsFigurePanel = ({
  questionText,
  subject,
  diagramConfig,
  isSubmitted = false,
  isReview = false,
}: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const config = diagramConfig ?? detectEconomicsDiagram(questionText, subject);
  if (!config) return null;

  const shouldShow = isReview || isSubmitted || revealed;
  const label = typeLabel[config.type] ?? 'Economics Diagram';

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
          background: 'hsl(25 95% 53% / 0.08)',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600,
            color: 'hsl(25 95% 53%)',
          }}>
            <TrendingUp size={13} />
            {label}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!shouldShow && (
              <span style={{
                fontSize: 10,
                color: 'hsl(var(--muted-foreground))',
                fontStyle: 'italic',
              }}>
                Reference diagram
              </span>
            )}
            {!isReview && !isSubmitted && (
              <button
                onClick={() => setRevealed(r => !r)}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  background: revealed
                    ? 'hsl(var(--muted))'
                    : 'hsl(25 95% 53% / 0.12)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 5,
                  cursor: 'pointer',
                  color: 'hsl(var(--foreground))',
                  fontFamily: 'inherit',
                }}
              >
                {revealed ? 'Hide diagram' : 'Show reference diagram'}
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
          <div style={{ padding: '12px 8px', maxWidth: 520, margin: '0 auto' }}>
            <EconomicsDiagramDraw config={config} />
          </div>
        ) : (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'hsl(var(--muted-foreground))',
            fontSize: 12,
            fontStyle: 'italic',
          }}>
            Answer the question above then click Show reference diagram
          </div>
        )}
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
              width: '100%', maxWidth: 720,
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
              color: 'hsl(25 95% 53%)',
              marginBottom: 16,
            }}>
              {label}
            </div>
            <EconomicsDiagramDraw config={config} />
          </div>
        </div>
      )}
    </>
  );
};

export default EconomicsFigurePanel;
