import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { getReferralInfo } from "@/services/referral";

export const dynamic = "force-dynamic";

/** GET /api/referral — referral link and stats for the current user. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const referral = await getReferralInfo(user.id);
    return NextResponse.json({ ok: true, referral });
  } catch (err) {
    return handleError(err);
  }
}
