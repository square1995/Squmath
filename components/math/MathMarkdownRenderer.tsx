"use client";

import { useMemo } from "react";
import katex from "katex";

// ---------------------------------------------------------------
// Inline renderer: handles $math$ and **bold** within a text line
// ---------------------------------------------------------------
function InlineContent({ text, id }: { text: string; id: string }) {
  const tokens = useMemo(() => {
    type Token = { type: "text" | "math" | "bold"; content: string };
    const result: Token[] = [];
    // Match inline $...$ (not $$) or **...**
    const regex = /(\*\*(?:[^*]|\*(?!\*))+\*\*|\$(?!\$)[^$\n]+\$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      if (match[1].startsWith("**")) {
        result.push({ type: "bold", content: match[1].slice(2, -2) });
      } else {
        result.push({ type: "math", content: match[1].slice(1, -1) });
      }
      lastIndex = match.index + match[1].length;
    }
    if (lastIndex < text.length) {
      result.push({ type: "text", content: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.type === "bold") {
          return <strong key={`${id}-${i}`}>{token.content}</strong>;
        }
        if (token.type === "math") {
          const html = katex.renderToString(token.content, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={`${id}-${i}`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return <span key={`${id}-${i}`}>{token.content}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------
// Heading class map
// ---------------------------------------------------------------
const HEADING_CLASSES: Record<number, string> = {
  1: "text-2xl font-bold mt-4 mb-2 text-gray-900",
  2: "text-xl  font-bold mt-3 mb-2 text-gray-900",
  3: "text-lg  font-semibold mt-3 mb-1 text-gray-800",
  4: "text-base font-semibold mt-2 mb-1 text-gray-800",
  5: "text-sm  font-semibold mt-2 mb-1 text-gray-700",
  6: "text-sm  font-medium  mt-2 mb-1 text-gray-600",
};

// ---------------------------------------------------------------
// Main component
// ---------------------------------------------------------------
export function MathMarkdownRenderer({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.split("\n");
    const result: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // --- Heading: # / ## / ### ...
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const level = Math.min(headingMatch[1].length, 6) as 1 | 2 | 3 | 4 | 5 | 6;
        const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        result.push(
          <Tag key={i} className={HEADING_CLASSES[level]}>
            <InlineContent text={headingMatch[2]} id={`h${i}`} />
          </Tag>
        );
        i++;
        continue;
      }

      // --- Display math block: $$ (standalone or single-line)
      const trimmed = line.trim();
      if (trimmed.startsWith("$$")) {
        let mathContent: string;

        if (trimmed === "$$") {
          // Multi-line: collect until next $$
          const mathLines: string[] = [];
          i++;
          while (i < lines.length && lines[i].trim() !== "$$") {
            mathLines.push(lines[i]);
            i++;
          }
          i++; // consume closing $$
          mathContent = mathLines.join("\n");
        } else if (trimmed.endsWith("$$") && trimmed.length > 4) {
          // Single-line: $$...$$
          mathContent = trimmed.slice(2, -2);
          i++;
        } else {
          // Starts with $$ but no closing — treat as plain text
          result.push(
            <p key={i} className="text-sm leading-relaxed text-gray-800">
              <InlineContent text={line} id={`p${i}`} />
            </p>
          );
          i++;
          continue;
        }

        const html = katex.renderToString(mathContent, {
          displayMode: true,
          throwOnError: false,
        });
        result.push(
          <div
            key={i}
            className="my-3 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
        continue;
      }

      // --- Empty line
      if (trimmed === "") {
        result.push(<div key={i} className="h-2" />);
        i++;
        continue;
      }

      // --- Regular paragraph (inline math / bold)
      result.push(
        <p key={i} className="text-sm leading-relaxed text-gray-800">
          <InlineContent text={line} id={`p${i}`} />
        </p>
      );
      i++;
    }

    return result;
  }, [content]);

  return <div className="space-y-1">{blocks}</div>;
}
