"use client";

import katex from "katex";
import { useMemo } from "react";

interface MathRendererProps {
  formula: string;
  displayMode?: boolean;
  className?: string;
}

export function MathRenderer({
  formula,
  displayMode = false,
  className,
}: MathRendererProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        displayMode,
        throwOnError: false,
        output: "html",
      });
    } catch {
      return `<span class="text-red-500 text-sm">数式エラー: ${formula}</span>`;
    }
  }, [formula, displayMode]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
