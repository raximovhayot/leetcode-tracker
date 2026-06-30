import { type NextRequest, NextResponse } from "next/server";

import { createMcpToken, listMcpTokens } from "@/lib/appwrite/mcp-auth";
import { getLoggedInUser } from "@/lib/appwrite/server";

export const runtime = "nodejs";

/** Lists the current user's MCP tokens (labels and dates only, no secrets). */
export async function GET() {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await listMcpTokens(user.$id);
  return NextResponse.json({ tokens });
}

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
