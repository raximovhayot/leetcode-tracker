import { type NextRequest, NextResponse } from "next/server";

import { baseUrl, corsHeaders, MCP_SCOPE } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 9728 Protected Resource Metadata. MCP clients read this after a 401 to
 * discover which authorization server protects the `/api/mcp` resource.
 */
export function GET(request: NextRequest) {
  const base = baseUrl(request);
  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      scopes_supported: [MCP_SCOPE],
    },
    { headers: corsHeaders() },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
