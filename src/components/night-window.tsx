/**
 * The hero illustration: a window at night, a lantern on the sill, a paper boat, a few
 * fireflies. Line art in the theme's own colours, one amber light. Decorative only.
 */
export function NightWindow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 460" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <radialGradient id="lumi-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6be4f" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#f6be4f" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#f6be4f" stopOpacity="0" />
        </radialGradient>
        <clipPath id="lumi-pane">
          <path d="M100 370V180a110 110 0 0 1 220 0v190Z" />
        </clipPath>
      </defs>

      {/* The night sky inside the window. */}
      <path d="M100 370V180a110 110 0 0 1 220 0v190Z" fill="var(--lumi-raised)" />
      <g clipPath="url(#lumi-pane)">
        <circle cx="160" cy="150" r="26" fill="var(--lumi-text)" opacity="0.9" />
        <circle cx="172" cy="141" r="24" fill="var(--lumi-raised)" />
        {[
          [250, 120, 2.2],
          [282, 168, 1.6],
          [226, 200, 1.3],
          [130, 230, 1.5],
          [270, 245, 1.2],
          [205, 112, 1.4],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="var(--lumi-text)" opacity="0.75" />
        ))}
        <path
          d="M256 96l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5Z"
          fill="var(--lumi-glow)"
          opacity="0.9"
        />
        {/* Distant rooftops. */}
        <path
          d="M100 345l30-22 24 16 34-30 30 24 26-18 38 28 38-20v77H100Z"
          fill="var(--lumi-line)"
          opacity="0.55"
        />
      </g>

      {/* Frame and mullions. */}
      <path
        d="M100 370V180a110 110 0 0 1 220 0v190"
        fill="none"
        stroke="var(--lumi-muted)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M210 72v298M100 238h220" stroke="var(--lumi-muted)" strokeWidth="2" opacity="0.6" />

      {/* The lantern's light, spilling past the frame. */}
      <circle cx="214" cy="330" r="170" fill="url(#lumi-lamp)" />

      {/* Sill. */}
      <rect x="70" y="368" width="280" height="14" rx="7" fill="var(--lumi-line)" />
      <path d="M86 382h248" stroke="var(--lumi-muted)" strokeWidth="1.5" opacity="0.4" />

      {/* Lantern. */}
      <g
        stroke="var(--lumi-text)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M200 286a14 14 0 0 1 28 0" />
        <path d="M197 293h34" />
        <path d="M200 293c-6 12-9 26-9 40 0 17 10 28 23 28s23-11 23-28c0-14-3-28-9-40" />
        <path d="M194 368h40" />
      </g>
      <ellipse cx="214" cy="335" rx="9" ry="13" fill="#f6be4f" className="animate-flicker" />
      <circle cx="214" cy="335" r="22" fill="#f6be4f" opacity="0.18" />

      {/* Paper boat. */}
      <g
        stroke="var(--lumi-text)"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="var(--lumi-surface)"
        opacity="0.9"
      >
        <path d="M268 352h54l-9 15h-36Z" />
        <path d="M282 352l13-26 13 26" />
      </g>

      {/* A small stack of books with a notebook on top. */}
      <g stroke="var(--lumi-text)" strokeWidth="2" strokeLinejoin="round" opacity="0.85">
        <rect x="112" y="350" width="62" height="17" rx="3" fill="var(--lumi-raised)" />
        <rect x="118" y="336" width="52" height="14" rx="3" fill="var(--lumi-surface)" />
        <path d="M130 343h28" opacity="0.6" />
      </g>

      {/* Fireflies outside the frame. */}
      {[
        [56, 150, "0s"],
        [360, 110, "1.6s"],
        [380, 260, "3.1s"],
        [40, 300, "4.4s"],
        [330, 40, "2.3s"],
      ].map(([x, y, delay]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="3.2"
          fill="#f6be4f"
          className="animate-drift"
          style={{ animationDelay: String(delay) }}
        />
      ))}
    </svg>
  );
}
