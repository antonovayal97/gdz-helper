"use client";

import { useMemo } from "react";
import katex from "katex";

/**
 * LaTeX rendering shared by `Formula` and `MathText`.
 *
 * The model wraps formulas in \( ... \) (see lib/ai/prompt.ts), but those
 * delimiters also land inside prose fields (explanations, answers) and are
 * sometimes double-escaped to \\( ... \\) by some providers. This renderer
 * handles paired \( \) / \[ \] (single- and double-escaped), $...$ and
 * $$...$$ when the content looks like math, keeps plain text intact, and
 * drops stray unpaired delimiters so they never show up as raw "\)".
 */

// Alternative order matters: \(\) and \[\] first, then $$ before single $.
const MATH_RE =
  /\\{1,2}\(\s*([\s\S]+?)\s*\\{1,2}\)|\\{1,2}\[\s*([\s\S]+?)\s*\\{1,2}\]|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/** Any leftover (unpaired) LaTeX delimiter — always a parsing artifact in prose. */
const STRAY_DELIM_RE = /\\{1,2}[()\[\]]/g;

const KATEX_OPTS = {
  strict: false,
  output: "html",
  throwOnError: false,
} as const;

function renderMath(body: string, display: boolean): string {
  try {
    return katex.renderToString(body, { ...KATEX_OPTS, displayMode: display });
  } catch {
    return escapeHtml(body);
  }
}

/**
 * A single `$` is ambiguous (currency: "100 $ и 200 $"), so $...$ is only
 * treated as math when its body carries a LaTeX signal.
 */
function looksLikeMath(body: string): boolean {
  return /\\|\^|_|[{}]/.test(body);
}

/**
 * Split text on math segments and render: KaTeX for formulas, escaped plain
 * text between them. Returns null when the text has no math delimiters.
 */
function renderMixed(text: string): string | null {
  let html = "";
  let cursor = 0;
  let found = false;
  let match: RegExpExecArray | null;

  MATH_RE.lastIndex = 0;
  while ((match = MATH_RE.exec(text)) !== null) {
    const body = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (!body) continue;
    if (match[4] !== undefined && !looksLikeMath(body)) continue;

    found = true;
    html += escapeText(text.slice(cursor, match.index));
    html += renderMath(body, match[2] !== undefined || match[3] !== undefined);
    cursor = match.index + match[0].length;
  }

  if (!found) return null;
  return html + escapeText(text.slice(cursor));
}

function escapeText(text: string): string {
  return escapeHtml(text.replace(STRAY_DELIM_RE, ""));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a formula field as math. Accepts bare LaTeX (`2x = 15 - 5`), a
 * delimited formula (`\( ... \)`) or prose with embedded formulas; falls
 * back to plain monospace text when KaTeX cannot parse the whole string.
 */
export function Formula({ text, className = "" }: { text: string; className?: string }) {
  const result = useMemo(() => {
    const trimmed = text.trim();
    const mixed = renderMixed(trimmed);
    if (mixed !== null) return { html: mixed, failed: false };
    try {
      // Bare formula — validate with a strict parse so a broken string
      // falls back to readable text instead of KaTeX's red error markup.
      try {
        return {
          html: katex.renderToString(trimmed, {
            ...KATEX_OPTS,
            throwOnError: true,
            displayMode: false,
          }),
          failed: false,
        };
      } catch {
        // Some models drop the opening \( but keep the closing \) (invalid
        // JSON escapes get eaten by lenient parsers). Strip stray delimiters
        // and try once more before giving up on math rendering.
        const cleaned = trimmed.replace(STRAY_DELIM_RE, "").trim();
        if (!cleaned || cleaned === trimmed) throw new Error("unrenderable");
        return {
          html: katex.renderToString(cleaned, {
            ...KATEX_OPTS,
            throwOnError: true,
            displayMode: false,
          }),
          failed: false,
        };
      }
    } catch {
      return { html: "", failed: true };
    }
  }, [text]);

  if (result.failed) {
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
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}

/**
 * Render a prose field (explanation, answer, condition…) that may contain
 * inline LaTeX between \( \) / \[ \] / $ $ delimiters, with plain text
 * preserved around it.
 */
export function MathText({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(() => renderMixed(text) ?? escapeText(text), [text]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}