

# Fix Math-Visual Mismatch in Economics/Science Graphs

## Root Cause (Confirmed from Database)

The database shows that ALL three economics graph questions (2a, 2b, 4) contain **identical** `y = x^2` parabola data with domain [-4, 4] and labels "x"/"y" -- despite the question text describing linear Supply/Demand equations like `P_D = 150 - 3Q`.

The failure chain:
1. The AI outputs `correct_answer` as an invalid JSON string (logs: `"correct_answer is not valid JSON"`)
2. The non-math enforcement logic (line 1618) can't parse it, skips
3. The validation step sets `hasValidData = false`
4. The coordinate extractor finds no `(x, y)` patterns in economics text (which uses `P = 150 - 3Q` format, not coordinate pairs)
5. `generateFallbackGraphSpec()` in `graph-validator.ts` runs and detects no function type keywords, falling to the **default case: `y = x^2` parabola** (line 326)
6. This generic parabola completely replaces the economics graph data

So the user's diagnosis is correct: the AI's "correct_answer" JSON fails validation, and the fallback system always produces a parabola regardless of subject.

## The Fix (3 Changes)

### Change 1: Add Economics/Science-Aware Fallback to `graph-validator.ts`

**File: `supabase/functions/_shared/graph-validator.ts`**

Before the default `y = x^2` fallback (line 326), add detection for linear economics equations:

- Detect patterns like `P = 150 - 3Q`, `P_D = 30 + 2Q`, `Y = mX + c` in the question text
- Extract slope and intercept from the equation
- Generate linear data points with correct domain (e.g., Q from 0 to 60 for `P = 150 - 3Q`)
- Support multiple equations in one question (Supply AND Demand) with different colors
- Use economics-appropriate axis labels ("Quantity (Q)" / "Price (P)") instead of "x"/"y"

This ensures that even when the AI's JSON fails, the fallback produces a correct linear graph.

### Change 2: Add Linear Equation Extraction to the Coordinate Extractor

**File: `supabase/functions/generate-practice-questions/index.ts` (lines 2520-2550)**

The current coordinate extractor only looks for `(x, y)` patterns. Add parsing for:
- `P = 150 - 3Q` format: extract intercept=150, slope=-3, calculate points
- `P_S = 30 + 2Q` format: same extraction
- `C = aQ + b` and similar economics notation
- When detected, generate the correct `expectedPath` directly from the equation

### Change 3: Add a Linear Economics Gold Standard Example to the Prompt

**File: `supabase/functions/generate-practice-questions/index.ts` (around line 1014)**

After the existing Physics gold standard, add a Supply/Demand gold standard that shows:
- Economics axis labels with units ("Quantity (units)" / "Price ($)")
- Correct domain scaling (e.g., domainX: [0, 60], domainY: [0, 160])
- Multi-series with colors for Supply and Demand
- `graph_interpretation` type (not plotting) since students read from pre-drawn curves
- Linear data points computed from the equations

Also add a strict instruction:
> "CRITICAL: For economics linear equations like P = a - bQ, the data points MUST be calculated from the equation. If P = 150 - 3Q, then at Q=0 P=150, at Q=10 P=120, at Q=50 P=0. NEVER use parabolic or curved data for linear equations."

### Change 4: Dynamic Axis Scaling Rule

In the prompt instructions (around line 961), add:
> "Axis domains MUST encompass the full range of the equation. If P-intercept is 150, domainY must extend to at least 160. If Q-intercept is 50, domainX must extend to at least 55. NEVER use default [-4,4] or [0,10] domains for economics graphs."

## Technical Details

### Linear equation parser (for Change 1 and 2)

```text
Regex patterns to add:
  /(?:P|P_[DS]|Y|C)\s*=\s*(-?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*Q/i
  /(?:P|P_[DS]|Y|C)\s*=\s*(\d+(?:\.\d+)?)\s*Q\s*([+-])\s*(\d+(?:\.\d+)?)/i

For P = 150 - 3Q:
  intercept = 150, slope = -3
  Q range: 0 to ceil(150/3) = 50
  Points: [{x:0, y:150}, {x:10, y:120}, {x:20, y:90}, {x:30, y:60}, {x:40, y:30}, {x:50, y:0}]
```

### Files Modified

| File | Changes |
|---|---|
| `supabase/functions/_shared/graph-validator.ts` | Add linear equation detection before default parabola fallback; economics-aware axis labels |
| `supabase/functions/generate-practice-questions/index.ts` | Add economics gold standard example; add linear equation extraction to coordinate parser; add axis scaling instruction |

### What This Does NOT Touch

- Frontend rendering components -- zero changes
- Graph marking engine -- zero changes
- Database schema -- no changes
- Math subject graph generation -- unaffected (the new logic only activates for non-math subjects with linear equation patterns)

