/** Always-visible, static emergency line. Never depends on the AI being up. */
export function EmergencyBanner({ text }: { text: string }) {
  return (
    <p
      role="note"
      className="rounded-soft border border-ember/40 bg-raised px-4 py-3 text-base text-text"
    >
      <span
        aria-hidden="true"
        className="mr-2 inline-block size-2 rounded-pill bg-ember align-middle"
      />
      {text}
    </p>
  );
}
