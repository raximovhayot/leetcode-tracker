import { type NextRequest, NextResponse } from "next/server";

import { createMcpToken } from "@/lib/appwrite/mcp-auth";
import { getLoggedInUser } from "@/lib/appwrite/server";

export const runtime = "nodejs";

/**
 * Generates a personal MCP bearer token for the current user. The plaintext
 * token is returned exactly once and only its hash is stored.
 */
export async function POST(request: NextRequest) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let label = "default";
  try {
    const body = (await request.json()) as { label?: string };
    if (body?.label) label = body.label;
  } catch {
    // No body provided; use the default label.
  }

  const token = await createMcpToken(user.$id, label);
  return NextResponse.json({ token });
}
