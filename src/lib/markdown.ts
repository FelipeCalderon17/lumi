/**
 * A deliberately tiny Markdown reader for the KB articles and answer text: `##`/`###`
 * headings, paragraphs, `-` lists, **bold**, *italic*, and citation handles `[1]` / `[1, 3]`.
 * It never produces HTML: the React renderer turns these blocks into elements, so nothing in an
 * article or a model answer can inject markup. (No dependency: the KB uses only this subset.)
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "cite"; handles: number[] };

export type Block =
  | { type: "heading"; level: 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; items: Inline[][] };

const HEADING = /^(#{2,3})\s+(.*)$/;
const LIST_ITEM = /^\s*[-*•]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", items: list.map(parseInline) });
      list = null;
    }
  };

  for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]?.length === 3 ? 3 : 2;
      blocks.push({ type: "heading", level, children: parseInline(heading[2] ?? "") });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushParagraph();
      list ??= [];
      list.push(item[1] ?? "");
      continue;
    }
    if (list) {
      // A continuation line of the previous list item.
      if (/^\s+/.test(rawLine) && list.length > 0) {
        list[list.length - 1] += ` ${line.trim()}`;
        continue;
      }
      flushList();
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

const INLINE = /\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|\[(\d+(?:\s*,\s*\d+)*)\]/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: text.slice(last, index) });
    if (match[1] !== undefined) out.push({ type: "strong", children: parseInline(match[1]) });
    else if (match[2] !== undefined) out.push({ type: "em", children: parseInline(match[2]) });
    else {
      const handles = (match[3] ?? "").split(",").map((h) => Number.parseInt(h.trim(), 10));
      out.push({ type: "cite", handles });
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/**
 * Presentation only, for answers: removes every citation marker ("[7]", "[2, 6]"), so the parent
 * reads plain text. The guides are listed once, below the answer, in its Sources list.
 * Spacing: a marker between two words or formatted runs leaves exactly ONE space ("Ask [2] the
 * nurse" → "Ask the nurse", "Ask [2]**the social worker**" → "Ask **the social worker**"). The
 * space collapses before punctuation ("helps [7]." → "helps.") and at the start or end of a
 * line, item or formatted run. The parser keeps cite nodes, and the server still requires and
 * checks citations. Returns the same array when there's nothing to remove.
 */
export function stripCitations(blocks: Block[]): Block[] {
  const hasCite = (nodes: Inline[]): boolean =>
    nodes.some((node) => node.type === "cite" || (node.type !== "text" && hasCite(node.children)));
  if (
    !blocks.some((block) =>
      block.type === "list" ? block.items.some(hasCite) : hasCite(block.children),
    )
  )
    return blocks;

  const punctuation = /^[.,;:!?)\]}…]/;
  const strip = (nodes: Inline[]): Inline[] => {
    const out: Inline[] = [];
    const append = (text: string) => {
      const before = out.at(-1);
      if (before?.type === "text") out[out.length - 1] = { type: "text", text: before.text + text };
      else if (text !== "") out.push({ type: "text", text });
    };
    // After a removed marker: is a separator owed, and did whitespace touch the marker?
    let removed = false;
    let spaced = false;
    for (const node of nodes) {
      if (node.type === "cite") {
        const before = out.at(-1);
        if (before?.type === "text" && /\s$/.test(before.text)) {
          spaced = true;
          const trimmed = before.text.trimEnd();
          if (trimmed === "") out.pop();
          else out[out.length - 1] = { type: "text", text: trimmed };
        }
        removed = true;
        continue;
      }
      if (node.type === "text") {
        if (!removed) {
          append(node.text);
          continue;
        }
        if (/^\s/.test(node.text)) spaced = true;
        const rest = node.text.trimStart();
        if (rest === "") continue; // only whitespace: the next node decides
        const space = out.length > 0 && spaced && !punctuation.test(rest);
        append(space ? ` ${rest}` : rest);
        removed = false;
        spaced = false;
        continue;
      }
      if (removed && spaced && out.length > 0) append(" ");
      removed = false;
      spaced = false;
      out.push({ ...node, children: strip(node.children) });
    }
    return out;
  };
  return blocks.map((block) =>
    block.type === "list"
      ? { ...block, items: block.items.map(strip) }
      : { ...block, children: strip(block.children) },
  );
}
