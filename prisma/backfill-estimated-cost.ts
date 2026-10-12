/**
 * One-off backfill: recompute Solution.estimatedCost from the stored
 * input/output token counts using the current MODEL_PRICING_USD table.
 *
 * Historical rows were written with outdated prices (and before the provider
 * `usage.cost` passthrough existed), so the displayed cost price was wrong.
 * New requests store the exact billed amount reported by the provider, so
 * this only needs to run once after a pricing-table change.
 *
 * Rows with provider "mock" (or missing tokens) are skipped — their usage is
 * simulated, not billed.
 *
 * Run with: npx tsx prisma/backfill-estimated-cost.ts [--dry-run]
 */
import { PrismaClient } from "@prisma/client";
import { calculateAiCost } from "../config/ai-models";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const rows = await prisma.solution.findMany({
    where: {
      provider: { notIn: ["mock"] },
      model: { not: null },
      inputTokens: { not: null },
      outputTokens: { not: null },
    },
    select: {
      id: true,
      provider: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      estimatedCost: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    const cost = calculateAiCost(
      row.model as string,
      row.inputTokens as number,
      row.outputTokens as number,
    );
    if (cost === row.estimatedCost) continue;
    updated++;
    console.log(
      `${row.id} ${row.provider}/${row.model}: ${row.estimatedCost} -> ${cost}`,
    );
    if (!dryRun) {
      await prisma.solution.update({ where: { id: row.id }, data: { estimatedCost: cost } });
    }
  }

  console.log(`\nScanned ${rows.length} rows, ${updated} would change${dryRun ? " (dry run)" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
