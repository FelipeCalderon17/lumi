import { Fragment, type ReactNode } from "react";
import { type Block, type Inline, parseMarkdown, stripCitations } from "@/lib/markdown";

function renderInline(nodes: Inline[], keyPrefix = ""): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.text}</Fragment>;
      case "strong":
        return (
          <strong key={key} className="font-bold text-text">
            {renderInline(node.children, `${key}-`)}
          </strong>
        );
      case "em":
        return <em key={key}>{renderInline(node.children, `${key}-`)}</em>;
      case "cite":
        // Kept as the original text where markers aren't hidden (answers hide them).
        return <Fragment key={key}>[{node.handles.join(", ")}]</Fragment>;
    }
    return null;
  });
}

function renderBlock(block: Block, i: number, headingOffset: number) {
  switch (block.type) {
    case "heading": {
      const level = Math.min(6, block.level + headingOffset);
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      return (
        <Tag
          key={i}
          className={
            block.level === 2
              ? "mt-10 font-display text-[1.65rem] leading-tight first:mt-0"
              : "mt-8 font-display text-xl"
          }
        >
          {renderInline(block.children)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={i} className="mt-4 first:mt-0">
          {renderInline(block.children)}
        </p>
      );
    case "list":
      return (
        <ul key={i} className="mt-3 space-y-2">
          {block.items.map((item, j) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
              key={j}
              className="relative pl-6 before:absolute before:top-[0.7em] before:left-1 before:size-1.5 before:rounded-pill before:bg-glow"
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
  }
}

/**
 * Renders KB articles and answers from our Markdown subset. Never uses innerHTML: text from an
 * article or a model answer is always rendered as text. `hideCitations` (answers) drops the
 * citation markers; the answer's Sources list names the guides instead.
 */
export function Markdown({
  source,
  headingOffset = 0,
  className,
  hideCitations = false,
}: {
  source: string;
  headingOffset?: number;
  className?: string;
  hideCitations?: boolean;
}) {
  const parsed = parseMarkdown(source);
  const blocks = hideCitations ? stripCitations(parsed) : parsed;
  return (
    <div className={className}>
      {blocks.map((block, i) => renderBlock(block, i, headingOffset))}
    </div>
  );
}
