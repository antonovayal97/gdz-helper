import { ResultScreen } from "@/components/result-screen";

/**
 * Server page: awaits the dynamic route param and passes the plain id to the
 * client-side ResultScreen (which fetches the solution from the API).
 * When several tasks were solved from one photo, the batch ids and task
 * numbers arrive as query params (`?ids=..&nums=..`) so the screen can offer
 * a switcher between them.
 */
export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const ids =
    typeof sp.ids === "string"
      ? sp.ids.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const nums =
    typeof sp.nums === "string"
      ? sp.nums.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  return (
    <ResultScreen
      id={id}
      batchIds={ids.length > 1 ? ids : undefined}
      batchNumbers={nums.length > 1 ? nums : undefined}
    />
  );
}
