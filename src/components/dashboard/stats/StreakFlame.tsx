/** Small, resolution-independent flame shared by the streak header and weekly card. */
export function StreakFlame({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 36" fill="none" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 2c.7 6.1 8 10.1 8 18.4C26 28.2 21.5 33 14.5 33S3 27.7 3 20.7c0-5.1 2.8-9.3 6.3-12.5.1 3.8 1 6.2 3.4 7.6C16 12.1 17.6 7.9 18 2ZM15 19c-.3 3-3.6 4.4-3.6 7.2a3.6 3.6 0 0 0 7.2 0C18.6 23.5 16.2 22.1 15 19Z"
      />
    </svg>
  );
}
