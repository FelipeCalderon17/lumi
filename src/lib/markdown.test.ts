import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArticleFile } from "@/server/knowledge";
import { type Block, type Inline, parseInline, parseMarkdown, stripCitations } from "./markdown";

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

describe("stripCitations", () => {
  const text = (blocks: Block[]) => JSON.stringify(blocks);

  it("removes a single marker and the space before it", () => {
    expect(stripCitations(parseMarkdown("Naps help [7]. Keep a routine [7]"))).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Naps help. Keep a routine" }] },
    ]);
  });

  it("removes a grouped marker, leaving no bracket text", () => {
    const blocks = stripCitations(parseMarkdown("Ask the social worker [2, 6] about it."));
    expect(blocks).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Ask the social worker about it." }] },
    ]);
    expect(text(blocks)).not.toContain("cite");
  });

  it("keeps punctuation tight after a marker", () => {
    expect(
      stripCitations(parseMarkdown("Bring snacks [1], a charger [2]; and socks [3]!")),
    ).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", text: "Bring snacks, a charger; and socks!" }],
      },
    ]);
  });

  it("leaves no trailing space when a bullet ends with a marker, and no leading one when it starts with one", () => {
    expect(stripCitations(parseMarkdown("- Bring your ID [2]\n- [6] Pack clothes [2, 6]"))).toEqual(
      [
        {
          type: "list",
          items: [
            [{ type: "text", text: "Bring your ID" }],
            [{ type: "text", text: "Pack clothes" }],
          ],
        },
      ],
    );
  });

  it("removes markers inside bold and italic text, and in headings", () => {
    expect(
      stripCitations(
        parseMarkdown("## Money [3]\n\n**Call the billing office [3]** and *ask [4]*."),
      ),
    ).toEqual([
      { type: "heading", level: 2, children: [{ type: "text", text: "Money" }] },
      {
        type: "paragraph",
        children: [
          { type: "strong", children: [{ type: "text", text: "Call the billing office" }] },
          { type: "text", text: " and " },
          { type: "em", children: [{ type: "text", text: "ask" }] },
          { type: "text", text: "." },
        ],
      },
    ]);
  });

  it("returns the same blocks when there is no marker", () => {
    const blocks = parseMarkdown("No citations here.\n\n- Nor here.");
    expect(stripCitations(blocks)).toBe(blocks);
  });
});
