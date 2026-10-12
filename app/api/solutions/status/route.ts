import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { getSolutionJobStatus } from "@/services/solution";

export const dynamic = "force-dynamic";

/** GET /api/solutions/status?jobId=... — poll the result of an async solve job. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
    if (!jobId) return handleError(new Error("NOT_FOUND"));

    const job = await getSolutionJobStatus(user.id, jobId);
    if (!job) return handleError(new Error("NOT_FOUND"));

    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return handleError(err);
  }
}
