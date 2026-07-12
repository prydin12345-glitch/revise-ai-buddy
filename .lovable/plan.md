
# Practice Quiz Workspace — Principal-Level UX/UI Audit

Scope reviewed: `src/pages/TakePracticeQuiz.tsx`, `src/pages/ExamInProgress.tsx`, `src/components/quiz/PracticeQuizHeader.tsx`, `PracticeQuizSidebar.tsx`, `MathAnswerField.tsx`, `MathAnswerInput.tsx`, `MathKeypad.tsx`, `OnDemandRationaleBox.tsx`, `QuestionOptionsMenu.tsx`, and the surrounding `MathRenderer` / figure panels. No files will be modified in this pass.

---

## 1. The Comprehensive Critique (The Flaws)

### 1a. Typography & Math/LaTeX Integration
- **Two fonts fighting on one line.** Prose renders in the app sans (Inter-ish) at ~14px, while `MathRenderer` hands off to KaTeX which loads Computer Modern by default. Inline `$x$` sits taller and heavier than the surrounding text, with a visibly different x-height. It reads like a Word doc with equations pasted in from LaTeX — the exact "student typed math in a chat window" feel we're trying to avoid.
- **No optical size discipline.** Question stems, sub-part prompts, and inline math all share the same 14px baseline. Real assessment typography (Gradescope, Pearson, IB digital) uses a slightly larger, looser body (15–17px, 1.55–1.65 line-height) so multi-line derivations breathe.
- **Weight mismatch.** Question numbers use `font-semibold`, the stem is `font-normal`, and KaTeX renders math in medium/regular Computer Modern. The eye jumps between three weights inside a single sentence.
- **Baseline drift on fractions and subscripts.** Because KaTeX blocks lift above the cap height, `\frac`, `\sqrt`, and subscripts push line-height inconsistently — some rows are 20px tall, the next 32px. The card looks jittery.
- **No numeric tabular figures.** Marks ("3/5"), question counter ("Q 2 of 12"), and score chips use proportional digits, so numbers wobble between questions.

### 1b. Contrast & Legibility (Light + Dark)
- **Muted text is too muted.** Extensive use of `text-muted-foreground` for labels ("QUESTIONS", "Answered", "Flagged", counter text, marks chip). In dark mode this token resolves to roughly `hsl(215 20% 65%)` on a `hsl(222 47% 11%)` card — measured contrast ~3.2:1, below WCAG AA 4.5:1 for body text.
- **Card-on-card muddiness in dark mode.** `bg-card/50` sidebar sits on `bg-background`, and the question card sits on the sidebar column. Three near-identical slate layers with no elevation cue — the surfaces collapse visually.
- **Colored status pills lose contrast.** The `bg-orange-500 text-white` (partial credit) and `bg-green-500 text-white` sidebar buttons pass, but the ring accents (`ring-primary`, `ring-yellow-500`) on saturated fills disappear against the dark card. The current-question indicator is genuinely hard to find.
- **Placeholder text is invisible.** The math-field placeholder inherits `text-muted-foreground` at 50% opacity — closer to 2:1 contrast in dark mode. Students literally cannot see the prompt telling them what to do.
- **Subject color chips are used as backgrounds without a contrast guard.** The sidebar answered-state uses raw `subjectColor` (arbitrary hex) as a fill with hard-coded white text. Yellow/lime/cyan subjects blow out; navy/indigo look fine. The existing `getTextColor()` helper is not applied here.
- **Focus ring vs. current-selection ring collide.** Both are `ring-2 ring-primary ring-offset-2`. Keyboard users cannot tell "this is focused" from "this is the current question".

### 1c. Layout Redundancies & Visual Clutter
- **Section indicator repeated 3–4 times per question.** Header shows "Question 2a", the card title repeats "2a", the sidebar highlights "2a", the breadcrumb re-states "Part a", and the parent stem is re-echoed above every sub-part. That's four "a"s on one screen.
- **Parent stem re-printed on every sub-part.** For a Q with parts a–e, the shared stem is rendered five times, pushing the actual sub-question below the fold on laptop screens. A sticky parent-stem strip already exists on mobile — desktop still duplicates.
- **Metadata bar overload.** Above each question we currently stack: question chip, topic chip, subtopic chip, difficulty chip, marks chip, flag button, options menu, "AI generated" tag. Eight objects in one row, none dominant.
- **Vertical rhythm is arbitrary.** `space-y-4`, `gap-5`, `mb-3`, `pt-2 border-t`, `mt-auto` are mixed inside the same card. There is no 4/8/12/16 step; padding is negotiated per element.
- **Two separate scroll containers.** The outer page scrolls and the sidebar `ScrollArea` scrolls. On a trackpad, the wheel event bounces between them mid-scroll.

