import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { listBalanceTransactions } from "@/services/balance";

export const dynamic = "force-dynamic";

/** GET /api/balance/history — ledger of balance top-ups and write-offs. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const transactions = await listBalanceTransactions(user.id, 100);
    return NextResponse.json({ ok: true, transactions });
  } catch (err) {
    return handleError(err);
  }
}
