# Offline assessment identity browser verification

This harness composes the actual `ExamProfileBuilder`, attachment storage and local source-inspection code with synthetic documents and an injected, controlled builder API. Production Tailwind configuration and CSS are compiled from the checkout. Browser requests are restricted to fixture assets. The test uses no live backend, login, AI provider, saved private paper, deployment or live data write. Synthetic source-job responses establish UI behavior, not live extraction quality or server correctness.

Use a checkout whose application dependencies are already installed according to its lockfile, with the repository's Node engine (`>=22 <25`) and Python 3. The harness never installs application dependencies or changes the lockfile. Playwright Core and Chromium are separate tool prerequisites. Use an existing installation, or prepare a separate tools directory on a machine permitted to download development tools:

```sh
export PROFILE_BUILDER_TOOLS_DIR="$HOME/.cache/profile-builder-browser-tools"
npm install --prefix "$PROFILE_BUILDER_TOOLS_DIR" --no-save --package-lock=false playwright-core@1.57.0
export PLAYWRIGHT_CORE_PATH="$PROFILE_BUILDER_TOOLS_DIR/node_modules/playwright-core"
"$PROFILE_BUILDER_TOOLS_DIR/node_modules/.bin/playwright-core" install chromium
```

`PLAYWRIGHT_CORE_PATH` selects an absolute Playwright Core package directory. `CHROMIUM_EXECUTABLE_PATH` selects an installed Chromium executable; the runner can otherwise use Playwright's installed browser or Chromium/Chrome on `PATH`. Some platforms require Chromium system libraries. No browser tool installation is needed when those prerequisites already exist.

Run from the checkout root, with generated artifacts outside the checkout:

```sh
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR="${TMPDIR:-/tmp}/profile builder assessment artifacts"
node docs/profile-builder/assessment-identities/browser/setup-fonts.cjs
node docs/profile-builder/assessment-identities/browser/build.cjs
python3 docs/profile-builder/assessment-identities/browser/verify-hashes.py
node docs/profile-builder/assessment-identities/browser/browser.cjs
python3 docs/profile-builder/assessment-identities/browser/verify-hashes.py
```

Font setup reuses the [pinned official Google Fonts manifest](../../../physics-practice-parity/browser/fonts-manifest.json) and [setup script](../../../physics-practice-parity/browser/setup-fonts.cjs). It downloads two variable fonts and their unmodified OFL licenses at a pinned commit, verifies SHA256 and byte counts, and keeps all binaries outside the checkout. A prepared font directory can be supplied through `PROFILE_BUILDER_FONT_DIR`; `setup-fonts.cjs --verify` checks that directory without network access. Build and browser verification never download fonts. The default font directory is `$PROFILE_BUILDER_BROWSER_ARTIFACT_DIR/fonts`.

Root discovery starts at the tracked script location and then the current directory; `PROFILE_BUILDER_REPO_ROOT` explicitly selects a checkout. The harness should run from its tracked location inside that checkout. `PYTHON_EXECUTABLE` optionally selects the Python binary used by the browser's strict before/after hash checks. Checkout paths and artifact paths may contain spaces.

`app-source-hashes.json` pins production browser inputs, all Tailwind-scanned source files, CSS, build configuration and package/lock manifests. `server-source-hashes.json` separately pins all TypeScript/JSON/JSONC under `supabase/functions` and Supabase configuration. `dependency-input-hashes.json` records installed bundled dependency inputs separately. The build manifest also hashes harness sources, the reused pinned font sources, external font files and generated bundles/styles, and records Node/platform/architecture/package versions. `verify-hashes.py` fails on any recorded-input or output drift. Hashing server sources does not mean browser composition executes backend endpoints; backend regression tests remain separate evidence.

Full generated bundles and screenshots remain in the external artifact directory. Reviewed reports and a few representative images may be copied into a fresh `results` directory after the final frozen run. Chromium viewport emulation does not establish physical iOS/iPadOS behavior or complete assistive-technology coverage. Synthetic text fixtures exercise local discovery and UI state; they do not certify the text extraction of a user's uploaded PDF.

The [recorded final run](results/browser-results.json) passes **48 scenario groups across eight viewport/theme cases** (1440px, 834px, 390px and 320px, each light/dark), including native manual-code and restart-popup Escape behavior. The relocated checkout and artifact directory both use paths containing spaces. Final strict checks match **829 application/configuration files, 189 server/configuration files and 1,743 installed dependency inputs** against both that snapshot and the working checkout. Deliberate CSS and server-source mutations fail the appropriate category and are restored before the final matching check. [Portability evidence](results/portability-verification.json) records that the installed dependency tree was reused, rather than claiming a clean cross-platform install. [Selected screenshots and visual limits](results/visual-review.json) are separate from automated interaction assertions. Full bundles and all generated screenshots remain outside the repository; no generated fonts, live data or PDF files are included in these results.