### 1d. The Input Area ("Your Answer")
- **Monospace + code-editor aesthetic.** `MathAnswerField` renders inside a bordered box with monospace fallback text and a chevron/keypad toggle floating in the corner. It reads like a REPL, not an exam answer sheet. Students showing 6 lines of working feel they're writing a config file.
- **No "answer paper" affordance.** There is no lined baseline, no visible working area, no distinction between "final answer" and "working". Everything is one flat textarea.
- **Mode toggle (math/text) is a raw button, not a labeled mode.** Users routinely enter text into the math field and see `\text{...}` swallow their sentence.
- **Keypad is a floating tool palette.** `MathKeypad` opens as a popover with a grid of LaTeX buttons in the same tone as the rest of the chrome — no separation between "content I'm writing" and "tools I'm using". Compare to Desmos' grounded, docked keypad.
- **Submit / Next / Flag / Save actions are scattered.** Submit is inside the card, Next is in the header, Flag is in the metadata row, Save & Quit is in the sidebar. Four action zones for four actions.
- **No visible marks target inside the input.** The student sees "3 marks" in a chip at the top, but the input itself gives no cue ("write ~3 lines of working"). Exam boards signal this with answer-space sizing.

### 1e. Sidebar Question Navigation
- **4-column grid of numbered squares is generic.** It reads like a Sudoku selector or seat-picker, not an exam navigator. It scales poorly past ~20 questions (wraps to 6+ rows) and hides the a/b/c hierarchy entirely — sub-parts are collapsed into a single tile.
- **No hierarchy of parent Q → sub-part.** A 5-question paper with parts a–d each becomes 20 identical squares. Students lose the mental model of "I'm on Q3, halfway through part b of 4".
- **Status is encoded only in fill color.** Colorblind users cannot distinguish "answered but not submitted" (subject color) from "fully correct" (green). No icon, no shape, no pattern.
- **Flag pip overlaps the number.** The `-top-1 -right-1` yellow badge lands on the numeric label on 2-digit questions (Q10+).
- **Section blocks are unlabelled.** The tiles are one continuous grid; there is no "Section A / Section B" divider even when the exam has sections in the schema.
- **Stats block reads like a form field.** "Answered 4/12 / Flagged 1 / Unanswered 8" in muted body text — no glanceability, no progress bar, no ring, nothing you can read from 6ft.

---

## 2. Dual-Mode Visual Strategy

### Light Mode — a "paper" mode, not a "flat white app"
- **Off-white workspace, white card.** Page background ~`hsl(220 20% 97%)` (warm off-white, matches existing brand token), question card `#FFFFFF` with a 1px `hsl(220 15% 90%)` hairline and a very soft `0 1px 2px rgba(15,23,42,0.04)` shadow. The card feels like a sheet lifted off the desk — no eye-searing full-white surface.
- **Ink, not black.** Body text at `hsl(222 30% 18%)` (near-ink), never `#000`. Headings at `hsl(222 47% 11%)`. Muted at `hsl(222 15% 40%)` (passes 4.5:1 on both surfaces).
- **Math sits on the same baseline as prose** by forcing KaTeX to inherit `font-size: 1em` and pinning its line-height. Fraction bars use `currentColor` at 90% weight, not KaTeX default.
- **Subject color used as an accent stripe** (left border, 3px) on the active question card — never as a full fill in the reading area.
- **Sidebar** uses `hsl(220 20% 97%)` = page color, so the workspace card is the elevated element. Reverse of today's "sidebar is darker than page".

### Dark Mode — premium monochrome, not marketing-purple
- **True-neutral slate scale**, not the current bluish `hsl(222 47% 11%)`. Suggested ramp (surfaces only, no hue rotation between them):
  - App bg: `hsl(220 8% 8%)`
  - Sidebar: `hsl(220 8% 10%)`
  - Card: `hsl(220 8% 13%)`
  - Card border: `hsl(220 6% 20%)`
  - Elevated (keypad, popover): `hsl(220 8% 16%)`
  Three unambiguous elevation steps, all achromatic.
- **Text ramp**: primary `hsl(210 15% 94%)`, secondary `hsl(210 12% 78%)`, muted `hsl(210 10% 62%)` (all AA on 13% surface).
- **Math renders crisper** on neutral gray than on blue-tinted slate — KaTeX glyphs are hairline serifs; blue backgrounds add perceived chromatic aberration.
- **Accent = the subject color, used sparingly**: current question ring, submit button, active sidebar tile. Everything else is grayscale.
- **No glow, no gradient chrome, no `bg-primary/10` washes** on the question card in dark mode. Save chroma for state, not decoration.
- **Status colors are muted in dark mode**: correct `hsl(142 45% 55%)`, partial `hsl(38 70% 60%)`, incorrect `hsl(0 65% 62%)` — saturated enough to read, dulled enough to not vibrate against near-black.

