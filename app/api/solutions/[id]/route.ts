import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { getSolution } from "@/services/solution";

export const dynamic = "force-dynamic";

/** GET /api/solutions/:id — full detail of one solution (owner only). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const { id } = await params;
    const solution = await getSolution(user.id, id);
    if (!solution) {
      return handleError(new Error("NOT_FOUND"));
    }
    return NextResponse.json({ ok: true, solution });
  } catch (err) {
    return handleError(err);
  }
}
