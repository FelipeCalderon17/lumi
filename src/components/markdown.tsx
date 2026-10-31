import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { type Block, type Inline, parseMarkdown } from "@/lib/markdown";
import type { Citation } from "@/server/events";

type CitationProps = {
  /** Citations from the answer event, by handle. Unknown handles render as plain text. */
  citations?: readonly Citation[];
  hrefFor?: (articleId: string) => string;
  labelFor?: (citation: Citation) => string;
};

function renderInline(nodes: Inline[], props: CitationProps, keyPrefix = ""): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.text}</Fragment>;
      case "strong":
        return (
          <strong key={key} className="font-bold text-text">
            {renderInline(node.children, props, `${key}-`)}
          </strong>
        );
      case "em":
        return <em key={key}>{renderInline(node.children, props, `${key}-`)}</em>;
      case "cite": {
        const { citations, hrefFor, labelFor } = props;
        if (!citations || !hrefFor)
          return <Fragment key={key}>[{node.handles.join(", ")}]</Fragment>;
        return (
          <span key={key} className="whitespace-nowrap">
            {node.handles.map((handle) => {
              const citation = citations.find((c) => c.handle === handle);
              if (!citation) return null;
              return (
                <Link
                  key={handle}
                  href={hrefFor(citation.articleId)}
                  aria-label={labelFor?.(citation)}
                  title={citation.title}
                  className="ml-1 inline-flex min-w-6 items-center justify-center rounded-pill border border-sage/60 px-1.5 align-[0.12em] font-semibold text-[0.78rem] leading-5 text-sage no-underline transition-colors duration-200 hover:bg-sage/15"
                >
                  {handle}
                </Link>
              );
            })}
          </span>
        );
      }
    }
    return null;
  });
}

function renderBlock(block: Block, i: number, props: CitationProps, headingOffset: number) {
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
          {renderInline(block.children, props)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={i} className="mt-4 first:mt-0">
          {renderInline(block.children, props)}
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
              {renderInline(item, props)}
            </li>
          ))}
        </ul>
      );
  }
}

/**
 * Renders KB articles and answers from our Markdown subset. Never uses innerHTML: text from an
 * article or a model answer is always rendered as text.
 */
export function Markdown({
  source,
  headingOffset = 0,
  className,
  ...props
}: { source: string; headingOffset?: number; className?: string } & CitationProps) {
  return (
    <div className={className}>
      {parseMarkdown(source).map((block, i) => renderBlock(block, i, props, headingOffset))}
    </div>
  );
}
