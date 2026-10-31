/**
 * Defense in depth for everything the eval writes or prints (Codex review, Phase 4 fixes
 * round 1). Provider messages are already dropped at capture (capture.ts); this also masks
 * credential-shaped strings, should one reach a record some other way.
 */
const PATTERNS: [RegExp, string][] = [
  [/\bsk-[A-Za-z0-9_-]{8,}/g, "sk-[redacted]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]"],
  [/(\bapi[_-]?key["']?\s*[:=]\s*["']?)(?!\[redacted\])[^\s"'&,;}]+/gi, "$1[redacted]"],
];

export function redactSecrets(text: string): string {
  return PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/** Counts credential-shaped strings without returning them (for scanning run files). */
export function countSecretLike(text: string): number {
  return PATTERNS.reduce((n, [pattern]) => n + (text.match(pattern)?.length ?? 0), 0);
}
