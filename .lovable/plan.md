## Visual Audit — Mobile Settings (image 1) vs. Native Reference (image 2)

### 1. Header — desktop-web pattern leaking into mobile
**What's wrong in image 1:**
- "← Settings" sits on its own row above a giant "Account" title, then a description. That's three stacked lines of chrome before any real content — a webpage pattern.
- The back link doubles as the parent-screen label ("Settings"), so the user has to read it *and* the H1 to know where they are.
- The H1 "Account" uses `text-xl` at ~20px but is preceded by ~44px of vertical whitespace (`min-h-[44px]` tap target on the back button + `mb-4` + `mt-4` container padding), pushing the first card unnecessarily far down.

**What image 2 does right:**
- A single inline row: chevron on the left, section title centered/left of it, no parent-name repeated. One line, ~56px tall, everything else is content.
- The section description is dropped from the header entirely — it lives inside the first card if needed.

**Proposal:**
- Refactor the mobile drill-down header in `Settings.tsx` into one inline row:
  - `<header class="flex items-center gap-1 h-12 -ml-2">` containing an icon-only back button (`ChevronLeft`, 44×44 tap target, no "Settings" label) + `<h1 class="text-[17px] font-semibold tracking-tight">{meta.title}</h1>`.
  - Remove the standalone `SectionHeader` block on mobile. Keep it desktop-only.
  - Sticky the header (`sticky top-0 z-10 bg-background/85 backdrop-blur`) so it behaves like a native nav bar during scroll.
- Move `meta.description` inside the first `SettingsCard` (or drop entirely — the section title is self-evident once you drilled in).
- Reduce top padding from `pt-4` → `pt-2` since the sticky header owns the top edge.

### 2. Micro-padding & spacing inside cards
**What's wrong:**
- `SettingsCard` header uses `px-5 pt-5 pb-4` with `mt-1` between title and description. The 4px gap plus `leading-relaxed` on the description creates a loose, "two independent lines" feel rather than a tight title/subtitle pair.
- Card body uses `px-5` while the outer page uses `px-4` — the card content is inset *more* than the page container, which reads as cramped horizontally on a 393px viewport (only 313px of usable content width inside the card).
- The border between card header and first `SettingRow` is a hard 1px line 4px below the description — visually collides with the row's own top padding.
- Between stacked cards, `space-y-6` (24px) is generous but combined with per-card internal padding of 20px it stacks to ~64px of empty space between actual controls.

**Proposal (exact tokens):**
- Card header: `px-4 pt-4 pb-3`, title/description gap `mt-0.5` (2px), description `leading-snug` not `leading-relaxed`.
- Card body: `px-4` (match page gutter) so inputs align with page edges visually.
- Divider under header: drop to `border-b border-border/30` and reduce header `pb-3` → `pb-2` so the first row's top padding carries the whitespace, not a double gap.
- Between cards on mobile: `space-y-4` (16px) instead of `space-y-6`.
- Page container mobile gutter: bump to `px-5` if we keep card `px-5`, OR keep `px-4` on both — do not mix.

### 3. Typography & contrast
**What's wrong:**
- Description text uses `text-muted-foreground` at `text-xs` (12px). On a dark surface with our current `--muted-foreground`, this reads ~4.1:1 — below WCAG AA for text this small (needs ≥4.5:1). It's the "washed out" feeling.
- Field-label vs. description size ratio is 14→12 (`text-sm` / `text-xs`), only a 2px delta — no confident hierarchy. Native iOS pattern is 17/13 or 15/13.
- Card title is `text-sm font-semibold` (14px) — smaller than the field labels below it. The group header should outrank its rows.
- The screen H1 "Account" is `text-xl` (20px) but the card title "Profile" is 14px — a 6px cliff that feels arbitrary.

**Proposal:**
- Establish a mobile-first type scale in Settings:
  - Screen title (sticky header): `text-[17px] font-semibold` — native nav-bar size.
  - Card/group title: `text-[15px] font-semibold` — clearly outranks rows.
  - Row label: `text-sm` (14px) `font-medium`.
  - Description / helper: `text-[13px]` (not `text-xs`) with `leading-snug`.
- Contrast: introduce a `text-foreground/70` fallback for descriptions on dark bg (or bump `--muted-foreground` L-value in `index.css` dark theme by ~6-8% so descriptions clear 4.5:1). Prefer the token bump so it fixes the whole app, not just Settings.
- Remove `text-[11px] uppercase tracking-wider` group labels on the mobile drill-down index — on a stack of only 2–3 items they add visual noise. Keep only the group divider spacing.

### 4. FAB bleeding into Settings
**Source:** `DashboardLayout.tsx` renders `<MobileSpeedDial>` (the glowing blue "+" for Create Exam / Create Quiz / Ask AI) unconditionally for all non-tutor pages at lines 365-375, plus `<MobileNavFAB>` at line 378. Both are fixed-positioned and appear on every route inside `DashboardLayout`, including `/settings`.

**Proposal:**
- Suppress both FABs on any `/settings*` route. Cleanest approach: inside `DashboardLayout.tsx`, read `useLocation()` and compute `const isSettings = location.pathname.startsWith("/settings")`, then gate:
  - `{primaryRole !== 'tutor' && !isSettings && (<><MobileBottomNav /><MobileSpeedDial .../></>)}` — this keeps the bottom tab bar off Settings too (matches native "modal-like" settings screens where global nav collapses).
  - `{!isSettings && <MobileNavFAB />}`.
- If keeping `MobileBottomNav` on Settings is preferred, split the condition and only gate the two FABs on `!isSettings`.
- Also reduce `main`'s bottom padding from `pb-24` → `pb-8` when `isSettings` (no tab bar / FAB to clear).

### Files to touch (when approved)
- `src/pages/Settings.tsx` — new inline sticky header, drop description, retune paddings, simplify mobile index.
- `src/components/settings/SettingsCard.tsx` — new padding/type tokens, tighter title/description pair.
- `src/components/settings/SettingRow.tsx` — align to `text-[13px]` descriptions, verify label weight.
- `src/components/dashboard/DashboardLayout.tsx` — route-based suppression of `MobileSpeedDial`, `MobileNavFAB` (and optionally `MobileBottomNav`) on `/settings*`, plus reduced `main` bottom padding.
- `src/index.css` — small `--muted-foreground` lightness bump in dark theme to hit 4.5:1 (only if we agree to fix globally rather than override in Settings).

No code changes yet — awaiting your green light, and specifically your call on: (a) whether to hide `MobileBottomNav` on Settings too, and (b) whether to fix contrast at the token level (`index.css`) or scoped to Settings only.