import type { StudyPeriod } from "@/hooks/use-study-period";

/** Original decorative SVG; no external assets, animation or image requests. */
export default function StudyCorner({ period }: { period: StudyPeriod }) {
  return <svg viewBox="0 0 200 180" fill="none" aria-hidden="true" focusable="false" className="study-corner">
    <rect x="110" y="10" width="64" height="76" rx="5" fill="var(--study-frame)" />
    <rect x="116" y="16" width="52" height="64" rx="2" fill="var(--study-window)" />
    {period === "morning" ? <>
      <circle cx="128" cy="37" r="9" fill="var(--study-sun)" />
      <path d="M139 29h22m-16-4h11" stroke="var(--study-cloud)" strokeWidth="4" strokeLinecap="round" />
    </> : period === "afternoon" ? <>
      <circle cx="152" cy="31" r="8" fill="var(--study-sun)" />
      <path d="M152 19v-2m0 26v2m-12-14h-2m26 0h2m-22-8-2-2m20 20-2-2m0-16 2-2m-20 20 2-2" stroke="var(--study-sun)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M121 39h11m-8-4h5" stroke="var(--study-cloud)" strokeWidth="3" strokeLinecap="round" />
    </> : <>
      <circle cx="152" cy="31" r="8" fill="var(--study-light)" />
      <path d="M124 27h2m-1-1v2m31 36h2m-1-1v2" stroke="var(--study-light)" strokeWidth="1.2" strokeLinecap="round" />
    </>}
    <path d="M116 65h11V49h13v20h9V58h19v22h-52Z" fill="var(--study-frame)" opacity=".5" />
    <path d="M141 16v64M116 48h52" stroke="var(--study-frame)" strokeWidth="3" />
    <path d="M21 120h162v7H21zM33 127h6v43h-6zM167 127h6v43h-6z" fill="var(--study-frame)" />
    <path d="m43 91 18-28 25 19" stroke="var(--study-frame)" strokeWidth="5" strokeLinecap="round" />
    {period === "evening" && <path d="m69 89-14 31h57L97 90Z" fill="var(--study-light)" opacity=".1" />}
    <path d="m70 75 16-5 11 20-29-1Z" fill="var(--study-shade)" />
    <path d="M30 118h25" stroke="var(--study-frame)" strokeWidth="5" strokeLinecap="round" />
    {period === "morning" && <>
      <path d="M62 109h2a3 3 0 0 1 0 6h-2" stroke="var(--study-light)" strokeWidth="2" />
      <rect x="52" y="106" width="10" height="13" rx="2" fill="var(--study-light)" />
      <path d="M55 102c-3-3 3-4 0-7m5 7c-3-3 3-4 0-7" stroke="var(--study-paper)" strokeWidth="1.5" strokeLinecap="round" />
    </>}
    {period === "afternoon" && <g transform="rotate(-7 88 44)">
      <rect x="80" y="34" width="17" height="20" rx="1.5" fill="var(--study-light)" />
      <path d="M84 40h9m-9 5h7m-7 4h5" stroke="var(--study-frame)" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
    </g>}
    <rect x="119" y="110" width="38" height="10" rx="2" fill="var(--study-book)" />
    <rect x="125" y="100" width="35" height="10" rx="2" fill="var(--study-light)" />
    <path d="M66 102c11-5 22-3 31 3 9-6 20-8 31-3v17c-11-4-22-2-31 2-9-4-20-6-31-2Z" fill="var(--study-paper)" />
    <path d="M97 105v16M72 108c6-1 11 0 17 2M72 113c6-1 11 0 17 2M105 110c6-2 11-3 17-2M105 115c6-2 11-3 17-2" stroke="var(--study-frame)" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M161 98h20l-3 22h-14Z" fill="var(--study-book)" />
    <path d="M171 100V77m0 15c-10-1-13-7-11-13 7 1 11 6 11 13Zm1-9c10 0 14-7 12-13-7 1-12 6-12 13Z" stroke="var(--study-leaf)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M16 170h171" stroke="var(--study-frame)" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
