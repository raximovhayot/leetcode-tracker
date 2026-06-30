import { type NextRequest, NextResponse } from "next/server";

import { resolveTokenUserId } from "@/lib/appwrite/mcp-auth";
import { callTool, getToolDefinitions } from "@/lib/mcp/tools";

// Appwrite Sites / Functions buffer responses, so we run a stateless JSON-RPC
// transport (no SSE). Force the Node.js runtime for the Appwrite SDK + crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "leetcode-tracker", version: "1.0.0" };

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function rpcError(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } };
}

function bearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function handleRpc(
  message: JsonRpcRequest,
  userId: string,
): Promise<object | null> {
  switch (message.method) {
    case "initialize":
      return rpcResult(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      // Notifications carry no id and expect no response.
      return null;

    case "ping":
      return rpcResult(message.id, {});

    case "tools/list":
      return rpcResult(message.id, { tools: getToolDefinitions() });

    case "tools/call": {
      const params = message.params ?? {};
      const name = String(params.name ?? "");
      const args = (params.arguments as Record<string, unknown>) ?? {};
      try {
        const data = await callTool(userId, name, args);
        return rpcResult(message.id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
      } catch (err) {
        return rpcResult(message.id, {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : "Tool failed.",
            },
          ],
        });
      }
    }

    default:
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request);
  const userId = await resolveTokenUserId(token);
  if (!userId) {
    return NextResponse.json(
      rpcError(null, -32001, "Unauthorized: invalid or missing bearer token."),
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error."), {
      status: 400,
    });
  }

  // Support both single messages and JSON-RPC batches.
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((m) => handleRpc(m as JsonRpcRequest, userId)),
    );
    const filtered = responses.filter((r) => r !== null);
    return NextResponse.json(filtered);
  }

  const response = await handleRpc(body as JsonRpcRequest, userId);
  if (response === null) {
    return new NextResponse(null, { status: 202 });
  }
  return NextResponse.json(response);
}

export async function GET() {
  // Streamable HTTP clients may probe with GET; we are POST-only (stateless).
  return new NextResponse("Method Not Allowed", { status: 405 });
}
