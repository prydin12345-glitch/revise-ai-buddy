# Compact Practice Library cards

The preceding library cards had a fixed 400px height and 88px title area. Short titles left a large blank space above the metadata, and phone cards used the same height as laptop cards. This follow-up changes only `src/styles/practice-library.css` in production.

| Viewport | Card before | Card after |
| --- | --- | --- |
| Laptop, 1200px and wider | 264 × 400px | 264 × 312px |
| Tablet/split screen, 640–1199px | 264 × 400px | 248 × 308px |
| Phone, below 640px | Up to 264 × 400px | Up to 224 × 280px |

Two title lines, tighter metadata rows and smaller section margins remove excess internal spacing. Normal cards remain uniform at each breakpoint. The full title remains in the existing accessible button name and title tooltip. Phone summaries keep board, level, marks, time and progress; question count and quiz difficulty remain on the existing detailed covers. The three footer controls retain their existing event bindings, accessible names and 44px minimum height.

A failed favourite can expand its card to show the full retry message instead of clipping it or hiding an action. Existing palette, subject-colour borders, native horizontal shelves, focus treatments and reduced-motion behaviour are preserved. No application logic, data queries, calculations, ownership rules, release controls, exam content, marking, PDF layouts, dependencies or lockfiles changed. No migration, backend change or function deployment is required.

## Verification

- Node 24.19.0, existing installation and unchanged lockfile.
- `npm run typecheck`: passed.
- `npm run lint:critical`: passed.
- `npm test -- src/test/practice-library.test.tsx src/test/library-item-actions.test.tsx --maxWorkers=1`: 31 passed in two files. Existing tests and timeouts are unchanged.
- `npm run build`: passed. Existing warnings remain for stale Browserslist data, an annotation in Zod and chunks larger than 500 kB; dependencies and warning thresholds were not changed.
- `git diff --check`: passed.
- Chromium: 40 layout combinations of Exams/Quizzes and light/dark themes, with mouse at 1280×900, 1440×1000 and 1920×1080; touch emulation at 320×844, 390×844, 768×1024, 834×1112, 1024×768, 1194×834 and 1366×1024.
- Checked card sizes, contained subject rows, unclipped contents, compact internal gaps, same-row toolbar controls, subject hover colours, three usable footer actions and bottom-navigation clearance. Mouse/touch checks also exercised cancel/focus return, failed delete/retry, pending locks, archive/restore, deleted-item direct links, Home-cache refresh and retained horizontal position.
- Six additional card-state views covered short and long titles, a long A Level Biology B label, missing metadata, pending controls and a failed favourite at 390px, 834px and 1440px in both themes. Assertions check content/section overlap, footer clearance and button size. The error card may grow to show the message.
- Twelve baseline captures use the same current component bundle and synthetic data with the original stylesheet.
- Final browser checks reported no JavaScript, console, certificate or unexpected request errors. Fonts returned HTTP 200, with zero live Supabase requests. The preview server was restarted after an old process stopped, and Chromium's managed proxy trust was restored from the existing system-verified CA. No TLS bypass was used.

All preview data and mutations use external fixtures outside production source. No real account login, live data mutation, paid generation, migration, function deployment or website publication occurred. Real iOS/iPadOS hardware and live backend persistence were not tested. The full test suite and Biology audits were not rerun for this stylesheet-only change.

## Screenshots

| View | Before | After |
| --- | --- | --- |
| Laptop, dark | [Before](before-laptop-dark.png) | [After](after-laptop-dark.png) |
| iPad-size, dark | [Before](before-ipad-dark.png) | [After](after-ipad-dark.png) |
| Phone Exams, light | [Before](before-phone-light.png) | [After](after-phone-light.png) |
| Phone Quizzes, dark | [Before](before-phone-quiz-dark.png) | [After](after-phone-quiz-dark.png) |

Additional checks: [laptop light](after-laptop-light.png), [failed favourite on phone](failed-favourite-phone.png). Phone comparisons are scrolled to keep all three footer controls above the fixed navigation. All screenshots use synthetic values. Review the draft PR and green CI, then use **Squash and merge**. Keep the website unpublished.
