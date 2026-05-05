import { useRef, useState, useEffect, useCallback } from 'react';
import { Pen, Minus, Type, Eraser, Undo2, Trash2 } from 'lucide-react';

export type DrawingTool = 'pen' | 'line' | 'label' | 'eraser';

interface Point { x: number; y: number; }

interface DrawnElement {
  id: string;
  tool: DrawingTool;
  points?: Point[];
  lineStart?: Point;
  lineEnd?: Point;
  label?: string;
  labelPos?: Point;
  color: string;
  strokeWidth: number;
}

const COLORS = [
  { value: '#111111', label: 'Black' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#dc2626', label: 'Red' },
  { value: '#16a34a', label: 'Green' },
  { value: '#9333ea', label: 'Purple' },
  { value: '#ea580c', label: 'Orange' },
];

const STROKE_WIDTHS = [1.5, 2.5, 4];

interface Props {
  onDrawingChange?: (dataUrl: string) => void;
  disabled?: boolean;
  showAxes?: boolean;
  axisLabels?: { x: string; y: string };
  height?: number;
}

export const DrawingCanvas = ({
  onDrawingChange,
  disabled = false,
  showAxes = true,
  axisLabels = { x: 'Quantity', y: 'Price' },
  height = 340,
}: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(500);
  const H = height;

  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState('#111111');
  const [strokeWidth, setStrokeWidth] = useState(2.5);
  const [elements, setElements] = useState<DrawnElement[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [lineStart, setLineStart] = useState<Point | null>(null);
  const [linePreview, setLinePreview] = useState<Point | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [labelText, setLabelText] = useState('');
  const [labelPos, setLabelPos] = useState<Point | null>(null);
  const [showLabelInput, setShowLabelInput] = useState(false);

  const MARGIN = { top: 36, right: 28, bottom: 52, left: 58 };
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setW(Math.floor(w));
    });
    obs.observe(containerRef.current);
    setW(containerRef.current.offsetWidth || 500);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!onDrawingChange || elements.length === 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const s = new XMLSerializer();
    const str = s.serializeToString(svg);
    const url = `data:image/svg+xml;base64,${btoa(
      unescape(encodeURIComponent(str))
    )}`;
    onDrawingChange(url);
  }, [elements, onDrawingChange]);

  const getPoint = useCallback((
    e: React.MouseEvent | React.TouchEvent
  ): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const cx = 'touches' in e
      ? e.touches[0]?.clientX ?? 0
      : (e as React.MouseEvent).clientX;
    const cy = 'touches' in e
      ? e.touches[0]?.clientY ?? 0
      : (e as React.MouseEvent).clientY;
    return {
      x: ((cx - rect.left) / rect.width) * W,
      y: ((cy - rect.top) / rect.height) * H,
    };
  }, [W, H]);

  const onPointerDown = useCallback((
    e: React.MouseEvent | React.TouchEvent
  ) => {
    if (disabled) return;
    e.preventDefault();
    const pt = getPoint(e);

    if (tool === 'label') {
      setLabelPos(pt);
      setShowLabelInput(true);
      return;
    }
    if (tool === 'line') {
      setLineStart(pt);
      setIsDrawing(true);
      return;
    }
    setIsDrawing(true);
    setCurrentPoints([pt]);
  }, [disabled, tool, getPoint]);

  const onPointerMove = useCallback((
    e: React.MouseEvent | React.TouchEvent
  ) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const pt = getPoint(e);
    if (tool === 'line') {
      setLinePreview(pt);
      return;
    }
    setCurrentPoints(prev => [...prev, pt]);
  }, [isDrawing, disabled, tool, getPoint]);

  const onPointerUp = useCallback((
    e: React.MouseEvent | React.TouchEvent
  ) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const pt = getPoint(e);

    if (tool === 'line' && lineStart) {
      setElements(prev => [...prev, {
        id: `el-${Date.now()}`,
        tool: 'line',
        lineStart,
        lineEnd: pt,
        color,
        strokeWidth,
      }]);
      setLineStart(null);
      setLinePreview(null);
      setIsDrawing(false);
      return;
    }

    if (tool === 'eraser') {
      const r = 18;
      setElements(prev => prev.filter(el => {
        if (el.tool === 'line' && el.lineStart && el.lineEnd) {
          return !currentPoints.some(cp => {
            const dx = el.lineEnd!.x - el.lineStart!.x;
            const dy = el.lineEnd!.y - el.lineStart!.y;
            const len2 = dx * dx + dy * dy + 0.001;
            const t = Math.max(0, Math.min(1,
              ((cp.x - el.lineStart!.x) * dx +
               (cp.y - el.lineStart!.y) * dy) / len2
            ));
            const nx = el.lineStart!.x + t * dx - cp.x;
            const ny = el.lineStart!.y + t * dy - cp.y;
            return Math.sqrt(nx * nx + ny * ny) < r;
          });
        }
        if (el.tool === 'label' && el.labelPos) {
          return !currentPoints.some(cp =>
            Math.hypot(cp.x - el.labelPos!.x, cp.y - el.labelPos!.y) < r * 2
          );
        }
        if (el.points) {
          return !el.points.some(pp =>
            currentPoints.some(cp =>
              Math.hypot(cp.x - pp.x, cp.y - pp.y) < r
            )
          );
        }
        return true;
      }));
    } else if (currentPoints.length > 1) {
      setElements(prev => [...prev, {
        id: `el-${Date.now()}`,
        tool,
        points: currentPoints,
        color,
        strokeWidth,
      }]);
    }

    setCurrentPoints([]);
    setIsDrawing(false);
  }, [
    isDrawing, disabled, tool, currentPoints,
    color, strokeWidth, lineStart, getPoint,
  ]);

  const placeLabel = () => {
    if (!labelPos || !labelText.trim()) {
      setShowLabelInput(false);
      setLabelText('');
      return;
    }
    setElements(prev => [...prev, {
      id: `el-${Date.now()}`,
      tool: 'label',
      labelPos,
      label: labelText.trim(),
      color,
      strokeWidth,
    }]);
    setShowLabelInput(false);
    setLabelText('');
    setLabelPos(null);
  };

  const buildPath = (pts: Point[]) =>
    pts.reduce((d, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const p = pts[i - 1];
      return `${d} Q ${p.x} ${p.y} ${(p.x + pt.x) / 2} ${(p.y + pt.y) / 2}`;
    }, '');

  const toolDefs = [
    { id: 'pen' as DrawingTool, icon: <Pen size={14} />, tip: 'Pen' },
    { id: 'line' as DrawingTool, icon: <Minus size={14} />, tip: 'Straight line' },
    { id: 'label' as DrawingTool, icon: <Type size={14} />, tip: 'Add label' },
    { id: 'eraser' as DrawingTool, icon: <Eraser size={14} />, tip: 'Eraser' },
  ];

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>

      {!disabled && (
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 6, flexWrap: 'wrap',
          padding: '7px 10px',
          background: 'hsl(var(--muted)/0.4)',
          border: '1px solid hsl(var(--border))',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
        }}>

          <div style={{ display: 'flex', gap: 3 }}>
            {toolDefs.map(t => (
              <button key={t.id}
                onClick={() => setTool(t.id)}
                title={t.tip}
                style={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  background: tool === t.id
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--card))',
                  color: tool === t.id
                    ? 'hsl(var(--primary-foreground))'
                    : 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                {t.icon}
              </button>
            ))}
          </div>

          <div style={{
            width: 1, height: 22,
            background: 'hsl(var(--border))',
          }} />

          <div style={{ display: 'flex', gap: 4 }}>
            {COLORS.map(c => (
              <button key={c.value}
                onClick={() => setColor(c.value)}
                title={c.label}
                style={{
                  width: 18, height: 18,
                  borderRadius: '50%',
                  background: c.value,
                  border: color === c.value
                    ? '2.5px solid hsl(var(--foreground))'
                    : '1.5px solid hsl(var(--border))',
                  cursor: 'pointer',
                  transition: 'border 0.1s',
                }}
              />
            ))}
          </div>

          <div style={{
            width: 1, height: 22,
            background: 'hsl(var(--border))',
          }} />

          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {STROKE_WIDTHS.map(sw => (
              <button key={sw}
                onClick={() => setStrokeWidth(sw)}
                title={`${sw}px`}
                style={{
                  width: 32, height: 24,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  background: strokeWidth === sw
                    ? 'hsl(var(--muted))'
                    : 'transparent',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 4, cursor: 'pointer',
                }}>
                <div style={{
                  width: 16, height: sw,
                  background: 'hsl(var(--foreground))',
                  borderRadius: 1,
                }} />
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setElements(e => e.slice(0, -1))}
            disabled={elements.length === 0}
            title="Undo last"
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6, cursor: 'pointer',
              opacity: elements.length === 0 ? 0.35 : 1,
              color: 'hsl(var(--foreground))',
            }}>
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => setElements([])}
            title="Clear all"
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6, cursor: 'pointer',
              color: 'hsl(0 84% 60%)',
            }}>
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {showLabelInput && labelPos && !disabled && (
        <div style={{
          position: 'absolute',
          top: 52, left: 60,
          zIndex: 200,
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 8,
          padding: '8px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <input
            autoFocus
            value={labelText}
            onChange={e => setLabelText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') placeLabel();
              if (e.key === 'Escape') {
                setShowLabelInput(false);
                setLabelText('');
              }
            }}
            placeholder="e.g. E1, P1, D, S"
            style={{
              width: 130, padding: '4px 8px',
              border: '1px solid hsl(var(--border))',
              borderRadius: 5, fontSize: 12,
              fontFamily: 'inherit',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            }}
          />
          <button onClick={placeLabel} style={{
            padding: '4px 10px',
            background: 'hsl(var(--primary))',
            border: 'none', borderRadius: 5,
            color: 'hsl(var(--primary-foreground))',
            fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>Place</button>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{
          display: 'block',
          background: 'white',
          border: '1px solid hsl(var(--border))',
          borderRadius: disabled ? 8 : '0 0 8px 8px',
          cursor: disabled ? 'default'
            : tool === 'eraser' ? 'cell'
            : tool === 'label' ? 'text'
            : 'crosshair',
          touchAction: 'none',
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        {showAxes && axisLabels.x && axisLabels.y && (
          <g opacity={0.3} pointerEvents="none">
            {Array.from({ length: 5 }, (_, i) => i + 1).map(i => (
              <g key={i}>
                <line
                  x1={MARGIN.left + (plotW / 5) * i} y1={MARGIN.top}
                  x2={MARGIN.left + (plotW / 5) * i} y2={MARGIN.top + plotH}
                  stroke="#bbb" strokeWidth={0.5} strokeDasharray="4 4"
                />
                <line
                  x1={MARGIN.left} y1={MARGIN.top + (plotH / 5) * i}
                  x2={MARGIN.left + plotW} y2={MARGIN.top + (plotH / 5) * i}
                  stroke="#bbb" strokeWidth={0.5} strokeDasharray="4 4"
                />
              </g>
            ))}

            <line
              x1={MARGIN.left} y1={MARGIN.top - 12}
              x2={MARGIN.left} y2={MARGIN.top + plotH}
              stroke="#444" strokeWidth={1.8}
            />
            <polygon
              points={`${MARGIN.left - 4},${MARGIN.top - 8} ${MARGIN.left + 4},${MARGIN.top - 8} ${MARGIN.left},${MARGIN.top - 18}`}
              fill="#444"
            />

            <line
              x1={MARGIN.left} y1={MARGIN.top + plotH}
              x2={MARGIN.left + plotW + 14} y2={MARGIN.top + plotH}
              stroke="#444" strokeWidth={1.8}
            />
            <polygon
              points={`${MARGIN.left + plotW + 10},${MARGIN.top + plotH - 4} ${MARGIN.left + plotW + 10},${MARGIN.top + plotH + 4} ${MARGIN.left + plotW + 20},${MARGIN.top + plotH}`}
              fill="#444"
            />

            <text
              x={MARGIN.left - 10} y={MARGIN.top + plotH + 14}
              textAnchor="end" fontSize={11} fill="#444">O</text>

            <text
              x={14} y={MARGIN.top + plotH / 2}
              textAnchor="middle" fontSize={11} fill="#444"
              transform={`rotate(-90, 14, ${MARGIN.top + plotH / 2})`}>
              {axisLabels.y}
            </text>

            <text
              x={MARGIN.left + plotW / 2} y={MARGIN.top + plotH + 30}
              textAnchor="middle" fontSize={11} fill="#444">
              {axisLabels.x}
            </text>
          </g>
        )}

        {elements.map(el => {
          if (el.tool === 'label' && el.label && el.labelPos) {
            return (
              <text key={el.id}
                x={el.labelPos.x} y={el.labelPos.y}
                fontSize={13} fontWeight={600}
                fill={el.color} fontFamily="serif">
                {el.label}
              </text>
            );
          }
          if (el.tool === 'line' && el.lineStart && el.lineEnd) {
            return (
              <line key={el.id}
                x1={el.lineStart.x} y1={el.lineStart.y}
                x2={el.lineEnd.x} y2={el.lineEnd.y}
                stroke={el.color}
                strokeWidth={el.strokeWidth}
                strokeLinecap="round"
              />
            );
          }
          if (el.points && el.points.length >= 2) {
            return (
              <path key={el.id}
                d={buildPath(el.points)}
                fill="none"
                stroke={el.color}
                strokeWidth={el.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          return null;
        })}

        {currentPoints.length >= 2 && tool !== 'eraser' && (
          <path
            d={buildPath(currentPoints)}
            fill="none" stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.7}
          />
        )}

        {tool === 'eraser' && isDrawing &&
         currentPoints.length > 0 && (
          <circle
            cx={currentPoints[currentPoints.length - 1].x}
            cy={currentPoints[currentPoints.length - 1].y}
            r={18}
            fill="rgba(200,200,200,0.35)"
            stroke="#999" strokeWidth={1}
          />
        )}

        {tool === 'line' && lineStart && linePreview && (
          <line
            x1={lineStart.x} y1={lineStart.y}
            x2={linePreview.x} y2={linePreview.y}
            stroke={color} strokeWidth={strokeWidth}
            strokeDasharray="6 3" opacity={0.55}
            strokeLinecap="round"
          />
        )}

        {elements.length === 0 && !isDrawing && !disabled && (
          <text
            x={W / 2} y={H / 2}
            textAnchor="middle" fontSize={13}
            fill="#ccc" pointerEvents="none">
            Draw your diagram here
          </text>
        )}
      </svg>

      {!disabled && (
        <div style={{
          fontSize: 10,
          color: 'hsl(var(--muted-foreground))',
          textAlign: 'center',
          padding: '3px 0 1px',
        }}>
          {tool === 'pen' && 'Pen — click and drag to draw freehand'}
          {tool === 'line' && 'Line — click start point, drag to end point'}
          {tool === 'label' && 'Label — click canvas to place text (e.g. E1, P1, S, D)'}
          {tool === 'eraser' && 'Eraser — drag over elements to remove them'}
        </div>
      )}
    </div>
  );
};

export default DrawingCanvas;
