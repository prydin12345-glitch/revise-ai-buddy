import React from 'react';
import { DIAGRAM_STYLE } from './types';

interface DiagramShellProps {
  children: React.ReactNode;
  viewBox?: string;
  maxWidth?: number;
}

/** Wraps every biology/chemistry diagram in a consistent SVG shell */
const DiagramShell: React.FC<DiagramShellProps> = ({
  children,
  viewBox = '0 0 500 400',
  maxWidth = 500,
}) => (
  <svg
    viewBox={viewBox}
    width="100%"
    style={{
      maxWidth,
      display: 'block',
      margin: '0 auto',
      background: DIAGRAM_STYLE.background,
      border: '1px solid #e5e7eb',
      borderRadius: 6,
    }}
  >
    {children}
  </svg>
);

export default DiagramShell;
