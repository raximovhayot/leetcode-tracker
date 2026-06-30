import { type NextRequest, NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/appwrite/server";
import { baseUrl, issueAuthorizationCode } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Redirects an OAuth error back to the client, or 400s if we can't. */
function authError(
  redirectUri: string,
  state: string | null,
  error: string,
  description?: string,
) {
  if (redirectUri && /^https?:\/\//i.test(redirectUri)) {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    if (description) url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }
  return NextResponse.json(
    { error, error_description: description },
    { status: 400 },
  );
}

/**
 * OAuth 2.1 Authorization Endpoint. Requires the user to be signed in via the
 * app's Appwrite Google session; if not, it bounces through login and resumes.
 * On success it issues a PKCE-bound authorization code to the client.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const responseType = p.get("response_type") ?? "";
  const clientId = p.get("client_id") ?? "";
  const redirectUri = p.get("redirect_uri") ?? "";
  const codeChallenge = p.get("code_challenge") ?? "";
  const codeChallengeMethod = p.get("code_challenge_method") ?? "";
  const state = p.get("state");
  const base = baseUrl(request);

  if (!redirectUri || !/^https?:\/\//i.test(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid redirect_uri." },
      { status: 400 },
    );
  }
  if (responseType !== "code") {
    return authError(redirectUri, state, "unsupported_response_type");
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return authError(
      redirectUri,
      state,
      "invalid_request",
      "PKCE with code_challenge_method=S256 is required.",
    );
  }

  const user = await getLoggedInUser();
  if (!user) {
    // Resume this exact authorization request after the user logs in.
    const selfPath = request.nextUrl.pathname + request.nextUrl.search;
    return NextResponse.redirect(
      `${base}/login?next=${encodeURIComponent(selfPath)}`,
    );
  }

  const code = issueAuthorizationCode({
    userId: user.$id,
    clientId,
    redirectUri,
    codeChallenge,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}
