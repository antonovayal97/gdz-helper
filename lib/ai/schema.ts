import { z } from "zod";
import { SUBJECT_LABELS } from "@/types";

export const aiStepSchema = z.object({
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(4000),
  formula: z.string().nullable().optional(),
});

export const aiResultSchema = z
  .object({
    // Content gate: the model must confirm the photo holds a school task.
    // Defaults to true so responses that omit the field keep the old behaviour.
    // Also accepts the string form ("false") — some VL models quote booleans;
    // anything that is not an explicit negative is treated as a task.
    isTask: z
      .union([z.boolean(), z.string().trim().max(10)])
      .default(true)
      .transform((v) =>
        typeof v === "boolean" ? v : !["false", "0", "no", "нет"].includes(v.toLowerCase()),
      ),
    subject: z.string().trim().max(64).optional().nullable().default(""),
    // Allowed to be empty for non-task rejections and unreadable photos.
    recognizedProblem: z.string().max(8000).optional().nullable().default(""),
    correctnessCheck: z.string().max(4000).optional().nullable().default(""),
    steps: z.array(aiStepSchema).max(16).default([]),
    // Empty only when isTask === false (see the check below); real
    // solutions must still carry a non-empty answer.
    answer: z.string().max(4000).optional().nullable().default(""),
    confidence: z.number().min(0).max(1).default(0),
  })
  .refine((d) => !d.isTask || (d.answer ?? "").trim().length > 0, {
    // A genuine solution must carry an answer. The non-task gate returns the
    // all-empty object prescribed by the system prompt — never reject it here,
    // or the clean NOT_A_TASK flow would degrade into a generic AI_ERROR.
    message: "answer is required when isTask is true",
    path: ["answer"],
  })
  .transform((d) => {
    const subject = (d.subject ?? "").trim();
    return {
      isTask: d.isTask,
      subject: SUBJECT_LABELS[subject] ? subject : "other",
      recognizedProblem: (d.recognizedProblem ?? "").trim(),
      answer: (d.answer ?? "").trim(),
      steps: d.steps.map((s) => ({
        title: s.title.trim(),
        explanation: s.explanation.trim(),
        formula: s.formula?.trim() || undefined,
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
