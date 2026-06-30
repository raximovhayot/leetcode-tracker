import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/appwrite/config";
import { createAdminClient } from "@/lib/appwrite/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google OAuth success callback. Appwrite redirects here with userId + secret;
 * we exchange them for a session and persist its secret in an HTTP-only cookie.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const origin = request.nextUrl.origin;

  if (!userId || !secret) {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  try {
    const { account } = createAdminClient();
    const session = await account.createSession(userId, secret);

    (await cookies()).set(SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expire),
    });

    return NextResponse.redirect(origin);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }
}
