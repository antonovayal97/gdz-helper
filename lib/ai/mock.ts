import type { AiResult, AiUsage, SolveProblemRequest, SolveProblemResult } from "@/types";
import { AIProvider, AIProviderError } from "./provider";

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
      grade: 8,
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
      estimatedCost: 0.0006,
      latencyMs: Date.now() - started,
      status: "ok",
    };

    return { result, usage };
  }
}
