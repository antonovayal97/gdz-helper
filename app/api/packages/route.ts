import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { handleError } from "@/lib/server/api";
import { listActivePackages } from "@/services/payment";
import type { CreditPackageDto } from "@/types";

export const dynamic = "force-dynamic";

/** GET /api/packages — active credit packages (prices from DB). */
export async function GET(): Promise<NextResponse> {
  try {
    await requireUser();
    const packages = await listActivePackages();
    const result: CreditPackageDto[] = packages.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      price: p.price,
      currency: p.currency,
    }));
    return NextResponse.json({ ok: true, packages: result });
  } catch (err) {
    return handleError(err);
  }
}
