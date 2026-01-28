
# Mathematical Graph Engine - Refined Implementation Plan

## Current System Analysis

After thorough exploration, the current system works as follows:

**Generation Pipeline:**
1. AI model generates questions with `graphConfig` containing `series.data` arrays
2. Post-processing validates and attempts to repair missing data using regex-based function parsing
3. Transformations are parsed from question text (e.g., `f(x+3)`, `-f(x)`) and applied to curve data
4. Fallback logic generates generic curves when AI fails

**Current Problems:**
- AI often returns empty `graphConfig` and post-processing guesses curves
- Transformation parsing is fragile (regex-based string parsing)
- Discontinuity handling is hardcoded for specific patterns (e.g., `1/(x(x-1)(x-2))`)
- Graph grading uses strict point-matching with no sketch tolerance
- Complex functions can fail silently or produce invalid curves

## Refined Architecture

Based on your feedback, the improved architecture separates concerns:

```text
┌─────────────────────────┐
│      AI Model           │
│ (generates questions +  │
│  structured function    │
│  definitions)           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Structured Schema     │
│ • baseFunction string   │
│ • transforms object     │
│ • sketchMode flag       │
│ • givenGraph flag       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Math Engine           │
│ • Evaluates f(x)        │
│ • Detects discontinuities│
│ • Applies transforms    │
│ • Generates curve data  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Canonical graphConfig │
│ • domain, branches      │
│ • key features stored   │
│ • marking tolerances    │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌─────────┐   ┌─────────────┐
│ Renderer│   │Feature Marker│
│(frontend)│  │(sketch grading)│
└─────────┘   └─────────────┘
```

## Implementation Phases

### Phase 1: Create Math Engine with Safe Grammar

**New file: `supabase/functions/_shared/math-engine.ts`**

Instead of parsing arbitrary expressions, use a restricted mini-grammar:

```typescript
// Supported function types (expandable later)
type FunctionType = 
  | { type: 'polynomial'; coefficients: number[] }  // [a0, a1, a2, ...] for a0 + a1*x + a2*x^2
  | { type: 'factored_cubic'; roots: number[] }     // x(x-r1)(x-r2)
  | { type: 'quadratic_factor'; vertex: number; root: number } // (x-v)^2(x-r)
  | { type: 'reciprocal'; inner: FunctionType }     // 1/f(x)
  | { type: 'constant'; value: number };

// Transforms as structured data (not string parsing)
interface TransformSpec {
  shiftX: number;      // f(x - a) = shift RIGHT by a
  shiftY: number;      // f(x) + a = shift UP by a
  scaleY: number;      // a*f(x) = stretch vertically by a
  scaleX: number;      // f(a*x) = compress horizontally by a
  reflectX: boolean;   // -f(x) = reflect in x-axis
  reflectY: boolean;   // f(-x) = reflect in y-axis
}
```

**Key functions:**

```typescript
// Evaluate function at a point
function evaluate(fn: FunctionType, x: number): number | null;

// Detect discontinuities by sampling (not symbolic solving)
function findDiscontinuities(
  fn: FunctionType, 
  domain: [number, number],
  sampleDensity: number
): number[];

// Generate curve data with automatic branch splitting
function generateCurveData(
  fn: FunctionType,
  domain: [number, number],
  transforms: TransformSpec
): GraphSeries[];

// Apply transformation to existing curve data
function applyTransform(
  series: GraphSeries[], 
  transforms: TransformSpec
): GraphSeries[];
```

**Discontinuity detection via sampling:**
- Sample function across domain at high density
- Detect discontinuities via:
  - `NaN` or `Infinity` values
  - Massive jumps (e.g., `|y[i] - y[i-1]| > 50`)
  - Sign flips with huge magnitudes
- Split into branches at detected discontinuities

### Phase 2: Update AI Prompt for Structured Output

**Update: `generate-practice-questions/index.ts`**

Modify prompt to return structured function definitions:

```json
{
  "graphQuestion": {
    "baseFunction": "factored_cubic",
    "functionParams": { "roots": [0, -2, 1] },
    "transforms": {
      "shiftX": 0,
      "shiftY": 0,
      "scaleY": 1,
      "scaleX": 1,
      "reflectX": false,
      "reflectY": false
    },
    "sketchMode": true,
    "givenGraph": true,
    "studentTask": "sketch_transformed"
  }
}
```

**Task types:**
- `sketch_from_equation`: Blank grid, student sketches from equation
- `sketch_transformed`: Show original f(x), student sketches transformed curve
- `plot_points`: Student plots specific coordinate points
- `read_values`: Interpretation question (read values from given graph)

### Phase 3: Canonical graphConfig Storage

Store complete question metadata for deterministic rendering and marking:

