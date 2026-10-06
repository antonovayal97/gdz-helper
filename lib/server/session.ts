import { headers as nextHeaders } from "next/headers";
import { getCurrentUser } from "./auth";
import type { PublicUser } from "@/types";

/**
 * Resolve the current authenticated user for a Next.js route.
 * `next/headers` returns the incoming request headers synchronously in Next 16.
 */
export async function requireUser(): Promise<PublicUser & { id: string }> {
  const headers = await nextHeaders();
  const authorization = headers.get("authorization") ?? undefined;
  return getCurrentUser({ authorization });
}
