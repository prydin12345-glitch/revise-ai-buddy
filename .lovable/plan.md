

# Add Master Test Templates and Fix Smooth Curve Support for Non-Math Subjects

## Problem

The current prompt has a hard rule for non-math `graph_plotting`: "NEVER use polynomial functions — only straight-line segments." This works for distance-time journeys but breaks for:
- **Exponential decay** (Physics half-life) — should be a smooth curve, not jagged segments
- **Break-even analysis** (Business) — linear lines are fine, but the system needs a dedicated template

Additionally, the three "Master Prompts" described by the user expose gaps:
1. **Dual-Shift** (S, S₁, D with tax shift) — no dedicated gold standard for shifted supply with exact tax amount
2. **Asymptotic Decay** — exponential curves are forbidden by the discrete-path rule
3. **Linear Intercept** (Break-even) — no gold standard for Fixed Cost / Total Cost / Total Revenue overlay

## Plan

### Change 1: Introduce "Smooth Curve Mode" for Non-Math Interpretation Graphs

**File: `supabase/functions/generate-practice-questions/index.ts`** (~line 1071)

Before the "DISCRETE PATH MODE" section, add a new block distinguishing two modes:

- **graph_interpretation** (pre-drawn, student reads): ALWAYS use dense data points (15-30) for smooth curves. Exponential, logarithmic, and curved data is allowed and encouraged. The current economics gold standards already do this correctly.
- **graph_plotting** (student draws): Keep discrete path mode for piecewise journeys (distance-time, speed-time). But add a NEW exception: if the question involves a smooth mathematical relationship (exponential decay, quadratic, rate curves), the AI should provide `expectedCurve` with dense data points AND set `curveJoinMode: "smooth"` so the review rendering uses Catmull-Rom interpolation.

### Change 2: Add Three Gold Standard Templates

**File: `supabase/functions/generate-practice-questions/index.ts`** (inside the non-math prompt section, ~line 1043)

Add three new gold standards after the existing economics ones:

**A) Dual-Shift Tax Template** (Economics graph_interpretation):
- D, S, and S₁ (shifted up by tax per unit)
- Two equilibrium projection annotations (E, E₁)  
- interpretationFields asking for consumer tax burden calculation

**B) Exponential Decay Template** (Physics/Science graph_interpretation):
- Smooth decay curve: `A = A₀ × (0.5)^(t/t_half)` with 20+ computed data points
- Grid scaled for half-life reading (e.g., X-axis to 200s, Y-axis to 800)
- interpretationFields asking student to read activity at a given time

**C) Break-Even Template** (Business graph_interpretation):
- Three series: Fixed Cost (horizontal), Total Cost (sloped), Total Revenue (steeper slope)
- Projection annotation at break-even intersection
- interpretationFields asking for break-even quantity and margin of safety

### Change 3: Relax Discrete Path Rule for Curved Physics/Science Graphs

**File: `supabase/functions/generate-practice-questions/index.ts`** (~line 1111)

Modify the "ABSOLUTE RULES FOR NON-MATH GRAPH PLOTTING" section to add an exception:

```
EXCEPTION — SMOOTH CURVE PLOTTING (exponential, logarithmic, rate curves):
If the question requires plotting a smooth mathematical curve (e.g., radioactive decay, 
enzyme kinetics, charging/discharging curves):
- Use graph_interpretation with pre-drawn curve data (15-30 points) instead of graph_plotting
- The student READS from the pre-drawn curve, not draws it
- This avoids jagged straight-line rendering for naturally curved relationships
- Reserve graph_plotting ONLY for piecewise linear journeys (distance-time, speed-time, 
  supply/demand lines)
```

### Change 4: Add Exponential Curve Generator to Graph Validator Fallback

**File: `supabase/functions/_shared/graph-validator.ts`**

In `generateFallbackGraphSpec`, add detection for exponential/decay keywords in question text. If detected, generate a smooth exponential decay curve `A₀ × 0.5^(t/t_half)` with 25+ points instead of defaulting to a parabola.

### Files Modified

| File | Changes |
|---|---|
| `supabase/functions/generate-practice-questions/index.ts` | Add 3 gold standard templates, add smooth-curve exception to discrete path rules, clarify interpretation vs plotting for curved relationships |
| `supabase/functions/_shared/graph-validator.ts` | Add exponential decay fallback curve generator |

### What This Fixes
- **Dual-Shift test**: AI has an exact template for tax-shifted supply curves with projection annotations
- **Asymptotic Decay test**: Exponential curves are now routed to `graph_interpretation` (pre-drawn smooth curve) instead of broken `graph_plotting` with jagged lines
- **Linear Intercept test**: AI has an exact template for break-even analysis with three overlaid lines
- No changes to rendering components — all fixes are prompt-side and fallback-side

