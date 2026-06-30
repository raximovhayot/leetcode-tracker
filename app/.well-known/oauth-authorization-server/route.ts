import { type NextRequest, NextResponse } from "next/server";

import { baseUrl, corsHeaders, MCP_SCOPE } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 8414 Authorization Server Metadata. Advertises the authorization, token
 * and dynamic-registration endpoints plus the PKCE method MCP clients require.
 */
export function GET(request: NextRequest) {
  const base = baseUrl(request);
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [MCP_SCOPE],
    },
    { headers: corsHeaders() },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
