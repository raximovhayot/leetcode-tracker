import { type NextRequest, NextResponse } from "next/server";

import {
  ACCESS_TOKEN_TTL,
  corsHeaders,
  issueAccessToken,
  MCP_SCOPE,
  verifyAuthorizationCode,
  verifyPkceS256,
} from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function tokenError(error: string, description?: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: corsHeaders(NO_STORE) },
  );
}

/** Reads request params from either form-urlencoded or JSON bodies. */
async function readParams(request: NextRequest): Promise<URLSearchParams> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(json)) {
        if (v != null) params.set(k, String(v));
      }
      return params;
    } catch {
      return new URLSearchParams();
    }
  }
  return new URLSearchParams(await request.text());
}

/**
 * OAuth 2.1 Token Endpoint. Exchanges a PKCE-bound authorization code for a
 * signed bearer access token scoped to the authenticated user.
 */
export async function POST(request: NextRequest) {
  const params = await readParams(request);
  const grantType = params.get("grant_type") ?? "";
  const code = params.get("code") ?? "";
  const codeVerifier = params.get("code_verifier") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const clientId = params.get("client_id") ?? "";

  if (grantType !== "authorization_code") {
    return tokenError("unsupported_grant_type");
  }
  if (!code || !codeVerifier) {
    return tokenError("invalid_request", "Missing code or code_verifier.");
  }

  const decoded = verifyAuthorizationCode(code);
  if (!decoded) {
    return tokenError("invalid_grant", "Authorization code is invalid or expired.");
  }
  if (redirectUri && decoded.redirectUri !== redirectUri) {
    return tokenError("invalid_grant", "redirect_uri mismatch.");
  }
  if (clientId && decoded.clientId && clientId !== decoded.clientId) {
    return tokenError("invalid_client", "client_id mismatch.", 401);
  }
  if (!verifyPkceS256(codeVerifier, decoded.codeChallenge)) {
    return tokenError("invalid_grant", "PKCE verification failed.");
  }

  const accessToken = issueAccessToken(decoded.userId);
  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      scope: MCP_SCOPE,
    },
    { headers: corsHeaders(NO_STORE) },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
