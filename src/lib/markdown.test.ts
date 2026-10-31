import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArticleFile } from "@/server/knowledge";
import { type Block, type Inline, parseInline, parseMarkdown } from "./markdown";

const inlineText = (nodes: Inline[]): string =>
  nodes
    .map((n) => (n.type === "text" ? n.text : n.type === "cite" ? "" : inlineText(n.children)))
    .join("");
const plainText = (blocks: Block[]) =>
  blocks
    .map((b) => (b.type === "list" ? b.items.map(inlineText).join(" ") : inlineText(b.children)))
    .join(" ");

describe("parseMarkdown", () => {
  it("reads headings, paragraphs and lists", () => {
    const blocks = parseMarkdown(
      "Intro line\ncontinues.\n\n## What to bring\n\n- A charger\n- Snacks\n\nDone.",
    );
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "heading", "list", "paragraph"]);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [{ type: "text", text: "Intro line continues." }],
    });
    expect(blocks[2]).toMatchObject({
      type: "list",
      items: [[{ text: "A charger" }], [{ text: "Snacks" }]],
    });
  });

  it("a list right after a paragraph line starts a new block", () => {
    const blocks = parseMarkdown("**Contacts**\n- Care team\n- School");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list"]);
  });

  it("never passes HTML through: it stays text", () => {
    const [block] = parseMarkdown("<script>alert(1)</script> [1]");
    expect(block).toEqual({
      type: "paragraph",
      children: [
        { type: "text", text: "<script>alert(1)</script> " },
        { type: "cite", handles: [1] },
      ],
    });
  });

  it("parses every KB article without losing words", () => {
    for (const lang of ["en", "es"]) {
      const dir = path.join(process.cwd(), "content", "kb", lang);
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
        const { body } = parseArticleFile(readFileSync(path.join(dir, file), "utf8"));
        const text = plainText(parseMarkdown(body));
        const words = body
          .replace(/[#*\-•]/g, " ")
          .split(/\s+/)
          .filter(Boolean);
        for (const word of words) expect(text, `${lang}/${file}: ${word}`).toContain(word);
      }
    }
  });
});

describe("parseInline", () => {
  it("reads bold, italic and single or grouped citations", () => {
    expect(parseInline("**Ask** the *nurse* [2] or both [1, 3].")).toEqual([
      { type: "strong", children: [{ type: "text", text: "Ask" }] },
      { type: "text", text: " the " },
      { type: "em", children: [{ type: "text", text: "nurse" }] },
      { type: "text", text: " " },
      { type: "cite", handles: [2] },
      { type: "text", text: " or both " },
      { type: "cite", handles: [1, 3] },
      { type: "text", text: "." },
    ]);
  });

  it("leaves non-citation brackets as text", () => {
    expect(parseInline("[email removed]")).toEqual([{ type: "text", text: "[email removed]" }]);
  });
});
