"use client";

import katex from "katex";

export function MathRenderer({
  formula,
  displayMode = false,
}: {
  formula: string;
  displayMode?: boolean;
}) {
  const html = katex.renderToString(formula, {
    displayMode,
    throwOnError: false,
    output: "htmlAndMathml",
  });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
