import { ResultScreen } from "@/components/result-screen";

/**
 * Server page: awaits the dynamic route param and passes the plain id to the
 * client-side ResultScreen (which fetches the solution from the API).
 */
export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultScreen id={id} />;
}