---

## 3. Four Premium Architectural Proposals

### Proposal A — "Paper Sheet" question card with typeset workings
Redefine the question card as an actual answer sheet:
- Single centered column, max-width ~720px, generous 40px side padding, 15px body / 1.6 line-height.
- Header collapses to **one line**: `Q2 (a)  ·  Kinematics  ·  3 marks`. Kill the other seven chips; move difficulty + AI-generated into an unobtrusive "i" tooltip.
- Parent stem shown **once** as a sticky, dimmed strip above the sub-part on both desktop and mobile. Sub-parts render only their own prompt.
- KaTeX pinned to inherit font-size and color; a global CSS override forces `.katex { font: inherit; }` for inline math and reserves the display font only for `$$…$$` blocks.
- Tabular numerals (`font-variant-numeric: tabular-nums`) applied to marks, counters, timers, and scores.

### Proposal B — Grounded "Answer Slate" input, not a code editor
Replace the floating math field + popover keypad with a docked answer slate:
- A full-width answer panel anchored to the bottom of the card, visually distinct via a subtle inset (slightly darker fill in light mode, slightly lighter in dark) and a top hairline — reads as "the paper you write on".
- Height scales with expected marks (1 mark → 1 line, 3 marks → 3 lines, essay → 6+). Explicit "answer space" affordance.
- Mode toggle becomes a segmented control at the top-left of the slate: `[ Math | Text ]`, clearly labeled. Not a floating icon.
- Math keypad **docks** below the slate when Math mode is active (like Desmos), never floats as a popover on desktop. On mobile, it slides up from the bottom edge, respecting safe area.
- Placeholder becomes real hint text at proper contrast: "Write your working here. Use the keypad for symbols."
- Working vs. Final Answer: for multi-mark questions, the slate is split into two zones with a light separator — "Working" (grows) and "Final answer" (single line, right-aligned). This mirrors physical exam papers and gives markers structure.

### Proposal C — Unified "Paper Index" sidebar (kill the tile grid)
Replace the 4-col numbered grid with a vertical, typeset index:
```
Section A · Mechanics
  1   Projectile motion              5 ✓
  2   Forces on incline
      a  Free-body diagram           2 ✓
      b  Coefficient of friction     3 ●
      c  Time to rest                2
  3   Momentum                       4
Section B · Waves
  4   Standing waves                 6
```
- Two-column rows: `[number]  [title]  [marks + status icon]`.
- Parent Q as a single row; sub-parts indented beneath, only expanded for the active parent (auto-collapse others).
- Status uses **icon + color**: `○` unanswered, `●` in-progress (subject color), `✓` correct, `◐` partial, `✗` incorrect. Colorblind-safe.
- Flags shown as a small pennant in a dedicated 16px column — never overlapping the number.
- Section headers are real headers, not stat labels — small caps, tabular, with per-section progress ("3 / 5 answered").
- Progress summary moves to the **top** of the sidebar as a single ring or bar with tabular counts, not a tiny key-value list at the bottom.

### Proposal D — Explicit Marks & Progress language everywhere
Bring exam-board rigor to the numeric UI:
- Every question header shows marks as an actual mark scheme cue: `[3 marks]` in tabular figures, right-aligned, same weight as body — not a chip.
- The answer slate footer shows `Awarded: — / 3` before submission and `Awarded: 2 / 3` after, replacing the current "score chip in the sidebar" model.
- Global header is reduced to three elements only: paper title, `Q 2 of 12`, and either a timer (exam) or a progress bar (practice). Everything else (subject, topic, exit) collapses into a single overflow menu.
- One canonical action zone: primary action (`Submit answer` / `Next`) lives at the bottom-right of the answer slate; secondary actions (Flag, Skip, Save & exit) live in the header overflow. Four action zones become two.
- Introduce a single elevation and radius scale used across card, slate, keypad, popovers: `radius-lg = 12px`, `radius-sm = 8px`, `shadow-1` for card, `shadow-2` for popover/keypad. Nothing else.

---

## Deliverable for This Pass
No code changes. Once you pick which proposals to pursue (A/B/C/D — any combination), the next step is to lock the dark-mode neutral ramp and the typography scale in `index.css`, then rebuild `PracticeQuizSidebar`, the question-card header, and the answer slate against those tokens. Awaiting your direction.
