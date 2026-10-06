"use client";

import { useMemo } from "react";
import katex from "katex";

/**
 * Render a formula string as math. Accepts LaTeX with optional \( ... \)
 * delimiters; falls back to plain, monospace text when KaTeX fails to parse.
 */
export function Formula({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const trimmed = text.trim();
    // Strip optional \( ... \) LaTeX delimiters.
    let cleaned = trimmed;
    if (cleaned.startsWith("\\(")) cleaned = cleaned.slice(2);
    if (cleaned.endsWith("\\)")) cleaned = cleaned.slice(0, -2);
    cleaned = cleaned.trim();
    try {
      return katex.renderToString(cleaned, {
        throwOnError: false,
        displayMode: false,
        strict: false,
        output: "html",
      });
    } catch {
      return null;
    }
  }, [text]);

  if (html === null) {
    return (
      <code
        className={`block overflow-x-auto whitespace-pre-wrap break-words rounded-xl px-3 py-2 font-mono text-[15px] ${
          className || "bg-card text-foreground"
        }`}
      >
        {text}
      </code>
    );
  }

  return (
    // KaTeX output is escaped/sanitized by the library itself.
    <div
      className={`overflow-x-auto py-0.5 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
