

## Problem

Windows does not render country flag emojis -- they fall back to two-letter region indicator codes (e.g., "GB" instead of 🇬🇧). This is a well-known Windows limitation.

## Solution

Replace emoji flags with small flag images from the open-source `flagcdn.com` CDN, which serves country flag PNGs by ISO code. For the "IB/International" entry, keep the globe emoji since it renders fine on all platforms.

## Changes

**File: `src/components/settings/sections/PersonalizationSection.tsx`**

- Update `curriculumRegions` array: replace `flag` emoji strings with a `code` field matching the ISO 3166-1 alpha-2 country code (e.g., `'gb'`, `'us'`). For IB, use a special marker.
- In the render, replace `<span className="text-xl">{r.flag}</span>` with an `<img>` tag:
  ```
  <img src={`https://flagcdn.com/24x18/${r.code}.png`} alt={r.abbr} className="w-6 h-[18px] rounded-sm" />
  ```
  For IB/International, render the 🌍 emoji as before.
- This ensures flags display correctly on all platforms including Windows.

