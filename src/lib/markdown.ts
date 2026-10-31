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
 * Presentation only, for answers: when consecutive citations (across sentences, bullets and
 * paragraphs; a heading ends the run) all cite the same SINGLE handle, keep only the last pill
 * of the run. If the whole answer cites one guide, it shows one pill at the end. Grouped
 * citations ("[1, 3]") and changes of handle end a run, so every claim still sits before a pill
 * naming its source. The space left before a removed pill is trimmed ("helps [1]." → "helps.").
 */
export function collapseRepeatedCitations(blocks: Block[]): Block[] {
  // Every cite node in reading order, with the run it belongs to.
  type Slot = { node: Extract<Inline, { type: "cite" }>; run: number };
  const slots: Slot[] = [];
  let run = 0;
  let previous: number | null = null;
  const visit = (nodes: Inline[]) => {
    for (const node of nodes) {
      if (node.type === "cite") {
        const single = node.handles.length === 1 ? (node.handles[0] ?? null) : null;
        if (single === null || single !== previous) run += 1;
        previous = single;
        slots.push({ node, run });
      } else if (node.type !== "text") visit(node.children);
    }
  };
  for (const block of blocks) {
    if (block.type === "heading") {
      previous = null;
      continue;
    }
    if (block.type === "paragraph") visit(block.children);
    else for (const item of block.items) visit(item);
  }
  const lastOfRun = new Map<number, Slot["node"]>();
  for (const slot of slots) lastOfRun.set(slot.run, slot.node);
  const drop = new Set(slots.filter((s) => lastOfRun.get(s.run) !== s.node).map((s) => s.node));
  if (drop.size === 0) return blocks;

  const prune = (nodes: Inline[]): Inline[] => {
    const out: Inline[] = [];
    for (const node of nodes) {
      if (node.type === "cite" && drop.has(node)) {
        const before = out.at(-1);
        if (before?.type === "text") {
          const trimmed = before.text.trimEnd();
          if (trimmed === "") out.pop();
          else out[out.length - 1] = { type: "text", text: trimmed };
        }
        continue;
      }
      const before = out.at(-1);
      if (node.type === "text" && before?.type === "text") {
        // Rejoin the text on both sides of a removed pill.
        out[out.length - 1] = { type: "text", text: before.text + node.text };
        continue;
      }
      out.push(
        node.type === "strong" || node.type === "em"
          ? { ...node, children: prune(node.children) }
          : node,
      );
    }
    return out;
  };
  return blocks.map((block) =>
    block.type === "heading"
      ? block
      : block.type === "paragraph"
        ? { ...block, children: prune(block.children) }
        : { ...block, items: block.items.map(prune) },
  );
}
