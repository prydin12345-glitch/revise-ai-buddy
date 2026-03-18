

## Problem Diagnosis

I investigated the "Friday" exam (`e24efa45-...`) end-to-end. Here's what's happening:

### Issue 1: MCQ questions have sub-parts (1a, 1b instead of Q1, Q2)

**Root cause**: The `buildPrompt` function in `extract-exam-questions/index.ts` injects two conflicting instructions:

1. The **MCQ-only block** (line ~1146) correctly says: "MCQ questions are standalone — no sub-parts needed"
2. But the **hierarchical instructions** block (line ~1164) unconditionally says: "Each parent question MUST have at least 2 sub-parts that escalate in difficulty" — and includes examples like `"1a", "1b", "1c"`

The hierarchical block comes AFTER the MCQ block in the prompt, so the AI follows the last instruction and generates sub-parts for every MCQ. The profile metadata contains `questionStructure: "mcq_only"` but the edge function never reads this field to conditionally skip the hierarchical instructions.

### Issue 2: 48 questions instead of 24

**Direct consequence of Issue 1.** The profile specifies `mcq_count: 24`. The AI generates 24 parent questions — but with 2 sub-parts each (a, b), producing 48 rows. The trim logic on line ~263 only checks unique root numbers (24 roots = correct), but each root has 2 children, so 48 total questions are saved.

### Issue 3: AI hallucination on domain-specific content

The AI (Gemini Flash) generates plausible-sounding but potentially inaccurate content for niche subjects like sterilizer engineering. This is inherent to LLM generation. Mitigations:

- Lower the temperature for niche subjects (currently 0.3)
- Add a prompt instruction telling the AI to flag low-confidence questions
- Consider using a stronger model (Gemini Pro) for custom/niche subjects

---

## Plan

### Step 1: Conditionally skip hierarchical sub-part instructions for MCQ-only exams

In `supabase/functions/extract-exam-questions/index.ts`, modify the `buildPrompt` function:

- When the profile is MCQ-only (`desiredMcqCount > 0 && desiredWrittenCount === 0`), **skip** the `hierarchicalInstructions` block entirely and instead inject a flat numbering instruction: "Number each question as 1, 2, 3... Each is standalone with no sub-parts."
- For mixed exams, only apply hierarchical instructions to the written portion.

### Step 2: Add post-generation flattening safety net

After AI generation, if the profile is MCQ-only, strip any sub-part suffixes from question numbers:
- Rename `"1a"` → `"1"`, `"2a"` → `"2"`, discard `"1b"`, `"2b"` etc. (keep only the first sub-part per root)
- This ensures even if the AI ignores the prompt, the output is correct.

### Step 3: Improve niche subject accuracy

- Increase the AI model to `google/gemini-2.5-pro` when the subject is detected as a custom niche (non-standard academic subject) — stronger reasoning produces more accurate domain content.
- Add a prompt instruction: "If you are unsure about a technical fact, include `extraction_confidence: 0.5` so it can be flagged for review."

### Step 4: Redeploy the edge function

Deploy the updated `extract-exam-questions` function.

### Technical Details

**File**: `supabase/functions/extract-exam-questions/index.ts`

**Key change in `buildPrompt`** (~line 1163):
```text
// Before hierarchicalInstructions, check if MCQ-only
const isMcqOnly = desiredMcqCount > 0 && (desiredWrittenCount === 0 || desiredWrittenCount === null);

const hierarchicalInstructions = isMcqOnly
  ? `\nFLAT QUESTION STRUCTURE (MCQ-ONLY EXAM):\n- Each question is standalone. Number them 1, 2, 3, ..., ${desiredMcqCount}.\n- Do NOT create sub-parts (a, b, c). Each question_number is just "1", "2", "3".\n- Set parent_question_number to null and root_question_number to the question number.\n`
  : `... existing hierarchical block ...`;
```

**Post-generation safety net** (~line 262):
```text
// If MCQ-only, flatten sub-parts: keep first per root, renumber
if (desiredMcqCount > 0 && (desiredWrittenCount === 0 || !desiredWrittenCount)) {
  // deduplicate by root, keep first, renumber sequentially
}
```

**Model upgrade for niche subjects** (~line 1316):
```text
model: isCustomNicheForValidation ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash'
```

