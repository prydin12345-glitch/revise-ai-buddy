import type { EMSpectrumConfig } from '../types';

interface Props { config: EMSpectrumConfig; }

export const EMSpectrumRenderer = ({ config }: Props) => {
  const { highlightRegion, showWavelength, showFrequency, showUses, title } = config;

  const W = 560, H = showUses ? 280 : 200;

  const regions = [
    { id: 'radio', label: 'Radio', color: '#FF6B6B', wavelength: '>1m', frequency: '<3×10⁸Hz', use: 'Broadcasting' },
    { id: 'microwave', label: 'Microwave', color: '#FF9F43', wavelength: '1mm–1m', frequency: '3GHz–300GHz', use: 'Cooking, WiFi' },
    { id: 'infrared', label: 'Infrared', color: '#EE5A24', wavelength: '700nm–1mm', frequency: '300GHz–430THz', use: 'Remote controls' },
    { id: 'visible', label: 'Visible', color: 'url(#visibleGrad)', wavelength: '400–700nm', frequency: '430–770THz', use: 'Human vision' },
    { id: 'ultraviolet', label: 'UV', color: '#A29BFE', wavelength: '10–400nm', frequency: '770THz–30PHz', use: 'Sterilisation' },
    { id: 'xray', label: 'X-ray', color: '#6C5CE7', wavelength: '0.01–10nm', frequency: '30PHz–30EHz', use: 'Medical imaging' },
    { id: 'gamma', label: 'Gamma', color: '#2D3436', wavelength: '<0.01nm', frequency: '>30EHz', use: 'Cancer treatment' },
  ];

  const barH = 52;
  const barY = 60;
  const marginX = 20;
  const barW = (W - marginX * 2) / regions.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>

      <defs>
        <linearGradient id="visibleGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF0000" />
          <stop offset="20%" stopColor="#FF7700" />
          <stop offset="40%" stopColor="#FFFF00" />
          <stop offset="60%" stopColor="#00CC00" />
          <stop offset="80%" stopColor="#0000FF" />
          <stop offset="100%" stopColor="#8B00FF" />
        </linearGradient>
        <marker id="arrLeft" markerWidth={8} markerHeight={6}
          refX={1} refY={3} orient="auto">
          <polygon points="8 0, 0 3, 8 6"
            fill="hsl(var(--muted-foreground))" />
        </marker>
        <marker id="arrRight" markerWidth={8} markerHeight={6}
          refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6"
            fill="hsl(var(--muted-foreground))" />
        </marker>
      </defs>

      {title && (
        <text x={W/2} y={22} textAnchor="middle"
          fontSize={12} fontWeight={700}
          fill="hsl(var(--foreground))">{title}</text>
      )}

      {showWavelength && (
        <>
          <line x1={marginX} y1={46} x2={W - marginX} y2={46}
            stroke="hsl(var(--muted-foreground))" strokeWidth={1.5}
            markerStart="url(#arrLeft)"
            markerEnd="url(#arrRight)" />
          <text x={marginX + 10} y={42} fontSize={9}
            fill="hsl(var(--muted-foreground))">
            longer wavelength
          </text>
          <text x={W - marginX - 10} y={42} textAnchor="end"
            fontSize={9} fill="hsl(var(--muted-foreground))">
            shorter wavelength
          </text>
        </>
      )}

      {regions.map((region, i) => {
        const x = marginX + i * barW;
        const isHighlighted = highlightRegion === region.id;
        return (
          <g key={region.id}>
            <rect
              x={x} y={barY} width={barW} height={barH}
              fill={region.color}
              opacity={highlightRegion && !isHighlighted ? 0.4 : 1}
              stroke={isHighlighted ? 'white' : 'none'}
              strokeWidth={isHighlighted ? 3 : 0}
            />
            <text
              x={x + barW / 2} y={barY + barH / 2 + 5}
              textAnchor="middle" fontSize={10} fontWeight={600}
              fill="white"
            >
              {region.label}
            </text>

            {showWavelength && (
              <text x={x + barW / 2} y={barY + barH + 14}
                textAnchor="middle" fontSize={8}
                fill="hsl(var(--muted-foreground))">
                {region.wavelength}
              </text>
            )}

            {showUses && (
              <text x={x + barW / 2} y={barY + barH + (showWavelength ? 30 : 18)}
                textAnchor="middle" fontSize={8}
                fill="hsl(var(--muted-foreground))">
                {region.use}
              </text>
            )}
          </g>
        );
      })}

      {showFrequency && (
        <>
          <line
            x1={marginX}
            y1={showUses ? barY + barH + 50 : barY + barH + 28}
            x2={W - marginX}
            y2={showUses ? barY + barH + 50 : barY + barH + 28}
            stroke="hsl(var(--muted-foreground))" strokeWidth={1.5}
            markerStart="url(#arrRight)"
            markerEnd="url(#arrLeft)" />
          <text
            x={marginX + 10}
            y={showUses ? barY + barH + 46 : barY + barH + 24}
            fontSize={9} fill="hsl(var(--muted-foreground))">
            higher frequency
          </text>
        </>
      )}
    </svg>
  );
};

export default EMSpectrumRenderer;
