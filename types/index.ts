/** Shared types used across client and server. */

export type ExplanationMode = "answer" | "step-by-step" | "schoolboy";

export const EXPLANATION_MODES: { value: ExplanationMode; label: string }[] = [
  { value: "answer", label: "Только ответ" },
  { value: "step-by-step", label: "Пошаговое решение" },
  { value: "schoolboy", label: "Объясни как школьнику" },
];

export type AIProviderName = "mock" | "openrouter" | "bitcoincom";

/** One step of a math solution, as returned by the AI. */
export interface AiStep {
  title: string;
  explanation: string;
  formula?: string;
}

/** Structured AI result (already validated with Zod). */
export interface AiResult {
  subject: string;
  grade: number | null;
  recognizedProblem: string;
  answer: string;
  steps: AiStep[];
  confidence: number;
}

/** Cost/usage accounting for a single AI request. */
export interface AiUsage {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  latencyMs: number | null;
  status: "ok" | "failed" | "timeout";
}

export interface SolveProblemRequest {
  image: { data: Buffer; mimeType: string };
  mode: ExplanationMode;
}

export interface SolveProblemResult {
  result: AiResult;
  usage: AiUsage;
}

export type SubjectKey =
  | "math"
  | "physics"
  | "chemistry"
  | "biology"
  | "literature"
  | "history"
  | "geography"
  | "english"
  | "russian"
  | "informatics"
  | "other";

export const SUBJECT_LABELS: Record<string, string> = {
  math: "Математика",
  physics: "Физика",
  chemistry: "Химия",
  biology: "Биология",
  literature: "Литература",
  history: "История",
  geography: "География",
  english: "Английский",
  russian: "Русский язык",
  informatics: "Информатика",
  other: "Разное",
};

export const SUBJECT_EMOJI: Record<string, string> = {
  math: "📐",
  physics: "⚛️",
  chemistry: "🧪",
  biology: "🧬",
  literature: "📖",
  history: "🏛️",
  geography: "🌍",
  english: "🔤",
  russian: "📝",
  informatics: "💻",
  other: "📚",
};

/** Standardized error payload returned by the API. */
export interface ApiErrorBody {
  error: {
    code:
      | "VALIDATION_ERROR"
      | "UNAUTHORIZED"
      | "INVALID_INIT_DATA"
      | "INSUFFICIENT_CREDITS"
      | "IMAGE_TOO_LARGE"
      | "INVALID_IMAGE_TYPE"
      | "PROBLEM_NOT_RECOGNIZED"
      | "AI_ERROR"
      | "AI_TIMEOUT"
      | "RATE_LIMITED"
      | "NOT_FOUND"
      | "PAYMENT_ERROR"
      | "INTERNAL";
    message: string;
    details?: unknown;
  };
}

/** User as exposed to the client. */
export interface PublicUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  balance: number;
  referralCode: string;
  createdAt: string;
}

/** Solution summary for list views. */
export interface SolutionSummary {
  id: string;
  subject: string;
  grade: number | null;
  recognizedProblem: string;
  answer: string;
  createdAt: string;
  confidence: number | null;
}

/** Full solution for detail view. */
export interface SolutionDetail extends SolutionSummary {
  imageUrl: string;
  steps: AiStep[];
  explanationMode: string | null;
  model: string | null;
  provider: string | null;
}

export interface CreditPackageDto {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
}
