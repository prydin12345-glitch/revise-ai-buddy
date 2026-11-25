# Visual review

Reviewed screenshots from the frozen production-component harness. All profiles, owners and source content are synthetic.

- [Desktop Topics](screenshots/desktop-light-custom-topics.png): plain heading and counts, flat rows, icon-only topic controls, separate library navigation and a compact studied-text section. Saved labels show their original names; there are no invented source passages or PDF captions.
- [Desktop settings](screenshots/desktop-light-custom-settings.png): the saved custom qualification stays visible, layout-controlled counts remain disabled, timing and additional settings are grouped, and Save/Discard stay available in the footer.
- [iPad layout](screenshots/ipad-light-custom-layout.png): section navigation, custom question purposes and marks fit the narrower editor. Long question lists scroll; they are not discarded or capped to the visible portion.
- [Phone Topics](screenshots/phone-light-custom-topics.png): wrapped title/metadata, mobile topic-view selector, visible row actions and a fixed footer fit without horizontal overflow. Topic actions have 44-pixel targets.
- [Phone guided dark](screenshots/phone-dark-guided-topics.png): the original topic list and identity remain visible, with the existing preset locks and a clear route to Custom in Exam settings.

The matrix also captures other viewport/theme/scenario combinations and failed-save, retry and edited states. Its 78 screenshot hashes are recorded in `browser-results.json`. The additional close check confirms Escape focus return, Keep editing, confirmed discard/close, pointer-lock release and reopening at all three sizes.

These checks use Chromium viewport/touch emulation. Physical iOS/iPadOS, Safari, live database enforcement and comprehensive assistive-technology behavior were not tested. The full raw reports and remaining screenshots stay under `/tmp/profile-builder-custom-profile-editor`.
