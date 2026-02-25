

# Fix Economics Graph Generation: Math Accuracy, Terminology, and Currency Formatting

## Issues Identified

### Issue 1: Mathematical Outputs (Question 1c methodology)
The AI currently computes subsidy costs and surplus changes, but the user wants a **strict algebraic-first methodology** — solve simultaneous equations first, then use the graph purely as a visual aid. The prompt needs a stronger "algebraic derivation" mandate that applies to all non-math subjects (Economics, Science, etc.), ensuring the AI always shows step-by-step algebra in worked solutions and derives values from equations rather than reading from graphs.

### Issue 2: "Curve" vs "Line" Terminology (Question 2a)
The AI generates text like "Plot the supply **curve**" for linear functions like `P = 10 + 0.5Q`. This is mathematically misleading. The prompt must enforce: if the function is linear (degree 1), use "line" or "function" — never "curve."

### Issue 3: Currency `$` Conflicting with LaTeX `$` (Question 2b)
The question text `"$30 per unit"` contains a literal dollar sign `$30`. The MathRenderer's regex `$[^$]+$` greedily matches from `$30` all the way to the next `$` (the start of `$Q_D$`), creating garbled output. This is a **frontend parsing bug** — the regex cannot distinguish currency `$30` from LaTeX delimiters.

**Two-pronged fix needed:**
- **Backend (prompt):** Instruct the AI to never use a bare `$` for currency. Instead use `\$` or spell out the currency (e.g., "USD 30", "30 dollars").
- **Frontend (MathRenderer):** Improve the regex to skip `$` followed immediately by a digit (which is almost always currency, not LaTeX).

## Plan

### Change 1: Smarter LaTeX Regex in MathRenderer (Frontend)

**File: `src/components/MathRenderer.tsx`**

Update the math delimiter regex (used on lines 195, 200, 259, 274) to exclude currency patterns. Replace:
```
/(\$\$[^$]+\$\$|\$[^$]+\$)/g
```
With a regex that skips `$` immediately followed by a digit (currency like `$30`, `$5,000`):
```
/(\$\$[^$]+\$\$|\$(?!\d)[^$]+\$)/g
```

This single-character addition `(?!\d)` (negative lookahead for digit) prevents `$30` from being treated as a LaTeX opening delimiter, while still correctly matching `$Q_D$`, `$P_S$`, etc.

### Change 2: Algebraic-First Methodology Rule (Backend Prompt)

**File: `supabase/functions/generate-practice-questions/index.ts`**

Add to the non-math subject prompt section (around line 968):

- **"ALGEBRAIC DERIVATION FIRST" rule:** For all non-math subjects, the AI must solve equations algebraically in the worked_solution before referencing the graph. The worked solution must show: (1) set equations equal, (2) solve step-by-step, (3) state the answer, (4) note that the graph confirms visually. This applies to Economics, Physics, Chemistry — any subject with quantitative functions.
- **Welfare analysis formulas:** Explicitly list standard formulas: `Total Subsidy Cost = subsidy_per_unit × Q_new`, `ΔCS = 0.5 × (P_old - P_new) × (Q_old + Q_new)` so the AI uses the correct formulae rather than approximating.

### Change 3: Linear Terminology Enforcement (Backend Prompt)

**File: `supabase/functions/generate-practice-questions/index.ts`**

Add a terminology rule to the non-math prompt section:

- If a function is linear (degree 1, e.g., `P = 10 + 0.5Q`), the question text MUST use "line" or "function" — never "curve."
- "Curve" is only acceptable for genuinely non-linear relationships (quadratic, exponential, etc.).
- Examples: "Plot the supply **line**", "Plot the supply **function**", "The demand **line** is shown."

### Change 4: Currency Symbol Escaping Rule (Backend Prompt)

**File: `supabase/functions/generate-practice-questions/index.ts`**

Add a formatting rule:

- NEVER use a bare `$` symbol for currency in question_text, feedback, or worked_solution. The `$` character is reserved for LaTeX delimiters.
- For currency, use: `\\$30` (escaped dollar), or write "30 dollars", "USD 30", "£30" (non-conflicting symbols).
- This prevents the LaTeX renderer from misinterpreting currency amounts as math expressions.

### Files Modified

| File | Changes |
|---|---|
| `src/components/MathRenderer.tsx` | Update math regex with `(?!\d)` negative lookahead to skip currency `$` patterns (lines 195, 200, 259, 274) |
| `supabase/functions/generate-practice-questions/index.ts` | Add algebraic-first rule, welfare formulas, linear terminology enforcement, and currency escaping rule to the non-math prompt section |

### What This Does NOT Touch
- Graph rendering components — no changes
- Database schema — no changes  
- Math subject generation — unaffected (rules only activate for non-math subjects)
- Existing quiz data — unmodified (fixes apply to future generations)

