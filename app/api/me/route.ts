import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/** GET /api/me — return the current authenticated user. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    return NextResponse.json({ user });
  } catch (err) {
    return handleError(err);
  }
}
