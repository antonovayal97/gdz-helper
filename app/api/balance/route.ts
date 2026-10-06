import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { getBalance } from "@/services/user";

export const dynamic = "force-dynamic";

/** GET /api/balance — current user balance. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const { balance } = await getBalance(user.id);
    return NextResponse.json({ ok: true, balance });
  } catch (err) {
    return handleError(err);
  }
}
