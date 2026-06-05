/**
 * POST /api/chat — proxy to the SmartVolve Cloud Run backend.
 *
 * Accepts { text: string; tenantId: string } and forwards it to the
 * Cloud Run endpoint, keeping the external URL out of the client bundle.
 */

const CLOUD_RUN_URL =
  "https://smartvolve-onboarding-574563078834.europe-west8.run.app/chat";

export async function POST(request: Request) {
  /* ── Parse & validate incoming body ──────────────────────────────────── */
  let body: { text?: string; tenantId?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { text, tenantId } = body;

  if (!text || typeof text !== "string") {
    return Response.json(
      { error: "Missing or invalid 'text' field" },
      { status: 400 },
    );
  }

  if (!tenantId || typeof tenantId !== "string") {
    return Response.json(
      { error: "Missing or invalid 'tenantId' field" },
      { status: 400 },
    );
  }

  /* ── Forward to Cloud Run ────────────────────────────────────────────── */
  try {
    const upstream = await fetch(CLOUD_RUN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tenantId }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error(
        `[api/chat] Cloud Run responded ${upstream.status}: ${detail}`,
      );
      return Response.json(
        { error: "Upstream service error" },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return Response.json(data);
  } catch (err) {
    console.error("[api/chat] fetch failed:", err);
    return Response.json(
      { error: "Unable to reach the chat service" },
      { status: 502 },
    );
  }
}
