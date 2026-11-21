/** The mark beside the name: a reporting line with one spike in it. */
export function SentinelMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M1 11h4l2-5 3 9 2.5-6 1.5 2H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
