# Portable offline Physics browser and PDF verification

This maintained harness composes the actual `AssessmentPhysicsFigure`, `MathRenderer`, `ResponseEditor`, strict Physics parser/resolver and `generateExamPDF` with synthetic questions. It builds production Tailwind/CSS, observes the real installed html2canvas implementation, and exports with the real installed jsPDF implementation and repository scientific font. It preserves the original structured-figure matrix: four viewport sizes in two themes, 80 saved-figure renders, 58 scenario groups and two standalone PDF exports. The fixture is intentionally independent of live generation and account state.

## Prerequisites

Use a normal checkout with its existing dependencies installed according to the repository lockfile and Node engine (`>=22 <25`). This harness does not run an install, alter the lockfile, contact Supabase, log in, call an AI service, write live data or deploy. The browser intercepts every request and blocks any destination outside its synthetic local origin. It needs no running web server.

Browser tools are independent prerequisites, not application dependencies. Use an existing Chromium and Playwright Core installation, or prepare a separate tool directory before the offline test. For example, on a machine permitted to download development tools:

```sh
export PHYSICS_TOOLS_DIR="$HOME/.cache/physics-browser-tools"
npm install --prefix "$PHYSICS_TOOLS_DIR" --no-save --package-lock=false playwright-core@1.57.0
export PLAYWRIGHT_CORE_PATH="$PHYSICS_TOOLS_DIR/node_modules/playwright-core"
"$PHYSICS_TOOLS_DIR/node_modules/.bin/playwright-core" install chromium
```

`PLAYWRIGHT_CORE_PATH` accepts the absolute path to a Playwright Core package directory. Without it, the harness resolves `playwright-core` from the checkout. `CHROMIUM_EXECUTABLE_PATH` accepts any installed Chromium executable; otherwise the runner first checks Playwright's matching installed browser and then Chromium/Chrome on `PATH`. Platforms may require Chromium system libraries as described by Playwright. These preparatory commands are examples for a clean machine; no tool installation is needed when the prerequisites already exist.

Font setup is explicit and reproducible. `setup-fonts.cjs` downloads two variable fonts and their unmodified SIL Open Font License files from the official Google Fonts repository at the commit pinned in `fonts-manifest.json`. Every file has a pinned SHA256 and byte count; generated CSS is also checked. No font binary is duplicated in this repository. The build only verifies prepared files and performs no font download.

## Run from any checkout path

Run the following from the checkout root, including a directory whose name contains spaces. Set `PHYSICS_ARTIFACT_DIR` to an absolute directory outside the checkout so generated bundles, PDFs and fresh results cannot overwrite historical evidence.

```sh
export PHYSICS_ARTIFACT_DIR="${TMPDIR:-/tmp}/physics verification artifacts"
node docs/physics-practice-parity/browser/setup-fonts.cjs
node docs/physics-practice-parity/browser/build.cjs
python3 docs/physics-practice-parity/browser/verify-hashes.py
node docs/physics-practice-parity/browser/browser.cjs
python3 docs/physics-practice-parity/browser/verify-pdfs.py
python3 docs/physics-practice-parity/browser/verify-hashes.py
```

For an offline environment, copy a directory prepared by the font setup command and set `PHYSICS_FONT_DIR` to it. `node docs/physics-practice-parity/browser/setup-fonts.cjs --verify` verifies that directory without network access. An arbitrary system font directory or the former untracked local font cache does not satisfy the pinned manifest. Fonts default to `$PHYSICS_ARTIFACT_DIR/fonts`.

Repository root discovery starts at the script location, then the current directory. `PHYSICS_REPO_ROOT` can explicitly select a checkout. Application imports are relative to the tracked fixture; all application dependencies resolve from that checkout's `package.json`. Paths to this session's workspace, browser and tool packages are absent from the harness sources. The compatibility commands in `docs/physics-structured-figures/browser` forward to this harness and write new output outside the checkout; their historical JSON and screenshots remain historical evidence.

