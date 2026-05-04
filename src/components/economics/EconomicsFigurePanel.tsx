import { useState } from 'react';
import { TrendingUp, Maximize2, X } from 'lucide-react';
import { EconomicsDiagramDraw } from './EconomicsDiagramDraw';
import { detectEconomicsDiagram } from './economics-detector';
import type { EconomicsDiagramConfig } from './types';

interface Props {
  questionText: string;
  subject?: string;
  diagramConfig?: EconomicsDiagramConfig | null;
}

export const EconomicsFigurePanel = ({
  questionText,
  subject,
  diagramConfig,
}: Props) => {
  const [expanded, setExpanded] = useState(false);
  const config = diagramConfig ?? detectEconomicsDiagram(questionText, subject);
  if (!config) return null;

  const typeLabel: Record<string, string> = {
    supply_demand: 'Supply and Demand Diagram',
    ppf: 'Production Possibility Frontier',
    lorenz_curve: 'Lorenz Curve',
    break_even: 'Break-Even Chart',
    aggregate_demand_supply: 'Aggregate Demand and Supply',
    market_failure: 'Market Failure Diagram',
    circular_flow: 'Circular Flow of Income',
  };

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
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600,
            color: 'hsl(25 95% 53%)',
          }}>
            <TrendingUp size={13} />
            {label}
          </div>
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
        </div>
        <div style={{ padding: '12px 8px', maxWidth: 520, margin: '0 auto' }}>
          <EconomicsDiagramDraw config={config} />
        </div>
      </div>

      {expanded && (
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
