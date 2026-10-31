/** Fills `{name}` placeholders in dictionary copy: fill("{n} notes", { n: 3 }) → "3 notes". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
