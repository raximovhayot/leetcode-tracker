import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/appwrite/config";
import { createSessionClient } from "@/lib/appwrite/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { account } = await createSessionClient();
    await account.deleteSession("current");
  } catch {
    // Session may already be invalid; clearing the cookie is enough.
  }
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
