import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GraphCanvasPlot } from '@/components/graph/GraphCanvasPlot';
import { GraphPoint, LineSegment, DrawingPath, GraphSeries } from '@/components/graph/types';
import { AngleMeasurement } from '@/components/graph/GraphPlottingQuestion';
import { ArrowLeft, Minus, Spline, Pencil, Ruler, Eraser, Trash2, Undo2, Redo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * GraphTest - Test page for the new Desmos-style camera-based graph system.
 * 
 * Features:
 * - Pan (drag) and zoom (wheel/pinch) support
 * - All coordinates stored in graph space (not pixels)
 * - Dynamic grid scaling based on zoom level
 * - Tools: Point plotting, straight lines, curved lines, freeform, angle measurement, erase
 */
export default function GraphTest() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Graph state
  const [points, setPoints] = useState<GraphPoint[]>([]);
  const [segments, setSegments] = useState<LineSegment[]>([]);
  const [drawnPaths, setDrawnPaths] = useState<DrawingPath[]>([]);
  const [angleMeasurements, setAngleMeasurements] = useState<AngleMeasurement[]>([]);
  
  // Tool state
  const [joinMode, setJoinMode] = useState<'straight' | 'curved' | 'freeform' | 'angle' | null>(null);
  const [eraseMode, setEraseMode] = useState(false);
  const [selectedJoinPoints, setSelectedJoinPoints] = useState<GraphPoint[]>([]);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  
  // Drag state
  const [activeDragPointId, setActiveDragPointId] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingPosition, setDraggingPosition] = useState<{ x: number; y: number } | null>(null);
  
  // History for undo/redo
  const [undoStack, setUndoStack] = useState<Array<{ points: GraphPoint[]; segments: LineSegment[]; drawnPaths: DrawingPath[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ points: GraphPoint[]; segments: LineSegment[]; drawnPaths: DrawingPath[] }>>([]);
  
  // Container size
  const [containerSize, setContainerSize] = useState({ width: 600, height: 500 });
  
  // Update container size on mount
  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: Math.min(entry.contentRect.width, 600), // Square-ish aspect
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Save current state to history
  const saveToHistory = useCallback(() => {
    setUndoStack(prev => [...prev, { points: [...points], segments: [...segments], drawnPaths: [...drawnPaths] }]);
    setRedoStack([]);
  }, [points, segments, drawnPaths]);
  
  // Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, { points: [...points], segments: [...segments], drawnPaths: [...drawnPaths] }]);
    setUndoStack(u => u.slice(0, -1));
    setPoints(prev.points);
    setSegments(prev.segments);
    setDrawnPaths(prev.drawnPaths);
  }, [undoStack, points, segments, drawnPaths]);
  
  // Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, { points: [...points], segments: [...segments], drawnPaths: [...drawnPaths] }]);
    setRedoStack(r => r.slice(0, -1));
    setPoints(next.points);
    setSegments(next.segments);
    setDrawnPaths(next.drawnPaths);
  }, [redoStack, points, segments, drawnPaths]);
  
  // Clear all
  const handleClear = useCallback(() => {
    saveToHistory();
    setPoints([]);
    setSegments([]);
    setDrawnPaths([]);
    setAngleMeasurements([]);
    setSelectedJoinPoints([]);
    setSelectedSegmentIds([]);
  }, [saveToHistory]);
  
  // Generate unique IDs
  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Handle container click to add point
  const handleContainerPointerDown = useCallback((e: React.PointerEvent) => {
    // Don't add points if in angle mode or erase mode
    if (joinMode === 'angle' || eraseMode) return;
    
    // Don't add point if clicking on existing point
    if ((e.target as HTMLElement).closest('.points-layer')) return;
    
    // Get click position relative to container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // This would need to convert to graph coords - for now we'll handle via coordinate callbacks
  }, [joinMode, eraseMode]);
  
  // Handle point click for selection/joining/erasing
  const handlePointPointerDown = useCallback((point: GraphPoint, e: React.PointerEvent) => {
    e.stopPropagation();
    
    if (eraseMode) {
      saveToHistory();
      setPoints(prev => prev.filter(p => p.id !== point.id));
      // Also remove segments connected to this point
      setSegments(prev => prev.filter(s => 
        s.from.id !== point.id && s.to.id !== point.id &&
        !(s.from.x === point.x && s.from.y === point.y) &&
        !(s.to.x === point.x && s.to.y === point.y)
      ));
      return;
    }
    
    if (joinMode === 'straight' || joinMode === 'curved') {
      // Add to selection
      if (selectedJoinPoints.some(p => p.id === point.id)) {
        // Deselect
        setSelectedJoinPoints(prev => prev.filter(p => p.id !== point.id));
      } else {
        const newSelection = [...selectedJoinPoints, point];
        setSelectedJoinPoints(newSelection);
        
        // If we have 2 points, create a segment
        if (newSelection.length === 2) {
          saveToHistory();
          const newSegment: LineSegment = {
            id: `seg_${generateId()}`,
            from: newSelection[0],
            to: newSelection[1],
            mode: joinMode,
          };
          setSegments(prev => [...prev, newSegment]);
          setSelectedJoinPoints([]);
        }
      }
      return;
    }
    
    // Default: prepare for double-tap drag
  }, [eraseMode, joinMode, selectedJoinPoints, saveToHistory]);
  
  // Handle segment click for erase/angle
  const handleSegmentClick = useCallback((segmentId: string) => {
    if (eraseMode) {
      saveToHistory();
      setSegments(prev => prev.filter(s => s.id !== segmentId));
      setAngleMeasurements(prev => prev.filter(m => 
        m.segmentId1 !== segmentId && m.segmentId2 !== segmentId
      ));
      return;
    }
    
    if (joinMode === 'angle') {
      // Toggle selection
      if (selectedSegmentIds.includes(segmentId)) {
        setSelectedSegmentIds(prev => prev.filter(id => id !== segmentId));
      } else {
        const newSelection = [...selectedSegmentIds, segmentId];
        
        if (newSelection.length === 2) {
          // Calculate angle between segments
          const seg1 = segments.find(s => s.id === newSelection[0]);
          const seg2 = segments.find(s => s.id === newSelection[1]);
          
          if (seg1 && seg2) {
            // Find shared vertex
            const findAngle = () => {
              const tolerance = 0.01;
              const matches = (p1: GraphPoint, p2: GraphPoint) => 
                Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
              
              const endpoints1 = [seg1.from, seg1.to];
              const endpoints2 = [seg2.from, seg2.to];
              
              for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 2; j++) {
                  if (matches(endpoints1[i], endpoints2[j])) {
                    const vertex = endpoints1[i];
                    const other1 = endpoints1[1 - i];
                    const other2 = endpoints2[1 - j];
                    
                    const v1 = { x: other1.x - vertex.x, y: other1.y - vertex.y };
                    const v2 = { x: other2.x - vertex.x, y: other2.y - vertex.y };
                    
                    const dot = v1.x * v2.x + v1.y * v2.y;
                    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
                    
                    if (mag1 === 0 || mag2 === 0) return 0;
                    
                    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
                    return Math.round((Math.acos(cosAngle) * 180) / Math.PI);
                  }
                }
              }
              return null;
            };
            
            const angle = findAngle();
            if (angle !== null) {
              const newMeasurement: AngleMeasurement = {
                id: `angle_${generateId()}`,
                segmentId1: seg1.id,
                segmentId2: seg2.id,
                angleDegrees: angle,
              };
              setAngleMeasurements(prev => [...prev, newMeasurement]);
            }
          }
          
          setSelectedSegmentIds([]);
        } else {
          setSelectedSegmentIds(newSelection);
        }
      }
    }
  }, [eraseMode, joinMode, selectedSegmentIds, segments, saveToHistory]);
  
  // Handle drawn paths
  const handleDrawnPathsChange = useCallback((paths: DrawingPath[]) => {
    setDrawnPaths(paths);
  }, []);
  
  // Tool selection
  const handleToolChange = useCallback((tool: string | null) => {
    setEraseMode(tool === 'erase');
    if (tool === 'erase') {
      setJoinMode(null);
    } else {
      setJoinMode(tool as 'straight' | 'curved' | 'freeform' | 'angle' | null);
    }
    setSelectedJoinPoints([]);
    setSelectedSegmentIds([]);
  }, []);
  
  // Demo reference series (a simple parabola)
  const referenceSeries: GraphSeries[] = [
    {
      id: 'demo-curve',
      label: 'y = x²/10 - 3',
      data: Array.from({ length: 41 }, (_, i) => {
        const x = (i - 20) / 2;
        return { x, y: (x * x) / 10 - 3 };
      }),
      color: 'hsl(var(--primary))',
      lineStyle: 'solid',
    },
  ];
  
  const domainX: [number, number] = [-10, 10];
  const domainY: [number, number] = [-10, 10];
  
  // Config object matching GraphPlottingConfig requirements
  const graphConfig = {
    chartType: 'scatter' as const,
    xLabel: 'x',
    yLabel: 'y',
    domainX,
    domainY,
    gridEnabled: true,
    joinPointsMode: { enabled: true, defaultMode: 'straight' as const },
  };
  
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Graph System Test</h1>
            <p className="text-muted-foreground text-sm">
              New Desmos-style camera-based graph with pan/zoom
            </p>
          </div>
        </div>
        
        {/* Controls */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Tools</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClear}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ToggleGroup 
              type="single" 
              value={eraseMode ? 'erase' : joinMode || ''}
              onValueChange={handleToolChange}
              className="flex flex-wrap gap-2"
            >
              <ToggleGroupItem value="straight" className="gap-2">
                <Minus className="h-4 w-4" />
                Straight
              </ToggleGroupItem>
              <ToggleGroupItem value="curved" className="gap-2">
                <Spline className="h-4 w-4" />
                Curved
              </ToggleGroupItem>
              <ToggleGroupItem value="freeform" className="gap-2">
                <Pencil className="h-4 w-4" />
                Freeform
              </ToggleGroupItem>
              <ToggleGroupItem value="angle" className="gap-2">
                <Ruler className="h-4 w-4" />
                Angle
              </ToggleGroupItem>
              <ToggleGroupItem value="erase" className="gap-2 text-destructive">
                <Eraser className="h-4 w-4" />
                Erase
              </ToggleGroupItem>
            </ToggleGroup>
            
            <p className="text-xs text-muted-foreground mt-3">
              {joinMode === 'straight' && 'Click two points to connect them with a straight line.'}
              {joinMode === 'curved' && 'Click two points to connect them with a curved line.'}
              {joinMode === 'freeform' && 'Draw freely on the graph.'}
              {joinMode === 'angle' && 'Click two connected segments to measure the angle.'}
              {eraseMode && 'Click on points, segments, or paths to delete them.'}
              {!joinMode && !eraseMode && 'Pan: drag | Zoom: scroll/pinch | Click to add points'}
            </p>
          </CardContent>
        </Card>
        
        {/* Graph Canvas */}
        <Card>
          <CardContent className="p-4">
            <div 
              ref={containerRef} 
              className="w-full border rounded-lg overflow-hidden bg-card"
              style={{ height: containerSize.height }}
            >
              {containerSize.width > 0 && containerSize.height > 0 && (
                <GraphCanvasPlot
                  width={containerSize.width}
                  height={containerSize.height}
                  config={graphConfig}
                  domainX={domainX}
                  domainY={domainY}
                  studentPoints={points}
                  segments={segments}
                  drawnPaths={drawnPaths}
                  joinMode={joinMode}
                  referenceSeries={referenceSeries}
                  subjectColor="hsl(var(--primary))"
                  readOnly={false}
                  panZoomEnabled={!joinMode && !eraseMode}
                  eraseMode={eraseMode}
                  angleMeasurements={angleMeasurements}
                  selectedSegmentIds={selectedSegmentIds}
                  activeDragPointId={activeDragPointId}
                  draggingPointId={draggingPointId}
                  draggingPosition={draggingPosition}
                  selectedJoinPoints={selectedJoinPoints}
                  onPointPointerDown={handlePointPointerDown}
                  onSegmentClick={handleSegmentClick}
                  onDrawnPathsChange={handleDrawnPathsChange}
                />
              )}
            </div>
            
            {/* Quick add points for testing */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  saveToHistory();
                  const newPoint: GraphPoint = {
                    id: `pt_${generateId()}`,
                    x: Math.round((Math.random() * 16 - 8) * 10) / 10,
                    y: Math.round((Math.random() * 16 - 8) * 10) / 10,
                  };
                  setPoints(prev => [...prev, newPoint]);
                }}
              >
                Add Random Point
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  saveToHistory();
                  // Add a triangle
                  const p1: GraphPoint = { id: `pt_${generateId()}`, x: 0, y: 5 };
                  const p2: GraphPoint = { id: `pt_${generateId()}`, x: -4, y: -3 };
                  const p3: GraphPoint = { id: `pt_${generateId()}`, x: 4, y: -3 };
                  setPoints(prev => [...prev, p1, p2, p3]);
                  setSegments(prev => [
                    ...prev,
                    { id: `seg_${generateId()}`, from: p1, to: p2, mode: 'straight' },
                    { id: `seg_${generateId()}`, from: p2, to: p3, mode: 'straight' },
                    { id: `seg_${generateId()}`, from: p3, to: p1, mode: 'straight' },
                  ]);
                }}
              >
                Add Triangle
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* State debug */}
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-xs font-medium">Debug State</CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-mono bg-muted p-3 rounded">
            <div>Points: {points.length}</div>
            <div>Segments: {segments.length}</div>
            <div>Drawn Paths: {drawnPaths.length}</div>
            <div>Angle Measurements: {angleMeasurements.length}</div>
            <div>Selected Points: {selectedJoinPoints.length}</div>
            <div>Mode: {eraseMode ? 'erase' : joinMode || 'none'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
