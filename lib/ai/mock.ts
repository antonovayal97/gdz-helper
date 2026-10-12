import type {
  AiResult,
  AiUsage,
  DetectProblemsRequest,
  DetectProblemsResult,
  SolveProblemRequest,
  SolveProblemResult,
} from "@/types";
import { calculateAiCost } from "@/config/ai-models";
import { AIProvider, AIProviderError } from "./provider";

/**
 * Mock costs are computed through the real pricing table so the numbers
 * shown in the UI match what the configured models would actually charge.
 * "answer"-style short replies are priced like the cheap model.
 */
const MOCK_MAIN_MODEL = "qwen/qwen3-vl-235b-a22b-instruct";
const MOCK_CHEAP_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Mock AI provider — used for local development when no AI key is configured.
 * Produces a deterministic, realistic "solution" so the full flow
 * (upload → loading → result) works end-to-end without external calls.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock/gdz-model-v1";

  isAvailable(): boolean {
    return true;
  }

  async solveProblem(request: SolveProblemRequest): Promise<SolveProblemResult> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 1800 + Math.random() * 1500));

    const started = Date.now();

    // Simulate a rare failure to show error handling
    if (request.image.data.length === 0) {
      throw new AIProviderError("Empty image", "response");
    }

    const result: AiResult = {
      subject: "math",
      recognizedProblem:
        "Решите уравнение: 2x + 5 = 15. Найдите x. (условие распознано с фотографии)",
      answer: "x = 5",
      steps: [
        {
          title: "Записываем уравнение",
          explanation: "Дано линейное уравнение 2x + 5 = 15.",
          formula: "2x + 5 = 15",
        },
        {
          title: "Переносим свободный член",
          explanation:
            "Переносим 5 в правую часть с противоположным знаком: вычитаем 5 из обеих частей.",
          formula: "2x = 15 - 5",
        },
        {
          title: "Упрощаем",
          explanation: "Вычисляем правую часть: 15 − 5 = 10.",
          formula: "2x = 10",
        },
        {
          title: "Находим x",
          explanation: "Делим обе части уравнения на коэффициент при x, то есть на 2.",
          formula: "x = \\frac{10}{2}",
        },
        {
          title: "Получаем ответ",
          explanation: "x = 5. Проверка: 2·5 + 5 = 10 + 5 = 15 — верно.",
          formula: "x = 5",
        },
      ],
      confidence: 0.98,
    };

    const usage: AiUsage = {
      provider: this.name,
      model: this.model,
      inputTokens: 1200,
      outputTokens: 240,
      estimatedCost: calculateAiCost(MOCK_MAIN_MODEL, 1200, 240),
      latencyMs: Date.now() - started,
      status: "ok",
    };

    return { result, usage };
  }

  async detectProblems(request: DetectProblemsRequest): Promise<DetectProblemsResult> {
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
    const started = Date.now();

    // Deterministic-ish mock: base the detected count on the image size.
    const n = request.image.data.length % 3;
    if (n === 2) {
      return {
        numbers: ["501", "502", "503"],
        usage: this.mockUsage(1200, 80, started),
      };
    }
    if (n === 1) {
      return {
        numbers: ["А5"],
        usage: this.mockUsage(900, 40, started),
      };
    }
    return { numbers: [], usage: this.mockUsage(700, 20, started) };
  }

  private mockUsage(inputTokens: number, outputTokens: number, started: number): AiUsage {
    return {
      provider: this.name,
      model: this.model,
      inputTokens,
      outputTokens,
      estimatedCost: calculateAiCost(MOCK_CHEAP_MODEL, inputTokens, outputTokens),
      latencyMs: Date.now() - started,
      status: "ok",
    };
  }
}
