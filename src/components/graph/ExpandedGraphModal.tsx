import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Undo2, Redo2, Trash2, Eraser, Minus, Spline, Pencil, Ruler, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  GraphPlottingConfig,
  GraphPoint,
  GraphPlottingMarkingResult,
  LineSegment,
  DrawingPath,
  GraphSeries,
  BestFitLine,
  BestFitAnswer,
} from './types';
import { GraphCanvasPlot } from './GraphCanvasPlot';
import { AngleMeasurement } from './GraphPlottingQuestion';

interface ExpandedGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Pass through all GraphPlottingQuestion props
  config: GraphPlottingConfig;
  studentPoints: GraphPoint[];
  onPointsChange: (points: GraphPoint[]) => void;
  segments: LineSegment[];
  onSegmentsChange: (segments: LineSegment[]) => void;
  drawnPaths?: DrawingPath[];
  onDrawnPathsChange?: (paths: DrawingPath[]) => void;
  joinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null;
  onJoinModeChange?: (mode: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null) => void;
  
  // Domain/scale (locked between views)
  domainX: [number, number];
  domainY: [number, number];
  
  // Review mode data
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphPlottingMarkingResult;
  referenceSeries?: GraphSeries[];
  expectedCurveSeries?: GraphSeries[];
  
  // Styling
  subjectColor?: string;
  
  // Additional props
  questionId?: string;
  showProtractor?: boolean;
  protractorState?: any;
  onProtractorStateChange?: (state: any) => void;
  selectedSegmentIds?: string[];
  onSelectedSegmentIdsChange?: (ids: string[]) => void;
  angleMeasurements?: AngleMeasurement[];
  onAngleMeasurementsChange?: (measurements: AngleMeasurement[]) => void;
  
  // History functions passed from parent
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  
  // Question text to display in focus mode
  questionText?: string;

  // Line of best fit
  bestFitLine?: BestFitLine | null;
  expectedBestFit?: BestFitAnswer | null;
}

/**
 * Generate a stable unique ID for a point.
 */
