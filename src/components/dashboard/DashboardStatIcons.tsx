import { forwardRef, type ReactNode } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

// Original, compact vectors based on the selected “Bold & friendly” direction.
// The surrounding stat supplies the accessible name; the artwork is decorative.
function statIcon(name: string, artwork: ReactNode): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
        {...props}
        ref={ref}
      >
        {artwork}
      </svg>
    ),
  );
  Icon.displayName = name;
  return Icon;
}

export const ExamsCompletedIcon = statIcon("ExamsCompletedIcon", <>
  <path d="M5 6a4 4 0 0 1 4-4h11l7 8v16a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" fill="#1671D9" />
  <path d="M5 6a4 4 0 0 1 4-4h11l7 8v14a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" fill="#299BFA" />
  <path d="M20 2v6a2 2 0 0 0 2 2h5Z" fill="#94DCFF" />
  <path d="M10 10h5m-5 5h3" stroke="#A8E5FF" strokeWidth="2.5" strokeLinecap="round" />
  <path d="m11 22 4 4 7-8" stroke="#FFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
</>);

export const AverageScoreIcon = statIcon("AverageScoreIcon", <>
  <path d="M9 7H3v5a7 7 0 0 0 7 7m13-12h6v5a7 7 0 0 1-7 7" stroke="#F5AC18" strokeWidth="3.5" strokeLinejoin="round" />
  <path d="M13 21h6v5h-6Z" fill="#E99812" />
  <path d="M11 26h10a3 3 0 0 1 3 3v1H8v-1a3 3 0 0 1 3-3Z" fill="#F5AC18" />
  <path d="M7 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a9 9 0 0 1-18 0Z" fill="#FFC635" />
  <path d="m16 6 1.8 3.8 4.2.6-3 3 .7 4.2-3.7-2-3.7 2 .7-4.2-3-3 4.2-.6Z" fill="#FFF9E5" stroke="#FFF9E5" strokeWidth=".8" strokeLinejoin="round" />
</>);

export const StudyHoursIcon = statIcon("StudyHoursIcon", <>
  <circle cx="16" cy="16" r="14" fill="#13B9E9" />
  <circle cx="16" cy="16" r="10.5" fill="#CBF3FF" />
  <path d="M16 7.5v1m0 15v1m-8.5-8.5h1m15 0h1" stroke="#55CBF0" strokeWidth="2" strokeLinecap="round" />
  <path d="M16 11v6l4 3" stroke="#087BA9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
</>);

export const DayStreakIcon = statIcon("DayStreakIcon", <>
  <path d="M16 1c-1.5 0 1 4-4.5 10.5L9 8C8 12 3 16 3 21a13 10 0 0 0 26 0c0-4-2-8-4.5-11l-2 5C22 9 20 4 16 1Z" fill="#F04C30" />
  <path d="M16 1c-1.5 0 1 4-4.5 10.5L9 8C8 12 3 16 3 21c0 4 3 7.5 7.5 9C7 26 9 21 12 18c2-2 4-4 4-7 4 5 7 10 6 15 3-3 4-6 3-10l-2.5-1C22 9 20 4 16 1Z" fill="#FF713C" />
  <path d="M16 14c0 4-5 6-5 10a5 5 0 0 0 10 0c0-2-1-4-2-5l-1 2c0-3-.5-5-2-7Z" fill="#FFDA73" />
</>);
