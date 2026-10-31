/**
 * The prepared notebook page as plain text, for "Copy" and "Share". Notes are copied exactly as
 * written (line breaks kept, indented under their date), never rephrased.
 */
export type PlainSheet = {
  title: string;
  subtitle: string;
  /** Safety lines shown first on the page, if any. */
  safety: readonly string[];
  groups: readonly { heading: string; notes: readonly { date: string; text: string }[] }[];
};

export function notebookPlainText(sheet: PlainSheet): string {
  const out = [sheet.title, sheet.subtitle];
  if (sheet.safety.length > 0) out.push("", ...sheet.safety);
  for (const group of sheet.groups) {
    out.push("", group.heading);
    for (const note of group.notes) {
      out.push(`- ${note.date}`);
      out.push(...note.text.split("\n").map((line) => `  ${line}`));
    }
  }
  return out.join("\n");
}
