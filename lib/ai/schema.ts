import { z } from "zod";
import { SUBJECT_LABELS } from "@/types";

export const aiStepSchema = z.object({
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(4000),
  formula: z.string().nullable().optional(),
});

export const aiResultSchema = z
  .object({
    subject: z.string().trim().min(1).max(64),
    grade: z.number().int().min(1).max(12).nullable().optional(),
    recognizedProblem: z.string().min(0).max(8000),
    correctnessCheck: z.string().max(4000).optional().nullable().default(""),
    steps: z.array(aiStepSchema).max(16).default([]),
    answer: z.string().min(1).max(4000),
    confidence: z.number().min(0).max(1).default(0),
  })
  .transform((d) => ({
    subject: SUBJECT_LABELS[d.subject] ? d.subject : "other",
    grade: d.grade ?? null,
    recognizedProblem: d.recognizedProblem.trim(),
    answer: d.answer.trim(),
    steps: d.steps.map((s) => ({
      title: s.title.trim(),
      explanation: s.explanation.trim(),
      formula: s.formula?.trim() || undefined,
    })),
    confidence: d.confidence,
  }));

export type AiResultParsed = z.infer<typeof aiResultSchema>;
