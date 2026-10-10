import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { toPublicUser } from "@/lib/server/auth";
import { prisma } from "@/lib/db/prisma";

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

const patchSchema = z.object({
  onboarded: z.literal(true),
});

/**
 * PATCH /api/me — update the current user. Currently supports only
 * `onboarded: true`, which records the first-run tour completion (idempotent).
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const parsed = patchSchema.parse(await request.json());

    const updated = await prisma.user.update({
      where: { id: user.id },
      // Keep the original timestamp if the flag was already set.
      data: { onboardedAt: parsed.onboarded && !user.onboarded ? new Date() : undefined },
    });

    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (err) {
    return handleError(err);
  }
}
