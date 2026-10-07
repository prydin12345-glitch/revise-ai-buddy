# Brief for Codex: OCR A-level Biology Paper 3 (H420/03) Q2(b) chi-squared gate failure

## What happened
Generation of an OCR A-level Biology Paper 3 paper stopped at the answerability gate. Planned part Q2(b) (`unifiedSkill: 'statistical_analysis'`) failed three checks in `supabase/functions/_shared/ocr-alevel-biology-paper3-validation.ts` (`unifiedPartIssues`) and kept failing through 3 repair attempts:

1. `missing_required_resource` (line 46): one of seven presence regexes did not match.
2. `invalid_resource` (lines 47-49): df, critical value or 5% significance could not be parsed.
3. `answer_mismatch` (lines 51-53): `Final statistic: <n>` was not found in `correct_answer`, or did not match the table.

## Most likely cause: the regexes depend on word order and exact phrasing
The generation prompt (`ocr-alevel-biology-paper3-contract.ts` line 74) asks for the right content. But the validator only accepts one way of writing each item, so normal exam wording fails:

- Critical value: `critical value\s*(?:of|is|=|:)?\s*(\d+)` fails for "the critical value at p = 0.05 is 3.84", "critical value for 1 df is 3.841" (it captures **1**) and "χ² critical value (5%) = 5.99". If it gets NaN or the df number, check 2 fails.
- Degrees of freedom: `(?:degrees of freedom|df)\s*(?:of|is|=|:)?\s*(\d+)` fails for "there is 1 degree of freedom" and "df (n − 1) = 2", where the number comes first or is not directly next to the word.
- Significance: `significance(?: level)?\s*(?:of|is|=|:)?\s*(5%|0.05)` fails for "5% significance level", "p = 0.05" and "significance level of p = 0.05".
- Formula: `(χ²|chi-squared)[^\n]*=` must be on one line. LaTeX (`\chi^2`), `X²` or a formula on its own line fails.
- O/E definitions: these need `O` and "observed" on the **same line**. A definition list across lines fails.
- Final statistic: `correct_answer` must be a string with the exact label `Final statistic:`. If it is an object or array (the private key is often JSON), `key` becomes `''`. Labels like "χ² = 4.2" or "Final statistic = 4.2" also fail.
- The text searched is `assembledModelText(row)` plus the table caption only. If the model put the givens in `table_data.caption` aliases, `diagram_config`, or a shared stem from the parent Q2, the checks never see them.

Repair could not fix it because the repair message repeats only the generic error text. It never shows the expected sentence format, so the model rewrites in another style that also fails.

## Fix (structural only, never weaker)
1. **Investigate first:** get the rejected Q2(b) payload from the `extract-exam-questions` logs (request id around 2026-10-07 19:5x UTC). Confirm which regex failed before changing code.
2. **Make parsing order-independent** in a small helper, `parseChiSquaredGivens(text)`, inside the validation file:
   - df: accept `N degree(s) of freedom`, `degrees of freedom (…) = N` and `df = N`.
   - critical value: find "critical value" and take the first decimal in the window that is **not** the df or the significance value. Or accept any number within ±0.01 of `CHI_SQUARED_5_PERCENT[df]` near the phrase.
   - significance: accept `5%`, `0.05` or `p = 0.05` on either side of "significance/significant/level".
   - formula: also accept `\chi^2`, `X²` and `Σ(O−E)²/E` on any line. O/E: allow the definition anywhere in the text, not on the same line.
   - search the part text plus the table caption plus the parent group's shared stem.
3. **Final statistic:** normalise `correct_answer` (string, JSON string, or object with `working`/`answer` fields) to text. Accept `Final statistic:` / `=` and `χ² =` as a fallback label. Keep the tolerance check against the calculated statistic.
4. **Repair prompt:** when these codes fire for `statistical_analysis`, add one exact template to the repair note, for example:
   `Null hypothesis: … Use χ² = Σ(O − E)²/E, where O = observed and E = expected. Significance level = 5%. Degrees of freedom = k − 1 = N. Critical value = X.XXX.` plus key `Final statistic: Y.YY`.
5. **Do not loosen:** still require 5%, df = categories − 1, the correct critical value, integer observed counts, all expected counts ≥ 5, matching totals, and a statistic that matches the table.

## Tests (add to `supabase/tests/ocr-alevel-paper3.test.ts`)
- Accept: "1 degree of freedom", "critical value at p = 0.05 is 3.841", "5% significance level", a formula on a separate line, and an object `correct_answer` with `Final statistic: 2.4`.
- Still reject: wrong critical value (3.84 given for df 2), 1% significance, df ≠ k − 1, a wrong final statistic, and a missing null hypothesis.
- Run `npm run check`, then redeploy `extract-exam-questions` (shared modules go with it). Do not generate a paper automatically. The user will retry.
