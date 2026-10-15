/** Small original study scenes. Subject names choose decoration only, never course identity. */
export function ExamShelfIllustration({ subject }: { subject: string }) {
  const science = /biolog|chemistr|scienc/i.test(subject);
  const quantitative = /math|physic|statistic|comput/i.test(subject);
  return <span className="stats-exam-art" aria-hidden="true">
    <svg viewBox="0 0 64 76" fill="none" focusable="false">
      <rect x="37" y="8" width="17" height="23" rx="3" fill="hsl(var(--primary) / .12)" />
      <path d="M45.5 8v23M37 19.5h17" stroke="hsl(var(--primary) / .18)" />
      <path d="M8 60h49M13 61v9m38-9v9" stroke="hsl(var(--foreground) / .4)" strokeWidth="2.5" strokeLinecap="round" />
      {science ? <>
        <path d="M21 43V26m0 9c-9-1-11-5-10-10 6 1 10 4 10 10Zm0-4c9 0 13-5 12-11-7 1-12 5-12 11Z" stroke="hsl(var(--success))" strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 42h16l-3 16H16Z" fill="hsl(var(--warning) / .45)" />
        <path d="M41 33v12l-7 10a3 3 0 0 0 2.5 4h13a3 3 0 0 0 2.5-4l-7-10V33m-6 0h8" stroke="hsl(var(--foreground) / .5)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m39 49-4 7a1 1 0 0 0 1 2h14l-5-9Z" fill="hsl(var(--primary) / .3)" />
      </> : <>
        <path d="m12 43 10-17 13 9" stroke="hsl(var(--foreground) / .55)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="m28 30 9-3 6 12-17-1Z" fill="hsl(var(--warning) / .6)" />
        <path d="M9 58h13" stroke="hsl(var(--foreground) / .55)" strokeWidth="2.5" strokeLinecap="round" />
        {quantitative ? <>
          <rect x="29" y="43" width="24" height="16" rx="2" fill="hsl(var(--primary) / .23)" />
          <path d="M33 46v9h16m-13-2 4-4 4 2 4-5" stroke="hsl(var(--primary))" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </> : <>
          <path d="M24 47c5-2 10-1 14 2 4-3 9-4 14-2v12c-5-2-10-1-14 1-4-2-9-3-14-1Z" fill="hsl(var(--primary) / .2)" />
          <path d="M38 49v11m-10-9 6 1m-6 3 6 1m9-4 5-1m-5 5 5-1" stroke="hsl(var(--foreground) / .4)" strokeWidth="1.2" strokeLinecap="round" />
        </>}
      </>}
      <path d="M7 71h51" stroke="hsl(var(--foreground) / .12)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </span>;
}
