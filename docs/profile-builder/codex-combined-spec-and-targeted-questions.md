# Codex task: combined AS/A-level specifications and targeted follow-up questions

## Problem 1 — combined specification is reported as a conflict
A student chose AQA A-level Physics (7408), Paper 1, and uploaded the official combined
specification `AQA-7407-7408-SP-2015.pdf`, which covers AS (7407) and A-level (7408).
Both have a "Paper 1". `profile-assessment-discovery.ts` (~line 474) then reports
"The sources list more than one version or component for the same assessment name",
and the builder stops with "The source contains conflicting or unsupported assessment
requirements".

Fix:
- When the student has already chosen a qualification and course code (or the catalogue
  resolved them), use that choice to disambiguate. Keep only assessment rows/sections that
  belong to the chosen course (7408) and ignore the other qualification's rows (7407) as
  out of scope instead of treating them as a conflict.
- Use headings ("AS", "A-level"), course codes and component codes ("7407/1" vs "7408/1")
  in the indexed pages to split the document. Never guess: if the split can't be made
  from the text, ask one targeted question (Problem 2) instead of failing.
- Apply this to every subject and board with combined specs (AQA, OCR, Edexcel, WJEC,
  and GCSE combined/separate science), not only Physics.
- Keep all existing gates; do not loosen evidence or version checks.
- Tests: synthetic combined AS/A-level pages for Physics, Biology and Chemistry; the exact
  wording above; an undecidable document must produce one targeted question that keeps
  the upload.

## Problem 2 — show only what is actually missing
Today any "needs details" result shows the full form again with a general message.
Wanted behaviour:
- The backend returns a structured list of missing items, each with: field key, a
  plain-language question, and allowed choices when they're known (for example the
  papers actually found in the PDF, or "AS 7407 / A-level 7408").
- The builder shows ONLY those items (a choice list, or a text box when choices are
  unknown), with everything else locked as a read-only summary with a "Change" link.
- Uploaded files, completed choices and the reading already done are kept; answering
  continues the same build without re-reading the PDF or another paid call where possible.
- One question at a time where answers depend on each other.
- Existing generic messages remain only as a fallback.
- Tests: needs_details with 1 and 2 missing items renders only those inputs; answering
  resumes the build; files persist; mobile, light and dark mode.

## Constraints
No migrations unless required (report first). No paid AI calls in tests. Do not publish
the website. After merge, Lovable deploys `profile-builder` only (plus any consumers listed
in the dependency graph).