function generatePointId(): string {
  return `pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ExpandedGraphModal - Full-page graph workspace using the Desmos-style camera renderer.
 * 
 * This is NOT a modal/popup - it's a full-page takeover that provides:
 * - Square-ish aspect ratio for natural sketching (not wide/shallow)
 * - All state shared with inline GraphPlottingQuestion via callbacks
 * - Uses GraphCanvasPlot for consistent rendering with the inline graph
 */
export function ExpandedGraphModal({
  isOpen,
  onClose,
  config,
  studentPoints,
  onPointsChange,
  segments = [],
  onSegmentsChange,
  drawnPaths = [],
  onDrawnPathsChange,
  joinMode,
  onJoinModeChange,
  domainX,
  domainY,
  readOnly = false,
  showCorrectAnswers = false,
  markingData,
  referenceSeries = [],
  expectedCurveSeries = [],
  subjectColor = 'hsl(var(--primary))',
  questionId,
  selectedSegmentIds = [],
  onSelectedSegmentIdsChange,
  angleMeasurements = [],
  onAngleMeasurementsChange,
  onUndo,
  onRedo,
  onClearAll,
  canUndo,
  canRedo,
  canClear,
  questionText,
  bestFitLine = null,
  expectedBestFit = null,
}: ExpandedGraphModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Chart size state
  const [chartContainerSize, setChartContainerSize] = useState({ width: 800, height: 600 });
  
  // Selected points for creating segments
  const [selectedJoinPoints, setSelectedJoinPoints] = useState<GraphPoint[]>([]);
  
  // Erase mode
  const [eraseMode, setEraseMode] = useState(false);
  
  // Question text expansion
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  
  // Active drag point
  const [activeDragPointId, setActiveDragPointId] = useState<string | null>(null);
  
  // Dragging state
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingPosition, setDraggingPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Truncate question text for display
  const truncatedQuestionText = useMemo(() => {
    if (!questionText) return null;
    const maxLength = 80;
    if (questionText.length <= maxLength) return questionText;
    return questionText.substring(0, maxLength).trim() + '…';
  }, [questionText]);

  // Reset internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedJoinPoints([]);
      setEraseMode(false);
      setActiveDragPointId(null);
      setDraggingPointId(null);
      setDraggingPosition(null);
    }
  }, [isOpen, questionId]);

  // Observe container size changes
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Mode helpers
  const isJoinModeEnabled = config.joinPointsMode?.enabled ?? false;
  const isAngleMode = joinMode === 'angle';
  const isDrawingMode = joinMode === 'straight' || joinMode === 'curved' || joinMode === 'freeform';
  const isJoinModeActive = isJoinModeEnabled && isDrawingMode;
  const currentJoinMode = joinMode;

  // Active drag point object
  const activeDragPoint = useMemo(() => {
    return studentPoints.find(p => p.id === activeDragPointId);
  }, [studentPoints, activeDragPointId]);

  /**
   * Round a value to 4 decimal places.
   */
  const roundCoord = useCallback((value: number): number => {
    return Math.round(value * 10000) / 10000;
  }, []);

  /**
   * Snap a coordinate to 4 decimal place precision.
   */
  const snapPoint = useCallback((x: number, y: number): { x: number; y: number } => {
    return { 
      x: roundCoord(x), 
      y: roundCoord(y) 
    };
  }, [roundCoord]);

  /**
   * Add a new point to the graph.
   */
  const addPoint = useCallback((x: number, y: number) => {
    if (readOnly) return;
    
    const snapped = snapPoint(x, y);
    
    const isDuplicate = studentPoints.some(
      p => Math.abs(p.x - snapped.x) < 0.05 && Math.abs(p.y - snapped.y) < 0.05
    );
    
    if (!isDuplicate) {
      const newPoint: GraphPoint = { 
        id: generatePointId(), 
        x: snapped.x, 
        y: snapped.y 
      };
      onPointsChange([...studentPoints, newPoint]);
    }
  }, [readOnly, snapPoint, studentPoints, onPointsChange]);

  /**
   * Handle segment click (for erase or angle mode).
   */
  const handleSegmentClick = useCallback((segmentId: string) => {
    if (eraseMode && !readOnly) {
      onSegmentsChange(segments.filter(s => s.id !== segmentId));
      return;
    }
    
    if (isAngleMode && onSelectedSegmentIdsChange) {
      if (selectedSegmentIds.includes(segmentId)) {
        onSelectedSegmentIdsChange(selectedSegmentIds.filter(id => id !== segmentId));
      } else {
        const newSelection = [...selectedSegmentIds, segmentId];
        
        if (newSelection.length >= 2 && onAngleMeasurementsChange) {
          // Calculate and save angle measurement
          const seg1 = segments.find(s => s.id === newSelection[0]);
          const seg2 = segments.find(s => s.id === newSelection[1]);
          
          if (seg1 && seg2) {
            // Calculate angle between segments (simplified)
            const newMeasurement: AngleMeasurement = {
              id: `angle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              segmentId1: seg1.id,
              segmentId2: seg2.id,
              angleDegrees: 0, // Will be calculated by the component
            };
            onAngleMeasurementsChange([...angleMeasurements, newMeasurement]);
          }
          onSelectedSegmentIdsChange([]);
        } else {
          onSelectedSegmentIdsChange(newSelection);
        }
      }
    }
  }, [eraseMode, readOnly, isAngleMode, segments, selectedSegmentIds, angleMeasurements, onSegmentsChange, onSelectedSegmentIdsChange, onAngleMeasurementsChange]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ touchAction: 'none' }}
    >
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-semibold">Graph Workspace</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Exit
          </Button>
        </div>
        
        {/* Question text (collapsible) */}
        {questionText && (
          <div 
            className={cn(
              "px-4 pb-3 cursor-pointer select-none",
              isQuestionExpanded ? "" : "max-h-[3.5rem] overflow-hidden"
            )}
            onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
          >
            <div className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2 border border-border/50">
              <span className="flex-1">
                <span className="font-medium text-foreground mr-1">Q:</span>
                <span className="text-muted-foreground">
                  {isQuestionExpanded ? questionText : truncatedQuestionText}
                </span>
              </span>
              {truncatedQuestionText !== questionText && (
                <span className="flex-shrink-0 text-primary">
                  {isQuestionExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main scrollable content area */}
      <ScrollArea className="flex-1">
        <div className="p-4 flex flex-col gap-4">
          {/* Toolbar */}
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-2 -mt-2 z-10">
              <Button
                variant="outline"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={onClearAll}
                disabled={!canClear}
                title="Clear all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              
              <Button
                variant={eraseMode ? "default" : "outline"}
                size="icon"
                onClick={() => {
                  setEraseMode(!eraseMode);
                  setActiveDragPointId(null);
                }}
                title={eraseMode ? "Exit erase mode" : "Erase mode"}
                className={eraseMode ? "bg-destructive hover:bg-destructive/90" : ""}
              >
                <Eraser className="h-4 w-4" />
              </Button>

              {isJoinModeEnabled && onJoinModeChange && (
                <ToggleGroup
                  type="single"
                  value={currentJoinMode || ''}
                  onValueChange={(value) => {
                    setActiveDragPointId(null);
                    
                    if (value === '' || value === currentJoinMode) {
                      onJoinModeChange(null);
                      setSelectedJoinPoints([]);
                      if (onSelectedSegmentIdsChange) {
                        onSelectedSegmentIdsChange([]);
                      }
                    } else if (value === 'straight' || value === 'curved' || value === 'freeform' || value === 'angle') {
                      onJoinModeChange(value);
                      setSelectedJoinPoints([]);
                      if (onSelectedSegmentIdsChange) {
                        onSelectedSegmentIdsChange([]);
                      }
                      setEraseMode(false);
                    }
                  }}
                  className="ml-auto flex-wrap"
                >
                  <ToggleGroupItem value="straight" aria-label="Straight lines" disabled={isAngleMode}>
                    <Minus className="h-4 w-4 mr-1" />
                    Straight
                  </ToggleGroupItem>
                  <ToggleGroupItem value="curved" aria-label="Curved lines" disabled={isAngleMode}>
                    <Spline className="h-4 w-4 mr-1" />
                    Curved
                  </ToggleGroupItem>
                  <ToggleGroupItem value="freeform" aria-label="Freeform drawing" disabled={isAngleMode}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Freeform
                  </ToggleGroupItem>
                  <ToggleGroupItem value="angle" aria-label="Angle measurement">
                    <Ruler className="h-4 w-4 mr-1" />
                    Angle
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
          )}

          {/* Helper text */}
          {!readOnly && (
            <p className="flex-shrink-0 text-sm text-muted-foreground">
              {eraseMode ? (
                'Tap a point, line, or angle label to delete it. Tap the eraser icon again to exit.'
              ) : activeDragPoint ? (
                `Drag mode active for (${activeDragPoint.x}, ${activeDragPoint.y}). Drag to move, tap the point or empty space to exit.`
              ) : isAngleMode ? (
                selectedSegmentIds.length === 0 ? (
                  angleMeasurements.length > 0
                    ? `${angleMeasurements.length} angle(s) saved. Tap two connected lines to add another.`
                    : 'Tap two connected lines to measure the angle between them.'
                ) : selectedSegmentIds.length === 1 ? (
                  'Tap another connected line to complete the measurement.'
                ) : (
                  'Angle saved! Tap another pair of lines to add more.'
                )
              ) : isJoinModeActive ? (
                currentJoinMode === 'freeform' ? (
                  'Click and drag on the graph to draw lines.'
                ) : selectedJoinPoints.length === 0 ? (
                  `Tap a point to select it for joining. Deselect the mode to add points.`
                ) : selectedJoinPoints.length === 1 ? (
                  `Point (${selectedJoinPoints[0].x}, ${selectedJoinPoints[0].y}) selected. Tap another point to connect.`
                ) : (
                  'Creating segment...'
                )
              ) : (
                'Tap to plot points. Hold a point to drag it.'
              )}
            </p>
          )}

          {/* Graph using GraphCanvasPlot - Desmos-style camera renderer */}
          <div 
            ref={chartContainerRef}
            className="relative w-full border rounded-lg bg-card select-none overflow-hidden"
            style={{ 
              touchAction: 'none', 
              WebkitUserSelect: 'none',
              userSelect: 'none',
              // Square-ish aspect ratio for proper sketching
              minHeight: 'min(80vw, max(500px, calc(100vh - 280px)))',
              aspectRatio: '1 / 1',
              maxWidth: '100%',
            }}
          >
            {chartContainerSize.width > 0 && chartContainerSize.height > 0 && (
              <GraphCanvasPlot
                key={`expanded-canvas-${questionId}`}
                width={chartContainerSize.width}
                height={chartContainerSize.height}
                config={config}
                domainX={domainX}
                domainY={domainY}
                studentPoints={studentPoints}
                segments={segments}
                drawnPaths={drawnPaths}
                joinMode={joinMode}
                referenceSeries={referenceSeries}
                expectedCurveSeries={expectedCurveSeries}
                markingData={markingData}
                subjectColor={subjectColor}
                readOnly={readOnly}
                showCorrectAnswers={showCorrectAnswers}
                panZoomEnabled={true}
                eraseMode={eraseMode}
                angleMeasurements={angleMeasurements}
                selectedSegmentIds={selectedSegmentIds}
                activeDragPointId={activeDragPointId}
                draggingPointId={draggingPointId}
                draggingPosition={draggingPosition}
                selectedJoinPoints={selectedJoinPoints}
                onAddPoint={!readOnly && !eraseMode && !isAngleMode && !isJoinModeActive ? addPoint : undefined}
                onDrawnPathsChange={onDrawnPathsChange}
                onSegmentClick={handleSegmentClick}
                bestFitLine={bestFitLine}
                expectedBestFit={expectedBestFit}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground">
              {studentPoints.length} point{studentPoints.length !== 1 ? 's' : ''} plotted
              {segments.length > 0 && ` • ${segments.length} segment${segments.length !== 1 ? 's' : ''}`}
            </p>
            <Button onClick={onClose} className="gap-2">
              <Check className="h-4 w-4" />
              Done
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default ExpandedGraphModal;
