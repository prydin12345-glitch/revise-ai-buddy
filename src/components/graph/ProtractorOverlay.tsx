import React from 'react';

interface ProtractorOverlayProps {
  containerWidth: number;
  containerHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
}

/**
 * Semi-transparent protractor overlay for angle measurement reference.
 * 0° is along +x axis, 90° is up (+y).
 * pointer-events: none so it doesn't block interactions.
 */
export function ProtractorOverlay({
  containerWidth,
  containerHeight,
  marginLeft,
  marginRight,
  marginTop,
  marginBottom,
}: ProtractorOverlayProps) {
  const plotWidth = containerWidth - marginLeft - marginRight;
  const plotHeight = containerHeight - marginTop - marginBottom;
  
  // Center of the protractor (center of plot area)
  const centerX = marginLeft + plotWidth / 2;
  const centerY = marginTop + plotHeight / 2;
  
  // Radius - use smaller dimension to fit
  const radius = Math.min(plotWidth, plotHeight) * 0.4;
  
  // Generate tick marks every 10 degrees
  const ticks: Array<{ angle: number; major: boolean }> = [];
  for (let i = 0; i < 360; i += 10) {
    ticks.push({ angle: i, major: i % 30 === 0 });
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 10,
      }}
    >
      {/* Semi-transparent circle */}
      <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="hsl(var(--primary) / 0.05)"
        stroke="hsl(var(--primary) / 0.3)"
        strokeWidth={1}
      />
      
      {/* Inner circle */}
      <circle
        cx={centerX}
        cy={centerY}
        r={radius * 0.1}
        fill="hsl(var(--primary) / 0.2)"
        stroke="hsl(var(--primary) / 0.4)"
        strokeWidth={1}
      />
      
      {/* Tick marks */}
      {ticks.map(({ angle, major }) => {
        // Convert to radians, adjust so 0° is +x and 90° is +y (up)
        // In SVG, y increases downward, so we need to negate
        const rad = (-angle * Math.PI) / 180;
        const innerR = major ? radius * 0.85 : radius * 0.9;
        const outerR = radius;
        
        const x1 = centerX + innerR * Math.cos(rad);
        const y1 = centerY + innerR * Math.sin(rad);
        const x2 = centerX + outerR * Math.cos(rad);
        const y2 = centerY + outerR * Math.sin(rad);
        
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="hsl(var(--primary) / 0.4)"
            strokeWidth={major ? 1.5 : 0.75}
          />
        );
      })}
      
      {/* Angle labels every 30 degrees */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
        const rad = (-angle * Math.PI) / 180;
        const labelR = radius * 0.75;
        const x = centerX + labelR * Math.cos(rad);
        const y = centerY + labelR * Math.sin(rad);
        
        return (
          <text
            key={`label-${angle}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill="hsl(var(--primary) / 0.6)"
            fontWeight={angle % 90 === 0 ? 'bold' : 'normal'}
          >
            {angle}°
          </text>
        );
      })}
      
      {/* Cardinal direction labels */}
      <text
        x={centerX + radius + 12}
        y={centerY}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={12}
        fill="hsl(var(--primary) / 0.7)"
        fontWeight="bold"
      >
        0°
      </text>
      <text
        x={centerX}
        y={centerY - radius - 8}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={12}
        fill="hsl(var(--primary) / 0.7)"
        fontWeight="bold"
      >
        90°
      </text>
    </svg>
  );
}

export default ProtractorOverlay;
