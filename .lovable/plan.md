

# Enable LaTeX Math Rendering in AI-Generated Questions

## The Problem

The AI is explicitly told "NO LaTeX anywhere" and "NO backslashes" in the system prompt (line 934). A post-processing validator (`findStringViolations`) also rejects any string containing `$` or `\`. This forces formulas into ugly raw ASCII like `h_max = (m*u^2) / (2*(mg + R))`.

Meanwhile, the frontend `MathRenderer` component already fully supports KaTeX rendering with `$...$` (inline) and `$$...$$` (block) delimiters. It is already used everywhere questions are displayed (quiz, review, exam hub, feedback). So the rendering layer is ready -- the backend just needs to stop blocking LaTeX.

## The Fix (Two Files, Surgical Changes)

### File 1: `supabase/functions/generate-practice-questions/index.ts`

**A. Flip the prompt rules (lines 933-943)**

Replace the "CRITICAL OUTPUT RULES" block. Instead of banning LaTeX, instruct the AI to wrap all math in `$...$` for inline and `$$...$$` for standalone block equations.

New rules:
- Wrap ALL mathematical expressions in LaTeX delimiters: `$...$` for inline math, `$$...$$` for standalone equations
- Use proper LaTeX commands: `\frac{a}{b}`, `\sqrt{x}`, `x^{2}`, `\pi`, `\theta`, `\leq`, `\geq`, `\neq`, `\times`, `\div`, `\pm`
- Example: instead of `h_max = (m*u^2) / (2*(mg + R))`, output `$$h_{max} = \frac{mu^2}{2(mg + R)}$$`
- Do not output markdown code fences
- Do not output JSON as raw text

**B. Update the strict system message (line 1328)**

Change from "No LaTeX, no backslashes, ASCII only" to "Wrap all math in $...$ or $$...$$ LaTeX delimiters."

**C. Update the retry prompt (line 1332)**

Change from "No LaTeX. No backslashes. ASCII only." to "Return valid data. Use $...$ for inline math and $$...$$ for block math."

**D. Update `findStringViolations` (lines 1219-1223)**

Remove the checks that reject `$` and `\` characters. Keep the markdown fence check. Remove the ASCII-only check (LaTeX symbols like `\frac` are needed). The function should only flag markdown code fences.

**E. Remove `escapeBackslashesDeep` usage**

The sanitizer that double-escapes backslashes (lines 1243-1267) must be removed or made a no-op, since backslashes are now intentional LaTeX commands.

### File 2: No frontend changes needed

The `MathRenderer` component (already imported in `QuestionItem.tsx`, `TakePracticeQuiz.tsx`, `ReviewQuestions.tsx`, `ExamReview.tsx`, etc.) already:
- Detects `$...$` and `$$...$$` delimiters
- Renders inline math via `<InlineMath>`
- Renders block math via `<BlockMath>`
- Handles tables with embedded LaTeX
- Sanitizes output with DOMPurify

No frontend code needs to change. The moment the AI starts outputting `$\frac{mu^2}{2(mg+R)}$`, the existing renderer will display it as a proper fraction.

### Data Integrity (Graph Engine)

The `graphConfig`, `plottingAnswer`, and coordinate data are stored as JSON objects with numeric values -- they never go through `MathRenderer`. The LaTeX is only in text string fields (`question_text`, `feedback`, `worked_solution`, `correct_answer` when it is a text string for short-answer). Graph coordinate arrays, series data, and `markingFormula` strings are untouched because:
- `markingFormula` is consumed by the formula evaluator, not rendered as display text
- `expectedPath` coordinates are numeric arrays
- `graphConfig.series.data` is numeric

## Summary

| What | Change |
|---|---|
| AI prompt | Switch from "ban LaTeX" to "require LaTeX delimiters for all math" |
| String validator | Remove `$` and `\` rejection checks |
| Backslash escaper | Disable or remove |
| Frontend | Zero changes -- MathRenderer already handles everything |
| Graph engine | Zero changes -- numeric data is unaffected |

## Result

Before: `h_max = (m*u^2) / (2*(mg + R))`

After: A properly typeset fraction with subscripts, rendered by KaTeX in the browser, matching the textbook-quality image the user shared.

