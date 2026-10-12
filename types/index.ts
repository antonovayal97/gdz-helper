/** Shared types used across client and server. */

export type ExplanationMode = "answer" | "step-by-step" | "schoolboy" | "parent";

export const EXPLANATION_MODES: { value: ExplanationMode; label: string }[] = [
  { value: "answer", label: "Только ответ" },
  { value: "step-by-step", label: "Пошаговое решение" },
  { value: "schoolboy", label: "Объясни как ребенку" },
  { value: "parent", label: "Объяснить родителю" },
];

/** Human-readable label for a stored mode value (unknown values pass through). */
export function explanationModeLabel(mode: string | null | undefined): string | null {
  if (!mode) return null;
  return EXPLANATION_MODES.find((m) => m.value === mode)?.label ?? mode;
}

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
  recognizedProblem: string;
  answer: string;
  steps: AiStep[];
  confidence: number;
}

/**
 * Cost/usage accounting for a single AI request.
 * `estimatedCost` is in USD — the exact per-request charge reported by the
 * provider (`usage.cost`) when available, otherwise a pricing-table estimate.
 */
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
  /** Label of the chosen task as seen on the photo ("501", "9.15", "А5", ...). */
  taskNumber?: string | null;
}

export interface SolveProblemResult {
  result: AiResult;
  usage: AiUsage;
}

/** Detect task numbers visible on a photo (best-effort, no credit charge). */
export interface DetectProblemsRequest {
  image: { data: Buffer; mimeType: string };
}

export interface DetectProblemsResult {
  /** Task labels found on the photo ("501", "9.15", "А5", ...). */
  numbers: string[];
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
      | "INVALID_CREDENTIALS"
      | "EMAIL_ALREADY_USED"
      | "INSUFFICIENT_CREDITS"
      | "IMAGE_TOO_LARGE"
      | "INVALID_IMAGE_TYPE"
      | "PROBLEM_NOT_RECOGNIZED"
      | "NOT_A_TASK"
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
  /** present for accounts created inside the Telegram Mini App */
  telegramId: string | null;
  /** present for accounts created via email registration */
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  balance: number;
  referralCode: string;
  /** true once the new-user onboarding tour has been completed or skipped */
  onboarded: boolean;
  createdAt: string;
}

/** Solution summary for list views. */
export interface SolutionSummary {
  id: string;
  subject: string;
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
  /** AI cost estimate for this solution, in USD. */
  estimatedCost: number | null;
}

/** Lifecycle of an async solve queue entry. */
export type SolutionJobStatus = "queued" | "processing" | "done" | "error";

/** As exposed to the client via GET /api/solutions/status?jobId=... */
export interface SolutionJobDto {
  id: string;
  status: SolutionJobStatus;
  /** present when status === "done" — ids of created Solution rows */
  solutionIds: string[];
  /** task labels the AI failed to solve (never charged) */
  failedTaskNumbers: string[];
  /** when status === "error" */
  errorCode: string | null;
  errorMessage: string | null;
  /**
   * While status === "queued" — 1-based position in the live FIFO queue
   * (queued + processing jobs created before this one). null otherwise.
   */
  queuePosition: number | null;
  /** Total live jobs (queued + processing) at poll time, including this one. */
  queueSize: number;
}

/** Kind of a balance ledger entry. */
export type BalanceTxType = "signup" | "payment" | "referral" | "solution" | "refund";

/** One balance change as exposed to the client (ledger of top-ups/write-offs). */
export interface BalanceTransactionDto {
  id: string;
  type: BalanceTxType;
  /** Signed credits: > 0 — пополнение, < 0 — списание. */
  amount: number;
  /** Balance right after the operation. */
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}
