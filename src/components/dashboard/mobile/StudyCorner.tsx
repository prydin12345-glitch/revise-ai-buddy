/** Original decorative SVG; no external assets or image requests. */
export default function StudyCorner() {
  return <svg viewBox="0 0 200 180" fill="none" aria-hidden="true" focusable="false" className="mobile-study-corner">
    <rect x="110" y="10" width="64" height="76" rx="5" fill="var(--study-frame)" />
    <rect x="116" y="16" width="52" height="64" rx="2" fill="var(--study-window)" />
    <circle cx="152" cy="31" r="8" fill="var(--study-light)" />
    <path d="M116 65h11V49h13v20h9V58h19v22h-52Z" fill="var(--study-frame)" opacity=".5" />
    <path d="M141 16v64M116 48h52" stroke="var(--study-frame)" strokeWidth="3" />
    <path d="M21 120h162v7H21zM33 127h6v43h-6zM167 127h6v43h-6z" fill="var(--study-frame)" />
    <path d="m43 91 18-28 25 19" stroke="var(--study-frame)" strokeWidth="5" strokeLinecap="round" />
    <path d="m70 75 16-5 11 20-29-1Z" fill="var(--study-light)" />
    <path d="M30 118h25" stroke="var(--study-frame)" strokeWidth="5" strokeLinecap="round" />
    <rect x="119" y="110" width="38" height="10" rx="2" fill="var(--study-book)" />
    <rect x="125" y="100" width="35" height="10" rx="2" fill="var(--study-light)" />
    <path d="M66 102c11-5 22-3 31 3 9-6 20-8 31-3v17c-11-4-22-2-31 2-9-4-20-6-31-2Z" fill="var(--study-paper)" />
    <path d="M97 105v16M72 108c6-1 11 0 17 2M72 113c6-1 11 0 17 2M105 110c6-2 11-3 17-2M105 115c6-2 11-3 17-2" stroke="var(--study-frame)" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M161 98h20l-3 22h-14Z" fill="var(--study-book)" />
    <path d="M171 100V77m0 15c-10-1-13-7-11-13 7 1 11 6 11 13Zm1-9c10 0 14-7 12-13-7 1-12 6-12 13Z" stroke="var(--study-leaf)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M16 170h171" stroke="var(--study-frame)" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
