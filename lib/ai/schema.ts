import { z } from "zod";
import { SUBJECT_LABELS } from "@/types";

/**
 * A text field that never rejects the whole response: missing/null → "",
 * other types are stringified, overlong values are trimmed instead of
 * failing validation. Strict `.max()`/`.min()` limits here used to turn a
 * single slightly-off model field into an opaque
 * "AI returned invalid JSON or missing fields" 502.
 */
function lenientText(max: number) {
  return z
    .unknown()
    .optional()
    .transform((v) =>
      (v == null ? "" : typeof v === "string" ? v : String(v)).trim().slice(0, max),
    );
}

export const aiStepSchema = z.object({
  title: lenientText(200),
  explanation: lenientText(4000),
  formula: lenientText(1000).transform((s) => s || undefined),
});

export const aiResultSchema = z
  .object({
    // Content gate: the model must confirm the photo holds a school task.
    // Missing field defaults to true (old behaviour); anything that is not
    // an explicit negative ("false", "0", "no", "нет") is treated as a task.
    isTask: z.unknown().optional().transform((v) => {
      if (typeof v === "boolean") return v;
      if (v == null) return true;
      return !["false", "0", "no", "нет"].includes(String(v).trim().toLowerCase());
    }),
    subject: lenientText(64),
    // Allowed to be empty for non-task rejections and unreadable photos.
    recognizedProblem: lenientText(8000),
    correctnessCheck: lenientText(4000),
    // Some models wrap the array in an object or emit plain strings for
    // steps; salvage those instead of failing the whole reply.
    steps: z.preprocess((v) => {
      const list = Array.isArray(v)
        ? v.slice(0, 16)
        : v && typeof v === "object"
          ? Object.values(v).slice(0, 16)
          : [];
      return list.map((s) =>
        s && typeof s === "object" ? s : { title: "", explanation: String(s ?? "") },
      );
    }, z.array(aiStepSchema)),
    // May be empty when the model read the photo but could not finish the
    // solution (e.g. the condition was cut off in the photo). The provider
    // turns that into a clean business error — never a schema rejection,
    // or the NOT_A_TASK / honest-failure flows would degrade into a
    // generic AI_ERROR.
    answer: lenientText(4000),
    confidence: z.unknown().optional().transform((v) => {
      const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[%\s]/g, ""));
      if (!Number.isFinite(n) || n <= 0) return 0;
      if (n > 1) return n <= 100 ? n / 100 : 1; // tolerate percentage form ("95%")
      return Math.min(1, n);
    }),
  })
  .transform((d) => {
    const subject = d.subject;
    return {
      isTask: d.isTask,
      subject: SUBJECT_LABELS[subject] ? subject : "other",
      recognizedProblem: d.recognizedProblem,
      answer: d.answer,
      steps: d.steps.map((s) => ({
        title: s.title,
        explanation: s.explanation,
        formula: s.formula,
      })),
      confidence: d.confidence,
    };
  });

export type AiResultParsed = z.infer<typeof aiResultSchema>;

/**
 * Normalize a detected task label to a canonical string:
 * "№ 15" → "15", "а5" → "А5". Must contain at least one digit and be short.
 */
export function normalizeTaskLabel(raw: unknown): string | null {
  const s = String(raw)
    .trim()
    .replace(/^[№#]\s*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
  // Pure numbers ("501"), dotted numbering ("9.15") or a single-letter test
  // label ("А5", "B12"). Rejects page numbers like "СТР 245" and prose.
  const numeric = /^\d{1,5}(\.\d{1,4}){0,3}$/.test(s);
  const lettered = /^[A-ZА-ЯЁ]\.?\d{1,5}$/.test(s);
  return numeric || lettered ? s : null;
}

/**
 * Natural-order compare so "А5" < "А6" < "А10" and "9.9" < "9.10":
 * digit chunks compare numerically, the rest lexicographically.
 */
function compareTaskLabels(a: string, b: string): number {
  const ca = a.split(/(\d+)/).filter(Boolean);
  const cb = b.split(/(\d+)/).filter(Boolean);
  const len = Math.max(ca.length, cb.length);
  for (let i = 0; i < len; i++) {
    const x = ca[i] ?? "";
    const y = cb[i] ?? "";
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Parsed result of task detection (`DetectProblems`).
 * Labels may be pure numbers ("501"), dotted ("9.15") or test-style
 * letter+number combos ("А5", "Б12"). Accepts ints or strings, normalizes,
 * deduplicates and sorts naturally.
 */
export const aiNumbersSchema = z
  .object({
    numbers: z.array(z.union([z.string(), z.number()])).max(50).default([]),
  })
  .transform((d) => ({
    numbers: [
      ...new Set(d.numbers.map(normalizeTaskLabel).filter((s): s is string => s !== null)),
    ].sort(compareTaskLabels),
  }));

export type AiNumbersParsed = z.infer<typeof aiNumbersSchema>;
