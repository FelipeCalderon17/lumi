/** The Lumi mark: a firefly's glow inside a small lantern outline. Decorative only. */
export function LumiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <circle cx="16" cy="18" r="9" fill="#f6be4f" opacity="0.22" />
      <circle cx="16" cy="18" r="4.5" fill="#f6be4f" className="animate-flicker" />
      <path
        d="M11 9.5h10M12.5 9.5c-2 2.4-3 5.3-3 8.5 0 4 2.9 7 6.5 7s6.5-3 6.5-7c0-3.2-1-6.1-3-8.5M14 6.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
