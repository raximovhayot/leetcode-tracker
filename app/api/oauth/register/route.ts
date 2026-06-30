import { type NextRequest, NextResponse } from "next/server";

import { corsHeaders, generateClientId } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 7591 Dynamic Client Registration. Clients are public (PKCE, no secret),
 * so registration is stateless: we mint a client_id and echo back the metadata.
 * The redirect_uri is later bound into the authorization code, so we don't need
 * to persist registrations.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty/invalid body is acceptable; defaults are applied below.
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris
    : [];

  return NextResponse.json(
    {
      client_id: generateClientId(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      redirect_uris: redirectUris,
      client_name: typeof body.client_name === "string" ? body.client_name : undefined,
      scope: typeof body.scope === "string" ? body.scope : "mcp",
    },
    { status: 201, headers: corsHeaders() },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
