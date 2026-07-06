## What I found

This does not look like the AI “lacking authority” to convert `5.1 / 5.2` into `5(a) / 5(b)`.

The more likely causes are:

1. **The saved format is contradictory**
   - `use_original_structure = true`, but `question_structure = standalone` is still being saved.
   - Even though the extractor has some compensation for this, the database still tells later steps/defaults that the exam is standalone.

2. **The uploaded AQA PDF uses numeric sub-part notation**
   - The attached PDF clearly uses grouped parts like:
     - `0 1 . 1`, `0 1 . 2`, `0 1 . 3`, `0 1 . 4`
     - `0 2 . 1`, `0 2 . 2`, etc.
   - These should be treated as parent Question 1 with parts `(a)-(d)`, parent Question 2 with parts `(a)-(d)`, etc.

3. **The generated insert prompt is hijacking the structure**
   - For recent exam `1G`, the extractor generated a Figure 1 insert and then strongly asked the AI to write `2-3` Figure 1 questions.
   - The saved output became exactly a small standalone set about the generated rainfall figure, not a mirrored AQA paper structure.

4. **There is no hard post-generation validation**
   - The prompt asks for original hierarchy, but if the AI returns flat questions, the app currently accepts them.
   - That is why repeated attempts can keep producing standalone questions.

## Plan to fix it

1. **Fix format saving**
   - Update `save-exam-format` so when no profile is selected and `useOriginal` is true, it saves a structure value that means “mirror original paper”, not `standalone`.
   - Keep profile-locked/custom formats unchanged.

2. **Add deterministic PDF structure detection**
   - In `extract-exam-questions`, parse the extracted PDF text before prompting.
   - Detect patterns like:
     - `0 1 . 1`, `01.1`, `1.1`, `5.2`
     - `1(a)`, `1 b`, `(i)/(ii)` where applicable
   - Convert detected numeric structures into canonical app numbering:
     - `0 1 . 1` → `1(a)`
     - `0 1 . 2` → `1(b)`
     - `0 2 . 1` → `2(a)`

3. **Pass a concrete structure blueprint to the AI**
   - Add a prompt block like:
     - Parent 1 has 4 parts: `1(a)-1(d)`, marks `4,6,6,20`
     - Parent 2 has 4 parts: `2(a)-2(d)`, marks `4,6,6,20`
   - This removes ambiguity around whether `5.1` is a decimal or a sub-question.

4. **Stop insert generation from overriding original structure**
   - When `use_original_structure = true`, generated insert guidance should support the detected structure rather than demand a small standalone Figure 1 set.
   - Figure questions can still exist, but they must sit inside the detected parent/part hierarchy.

5. **Add a validation/repair pass**
   - If original structure was detected and the AI returns only standalone questions, repair or reject that output before saving.
   - At minimum, renumber matching ordered outputs into canonical sub-parts and set:
     - `parent_question_number`
     - `root_question_number`
   - Log a clear line such as:
     - `[format] detected original structure: 5 parents, 20 parts`
     - `[format] repaired flat output into canonical sub-parts`

6. **Deploy and verify**
   - Deploy the extraction and format functions.
   - Run a fresh upload/extraction against this same June 2020 AQA Geography PDF.
   - Confirm the saved rows contain values like `1(a)` / `1(b)` and non-null `parent_question_number`.