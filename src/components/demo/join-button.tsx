"use client";

import { useState } from "react";

/** "Join (demo)": flips to a confirmation. Nothing is sent or stored. */
export function JoinButton({ join, joined }: { join: string; joined: string }) {
  const [done, setDone] = useState(false);
  return done ? (
    <p role="status" className="inline-flex min-h-11 items-center gap-2 font-semibold text-sage">
      <span aria-hidden="true">✓</span> {joined}
    </p>
  ) : (
    <button type="button" className="btn-quiet border-glow/60" onClick={() => setDone(true)}>
      {join}
    </button>
  );
}