PDF verification is optional when only browser rendering is needed. It requires Python 3, `PyMuPDF==1.26.6`, and Poppler's `pdfinfo`/`pdftotext` commands. Install Python tools in a separate virtual environment, for example `python3 -m venv "$PHYSICS_TOOLS_DIR/pdf-venv"` followed by `"$PHYSICS_TOOLS_DIR/pdf-venv/bin/pip" install PyMuPDF==1.26.6`, and run the verifier with that environment's Python. Install Poppler using the machine's package manager. If these tools are absent, the verifier gives a prerequisite error; the browser's actual PDF exports are still produced.

## Hash policy and evidence

`app-source-hashes.json` strictly hashes production bundled application files, all production Tailwind-scanned source files, CSS/configuration (including `tsconfig.physics.json`), `package.json` and `package-lock.json`. `server-source-hashes.json` separately pins every TypeScript/JSON/JSONC file under `supabase/functions` and `supabase/config.toml`, including both practice routes, the shared generation core and the extraction route. These server sources are frozen for the run; the browser composition does not execute them. `dependency-input-hashes.json` records installed bundled dependency inputs and KaTeX CSS/fonts separately. `build-manifest.json` records the fixture source hashes, pinned font files, output hashes, Node/OS/architecture and relevant installed package versions. `verify-hashes.py` fails for changes to any input or output after the build, including installed dependency changes during that run. Keep the final build frozen through the browser/PDF run and final hash check.

To diagnose an older combined manifest without hiding application drift:

```sh
python3 docs/physics-practice-parity/browser/verify-hashes.py \
  --baseline docs/physics-structured-figures/browser/source-hashes.json
```

The result lists historical application differences separately from historical installed dependency differences. Its main `status` describes integrity of the current frozen run; `historicalComparison.applicationMatchesHistoricalManifest` explicitly describes the older application comparison. Add `--require-baseline-app-match` when historical application identity is required. A changed dependency fingerprint, including Lovable's reported 16 dependency differences, cannot prove application parity or excuse an application/configuration/lockfile difference. This environment may have different installed bytes and versions; inspect both categories and runtime metadata rather than replacing or suppressing mismatched hashes.

The browser report includes parser checks, symbolic unknown preservation, private-answer sentinels, structured-response drafting, exam/practice/review rendering, saved-data precedence, legacy behavior, missing-contract alerts, theme labels/contrast, SVG bounds, 150% zoom, print overflow and actual PDF capture counts. The PDF verifier checks scientific glyph extraction, question headings, embedded TrueType fonts, private-key suppression, actual captured SVG labels, and MuPDF review rasters. Full PDFs and generated bundles stay in the external artifact directory; selected safe reports and screenshots can be copied into a new evidence directory after a completed run.

The [recorded rerun](results/browser-results.json) passed all eight viewport/theme cases, 80 saved renders and 58 scenario groups. Both [verified PDFs](results/pdf-verification.json) contain ten pages and ten saved figure captures. The [portability check](results/portability-verification.json) ran a relocated source snapshot in a path containing spaces, from a different current directory, with explicit external tools/fonts/artifacts and a symlink to the existing dependency tree. Temporary changes to a UI CSS input and the extraction server module were each rejected by the appropriate strict hash category and restored before the browser run. The [final hash report](results/hash-verification.json) covers 852 application/config inputs, 189 server/config inputs and 2,555 installed dependency inputs; it also discloses historical application differences. [Selected visual review](results/visual-review.json) records the six inspected images. This relocation test does not claim a clean dependency installation or identical rendering on another platform.

This is offline component composition. It does not exercise full signed-in navigation, live model quality, private saved papers, deployment, or physical iOS/iPadOS behavior. Ten representative saved types and boundary cases do not certify every scientific expression, variant, narrow-label size or assistive-technology interaction. PDF figure labels are rasterized, so captured DOM assertions and final page raster review complement PDF text extraction.