```typescript
interface CanonicalGraphConfig {
  // Function definition
  functionDef: FunctionType;
  transforms: TransformSpec;
  
  // Pre-computed curve data
  baseCurveBranches: GraphSeries[];  // Original f(x)
  transformedBranches: GraphSeries[]; // After transformation
  
  // Domain and key features
  domain: { x: [number, number]; y: [number, number] };
  asymptotes: { vertical: number[]; horizontal: number[] };
  intercepts: { x: number[]; y: number };
  turningPoints: Array<{ x: number; y: number; type: 'max' | 'min' }>;
  
  // Marking configuration
  sketchMode: boolean;
  givenGraph: boolean;
  markingTolerance: {
    intercepts: number;      // ±1 unit for intercept regions
    turningPoints: number;   // ±1 unit for turning points
    asymptoteAvoidance: number; // Must not cross within this distance
  };
}
```

### Phase 4: Feature-Based Sketch Marking

**Update: `grade-practice-question/index.ts`**

Replace strict point-matching with checkpoint-based marking:

```typescript
interface SketchMarkingResult {
  // Shape check: Does curve have correct number of turning points?
  shapeCorrect: boolean;
  shapeMarks: number;
  
  // Intercept check: Points within tolerance of expected intercepts?
  interceptsCorrect: boolean;
  interceptMarks: number;
  
  // Asymptote check: No points crossing forbidden zones?
  asymptoteRespected: boolean;
  asymptoteMarks: number;
  
  // Orientation check: Curve in correct quadrants at extremes?
  orientationCorrect: boolean;
  orientationMarks: number;
  
  totalScore: number;
  totalMarks: number;
}
```

**Marking rubric (configurable per question):**
- 1 mark: Correct general shape (number of turning points, overall direction)
- 1 mark: Correct intercept regions (x-intercepts within ±1 unit)
- 1 mark: Correct asymptote behaviour (no points crossing forbidden zones)
- 1 mark: Correct orientation at edges (curve in correct quadrants)

**Implementation approach:**
- Extract features from student's plotted curve
- Compare against expected features with tolerance
- Award partial marks for each correct feature

### Phase 5: Sketch Mode Logic

**Update: `TakePracticeQuiz.tsx`**

Handle two sketch scenarios:

```typescript
// Determine sketch behaviour from question metadata
const questionMeta = graphData?.graphQuestion;

if (questionMeta?.sketchMode) {
  if (questionMeta.givenGraph) {
    // Show original f(x), hide transformed curve until review
    referenceSeries = baseCurveBranches;
    expectedCurveSeries = isReviewMode ? transformedBranches : [];
  } else {
    // Blank grid for "sketch from equation"
    referenceSeries = [];
    expectedCurveSeries = isReviewMode ? transformedBranches : [];
  }
}
```

### Phase 6: Complexity Validation

**Smarter downgrade heuristics:**

```typescript
function isSketchable(fn: FunctionType, domain: [number, number]): {
  sketchable: boolean;
  reason?: string;
} {
  const discontinuities = findDiscontinuities(fn, domain, 100);
  const visibleAsymptotes = discontinuities.filter(
    d => d > domain[0] && d < domain[1]
  );
  
  // Rule 1: More than 2 asymptotes in visible range = too complex
  if (visibleAsymptotes.length > 2) {
    return { 
      sketchable: false, 
      reason: 'Too many asymptotes for freehand sketch' 
    };
  }
  
  // Rule 2: Reciprocal of polynomial degree >= 3 with multiple roots
  if (fn.type === 'reciprocal') {
    const inner = fn.inner;
    if (inner.type === 'polynomial' && inner.coefficients.length > 3) {
      return { 
        sketchable: false, 
        reason: 'Complex reciprocal function' 
      };
    }
  }
  
  return { sketchable: true };
}
```

When not sketchable, automatically:
- Downgrade to feature-based question (identify intercepts, asymptotes)
- Remove "sketch" instruction from question text
- Use text/coordinate input instead of interactive graph

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/math-engine.ts` | Centralised math utilities: evaluation, discontinuity detection, curve generation, transformation application |

## Files to Update

| File | Changes |
|------|---------|
| `supabase/functions/generate-practice-questions/index.ts` | Update AI prompt for structured output; use math engine for curve generation; add complexity validation |
| `supabase/functions/_shared/graph-validator.ts` | Use math engine for fallback generation instead of inline regex parsing |
| `supabase/functions/grade-practice-question/index.ts` | Add feature-based sketch marking with tolerance; checkpoint-based rubric |
| `src/pages/TakePracticeQuiz.tsx` | Handle `sketchMode` + `givenGraph` flags for correct display logic |
| `src/components/graph/GraphPlottingQuestion.tsx` | Ensure `connectNulls={false}` for all Line components; verify multi-branch rendering |

## Migration Approach

1. **Create math-engine.ts** with core utilities first
2. **Update generation pipeline** to use structured output + math engine
3. **Test with existing practice sets** - backward compatible rendering
4. **Add feature-based marking** for new questions
5. **Iterate based on results** - expand function grammar as needed

## Expected Outcomes

After implementation:

1. **Mathematically accurate curves** - All graphs computed from functions, not AI-guessed
2. **Reliable transformations** - Structured data instead of string parsing
3. **Proper discontinuities** - Sampling-based detection handles edge cases
4. **Sketch tolerance** - Feature-based marking allows reasonable leeway
5. **Smart downgrading** - Complex functions gracefully fall back to text questions
6. **Canonical storage** - Reproducible rendering and marking at any time
