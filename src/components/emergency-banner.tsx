/** Always-visible, static emergency and crisis lines. Never depends on the AI being up. */
export function EmergencyBanner({ lines }: { lines: readonly string[] }) {
  return (
    <div
      role="note"
      className="space-y-1 rounded-soft border border-ember/40 bg-raised px-4 py-3 text-base text-text"
    >
      {lines.map((line) => (
        <p key={line}>
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-2 rounded-pill bg-ember align-middle"
          />
          {line}
        </p>
      ))}
    </div>
  );
}
