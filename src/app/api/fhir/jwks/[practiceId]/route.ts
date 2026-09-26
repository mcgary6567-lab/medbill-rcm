import { getDb } from "@/db";
import { jwksFor } from "@/server/fhir-smart";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public keys only, for the practice's EHR to verify CollaboratMD's SMART client assertions. */
export async function GET(_req: Request, { params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  if (!UUID.test(practiceId)) return Response.json({ keys: [] }, { status: 404 });
  const body = await jwksFor(await getDb(), practiceId);
  return Response.json(body, { status: body.keys.length ? 200 : 404, headers: { "Cache-Control": "public, max-age=300" } });
}
