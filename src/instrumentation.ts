/**
 * Runs once when the Next.js server starts. Loads and validates the KB up front, so a broken
 * article fails the boot instead of the first parent's request.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { preloadKnowledgeBases } = await import("./server/knowledge");
  await preloadKnowledgeBases();
}
