
# Fix Economics Graph Generation Timeout + Add Multi-Colored Lines with Legend

## Problem Analysis

**Root Cause of Infinite Generation**: The AI generation is timing out on all 3 attempts (90s, 120s, 150s). The logs confirm: `AI request timed out after 150s (model=openai/gpt-5-mini)`. This happens because:

1. **Massive prompt size**: The economics graph prompt includes enormous instruction blocks (non-math discrete path rules, gold standard examples, command verb tables, transformation instructions) -- easily 4000+ tokens of system instructions
2. **Tool calling overhead**: The function schema itself is large, and combined with the huge prompt, causes the AI to take too long to respond
3. **Wrong model for the job**: The fallback chain uses `openai/gpt-5-mini` as the final attempt, which is slower than Gemini Flash for structured output generation

**Secondary issue**: The `findStringViolations` error message on line 1560 still says "LaTeX/backslashes/non-ASCII" but the actual function (lines 1210-1231) was already updated to only check markdown fences. This is just a misleading error message but not the blocker.

## Plan

### Part 1: Fix Timeout (Edge Function)

**File: `supabase/functions/generate-practice-questions/index.ts`**

**A. Increase timeouts for graph-heavy subjects**

Update the timeout chain (line 1341) to be more generous when graph questions are expected:
- Attempt 1: 120s (up from 90s)
- Attempt 2: 150s (up from 120s)  
- Attempt 3: 180s (up from 150s)

**B. Use faster model chain for economics/science**

Replace `openai/gpt-5-mini` (final fallback) with `google/gemini-2.5-flash` for all 3 attempts. Gemini Flash handles structured JSON tool calls significantly faster than GPT-5-mini, especially with large prompts. The chain becomes:
- Attempt 1: `google/gemini-2.5-flash`
- Attempt 2: `google/gemini-2.5-flash`
- Attempt 3: `google/gemini-2.5-flash` (same model, retry -- transient failures are common)

**C. Fix misleading error message**

Update line 1560 from `'AI returned forbidden characters (LaTeX/backslashes/non-ASCII)'` to `'AI returned forbidden characters (markdown fences)'` to match the actual check.

### Part 2: Multi-Colored Reference Lines

The `GraphSeries` type already supports `color?: string` and `label: string`. The `GraphRenderer` (used for interpretation graphs) already renders a Recharts `<Legend>`. However, `GraphCanvasPlot` (used for plotting graphs) has no legend.

**A. Update AI prompt to support multi-series economics graphs**

**File: `supabase/functions/generate-practice-questions/index.ts`**

Add instruction in the non-math graph section telling the AI it can generate multiple series in `graphConfig.series` for interpretation graphs (e.g., Supply and Demand curves), each with a distinct `color` and `label`. Provide a color palette: `#3b82f6` (blue), `#ef4444` (red), `#22c55e` (green), `#f59e0b` (amber), `#8b5cf6` (purple).

Example added to prompt:
```
For economics graphs with multiple curves (e.g., Supply & Demand):
- Use multiple entries in series[] with different colors and labels
- Example: [
    {"id": "supply", "label": "Supply", "data": [...], "color": "#3b82f6", "showLine": true},
    {"id": "demand", "label": "Demand", "data": [...], "color": "#ef4444", "showLine": true}
  ]
```

**B. Add Legend to GraphCanvasPlot**

**File: `src/components/graph/GraphCanvasPlot.tsx`**

Add a small legend/key overlay when multiple reference series exist. Render it as a small box in the top-right corner of the graph showing each series label with its corresponding color swatch. This only appears when there are 2+ reference series with labels.

The legend will be an SVG group positioned inside the graph canvas (top-right), showing:
- A small colored line segment matching each series color
- The series label text next to it
- Semi-transparent background for readability

**C. Render reference series with their actual colors**

Currently line 522 overrides series colors with a ghost opacity style. Update this so that when NOT in review mode, reference series use their own `series.color` if provided (for pre-populated interpretation/multi-curve graphs), falling back to the current ghost style only when no color is set.

### Part 3: Ensure Colors Carry Through for Plotting Graphs

For `graph_plotting` questions where `series` has pre-populated data with colors (e.g., an economics graph showing Supply/Demand where the student plots an equilibrium point), the `GraphPlottingQuestion` component already passes `referenceSeries` to `GraphCanvasPlot`. No additional wiring is needed -- the legend and color rendering from Part 2 will automatically apply.

## Files Modified

| File | Changes |
|---|---|
| `supabase/functions/generate-practice-questions/index.ts` | Increase timeouts, fix model chain, add multi-series prompt instructions, fix error message |
| `src/components/graph/GraphCanvasPlot.tsx` | Add legend overlay for multi-series graphs, respect series colors in non-review mode |

## What This Does NOT Touch

- Graph coordinate data, marking engine, formula evaluator -- zero changes
- Frontend quiz/exam rendering pipeline -- no structural changes
- Database schema -- no changes needed
