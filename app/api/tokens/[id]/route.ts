import { type NextRequest, NextResponse } from "next/server";

import { deleteMcpToken } from "@/lib/appwrite/mcp-auth";
import { getLoggedInUser } from "@/lib/appwrite/server";

export const runtime = "nodejs";

/** Revokes one of the current user's MCP tokens. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const removed = await deleteMcpToken(user.$id, id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
