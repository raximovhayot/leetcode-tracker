import { type NextRequest, NextResponse } from "next/server";

import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/server";

export const runtime = "nodejs";

/** Revokes one of the current user's login sessions. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { account } = await createSessionClient();
    await account.deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
