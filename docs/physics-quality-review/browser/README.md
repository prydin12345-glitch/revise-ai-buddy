# Physics quality browser and PDF verification

This harness composes the actual exam rendering pieces (`MathRenderer`, `QuestionChart`, `LineChart`, `DataTableChart`, `getCircuitConfig` and `CircuitFigurePanel`) using original synthetic questions. It also calls the actual `generateExamPDF` with local `html2canvas` and `jsPDF`. The observer around `html2canvas` records the DOM and then delegates real rendering; it does not replace the canvas implementation.

All browser requests are intercepted. Only the local fixture origin and local font assets are served; external network requests are blocked. No real backend, login, paid model request, saved profile or live exam is used. Each render/PDF input question includes a synthetic `correct_answer` carrying `PRIVATE_KEY_SENTINEL`; the checks require that supplied private value to remain absent from visible DOM and PDF text when answer keys are disabled. These sentinels test rendering privacy, not scientific marking content. The private saved paper “popop” was unavailable, so these cases reproduce reported data shapes rather than claiming to replay its exact questions or corrected mark schemes.

The build resolves production Tailwind content paths against the repository and includes the fixture source; computed card padding/radius checks ensure utility styles are actually active. The matrix uses Chromium at 1440×1000, 834×1112, 390×844 and 320×780, each in light and dark mode. It checks question-text contrast on its actual card, graph labels and units, capacitor/search-coil ghost suppression, a figure-only measurements table with reachable uncertainty readings, retention and zoom of a real topology-dependent circuit, suppression of completed drawing answers, four distinct visible mathematical options and shared released-key matching (LaTeX/Unicode resolves uniquely; absent or ambiguous keys stay unresolved), no private answer disclosure, 150% browser zoom and print-media layout. Desktop cases also export real standalone PDFs, including saved decorative and drawing tasks that must not acquire circuit answers. The drawing stem includes an ohm symbol to verify that the PDF retains the unit through its explicit text fallback. `browser-results.json` records actual scenario totals and the source/style hashes used by the bundle.

The generated PDFs, bundle, CSS and local fonts remain outside the repository. The review artifacts retain original fixture/harness source, safe reports and screenshots. `pdf-verification.json` records PDF page counts, text assertions and hashes; graph labels are verified in the captured SVG DOM and raster inspection because graphs are embedded as images in the PDF.

## Reproduce

Copy this folder to a temporary workspace. The scripts expect the repository at `/workspace/revise-ai-buddy`, its installed dependencies, Chromium at `/usr/lib/chromium/chromium`, and the environment's existing Playwright runtime at `/opt/codex/cua_node/lib/node_modules/playwright-core`. Supply local Manrope and Source Serif font files and their CSS in `fonts/`; the build removes remote font imports. No package or lockfile changes are required.

```sh
node build.cjs
node browser.cjs
python3 verify-pdfs.py
python3 verify-hashes.py
```

The PDF check uses locally installed `pdfinfo`, `pdftotext` and PyMuPDF/MuPDF. The installed Poppler rasterizer emitted fontconfig-cache warnings and produced poor standard-font spacing, while the same PDF retained correct text and normal spacing in MuPDF. Review PNGs therefore use MuPDF; the manifest records the PDF and PNG hashes. This is a renderer-specific observation, not an app content change.

The six physical PDF pages include the cover. Printed body footers count only the remaining five pages, so the options page at physical page 5 correctly says “Page 4 of 5”. `pdf-verification.json` records both physical and body-page numbers for every review raster.

These are real-component browser/PDF checks, not full signed-in navigation or a physical iPad/iPhone test. They do not establish live deployment state, real model quality, syllabus perfection or an external rating. Generation, source validation and marking are separately covered by repository tests.
