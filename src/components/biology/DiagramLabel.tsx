import React from 'react';
import { DIAGRAM_STYLE, type DiagramLabelData } from './types';

interface DiagramLabelProps {
  label: DiagramLabelData;
  mode: 'visible' | 'hidden';
  revealed?: boolean;
  onClick?: () => void;
  /** Draw a leader line from label to anchor point */
  showLeader?: boolean;
}

const DiagramLabel: React.FC<DiagramLabelProps> = ({
  label,
  mode,
  revealed = false,
  onClick,
  showLeader = true,
}) => {
  const { x, y, anchorX, anchorY, displayName } = label;
  const S = DIAGRAM_STYLE;

  // Measure text width approx
  const textWidth = displayName.length * 6.5 + 12;
  const boxH = 18;

  if (mode === 'visible') {
    return (
      <g>
        {showLeader && anchorX !== undefined && anchorY !== undefined && (
          <line
            x1={anchorX} y1={anchorY} x2={x} y2={y}
            stroke={S.labelStroke} strokeWidth={S.labelStrokeWidth}
            strokeDasharray="3 2"
          />
        )}
        <text
          x={x} y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={S.fontFamily}
          fontStyle={S.fontStyle}
          fontSize={S.fontSize}
          fill="#1a1a1a"
        >
          {displayName}
        </text>
      </g>
    );
  }

  // Hidden mode
  const isRevealed = revealed;
  const boxFill = isRevealed ? S.revealedFill : S.hiddenBoxFill;
  const boxStroke = isRevealed ? S.revealedStroke : S.hiddenBoxStroke;
  const textFill = isRevealed ? S.revealedText : 'white';
  const displayText = isRevealed ? displayName : '?';
  const w = isRevealed ? textWidth : 24;

  return (
    <g
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {showLeader && anchorX !== undefined && anchorY !== undefined && (
        <line
          x1={anchorX} y1={anchorY} x2={x} y2={y}
          stroke={S.labelStroke} strokeWidth={S.labelStrokeWidth}
          strokeDasharray="3 2"
        />
      )}
      <rect
        x={x - w / 2} y={y - boxH / 2}
        width={w} height={boxH}
        rx={3}
        fill={boxFill}
        stroke={boxStroke}
        strokeWidth={1}
      />
      <text
        x={x} y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={S.fontFamily}
        fontStyle={isRevealed ? S.fontStyle : 'normal'}
        fontSize={isRevealed ? S.smallFontSize : S.fontSize}
        fill={textFill}
        fontWeight={isRevealed ? 'normal' : 'bold'}
      >
        {displayText}
      </text>
    </g>
  );
};

export default DiagramLabel;
