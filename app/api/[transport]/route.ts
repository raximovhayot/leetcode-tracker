import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { resolveTokenUserId } from "@/lib/appwrite/mcp-auth";
import { MCP_SCOPE } from "@/lib/mcp/oauth";
import { callTool } from "@/lib/mcp/tools";

// The Appwrite SDK needs the Node.js runtime. The `[transport]` segment lets
// mcp-handler serve the Streamable HTTP (`/api/mcp`) endpoint from one handler.
export const runtime = "nodejs";

const difficulty = z.enum(["Easy", "Medium", "Hard"]);
const approaches = z
  .array(z.union([z.string(), z.object({ name: z.string(), done: z.boolean().optional() })]))
  .describe("Solution approaches. Each item is a string name or { name, done }.");

const handler = createMcpHandler(
  (server) => {
    /** Registers a tool that runs against the authenticated user's tracker. */
    const tool = <S extends z.ZodRawShape>(
      name: string,
      config: { title: string; description: string; inputSchema: S },
    ) => {
      const cb = async (
        args: Record<string, unknown>,
        extra: { authInfo?: AuthInfo },
      ) => {
        const userId = String(
          (extra.authInfo?.extra as { userId?: string } | undefined)?.userId ?? "",
        );
        const data = await callTool(userId, name, args ?? {});
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      };
      return server.registerTool(name, config, cb as unknown as ToolCallback<S>);
    };

    tool("list_phases", {
      title: "List phases",
      description: "List all phases (categories) in the user's study tracker, in order.",
      inputSchema: {},
    });

    tool("add_phase", {
      title: "Add phase",
      description: "Create a new phase (category) for grouping problems.",
      inputSchema: {
        name: z.string().describe("Phase name, e.g. 'Two Pointers'."),
        order: z.number().optional().describe("Optional sort order."),
      },
    });

    tool("list_problems", {
      title: "List problems",
      description:
        "List problems, optionally filtered to a phase name. Returns numbers, titles and progress.",
      inputSchema: {
        phase: z.string().optional().describe("Optional phase name to filter by."),
      },
    });

    tool("add_problem", {
      title: "Add problem",
      description:
        "Add a single LeetCode problem to a phase. The phase is created automatically if it does not exist.",
      inputSchema: {
        phase: z.string().describe("Phase name to add the problem to."),
        number: z.number().describe("LeetCode problem number."),
        title: z.string().describe("Problem title."),
        url: z.string().optional().describe("LeetCode problem URL."),
        difficulty: difficulty.optional().describe("Problem difficulty."),
        must: z.boolean().optional().describe("Mark as a must-do problem."),
        approaches: approaches.optional(),
      },
    });

    tool("add_problems_bulk", {
      title: "Add problems (bulk)",
      description:
        "Add many problems to one phase in a single call. The phase is created if missing.",
      inputSchema: {
        phase: z.string().describe("Phase name for all problems."),
        problems: z
          .array(
            z.object({
              number: z.number(),
              title: z.string(),
              url: z.string().optional(),
              difficulty: difficulty.optional(),
              must: z.boolean().optional(),
              approaches: approaches.optional(),
            }),
          )
          .describe("Array of problems to add."),
      },
    });

    tool("set_approach_done", {
      title: "Set approach done",
      description:
        "Mark a named approach of a problem as done or not done (matched by problem number).",
      inputSchema: {
        number: z.number().describe("LeetCode problem number."),
        approach: z.string().describe("Approach name to toggle."),
        done: z.boolean().describe("Completion state."),
      },
    });

    tool("set_problem_solved", {
      title: "Set problem solved",
      description: "Mark a problem (by number) as solved or unsolved.",
      inputSchema: {
        number: z.number().describe("LeetCode problem number."),
        solved: z.boolean().describe("Solved state."),
      },
    });

    tool("get_stats", {
      title: "Get stats",
      description:
        "Get the dashboard counters: problems solved, approaches done, progress %, and must-do progress.",
      inputSchema: {},
    });
  },
  {
    serverInfo: { name: "leetcode-tracker", version: "1.0.0" },
    capabilities: { tools: {} },
  },
  {
    // Must match the directory holding the `[transport]` segment.
    basePath: "/api",
    maxDuration: 60,
  },
);

/**
 * Validates the bearer token using our Appwrite-backed issuer. Accepts both
 * signed OAuth 2.1 access tokens and legacy personal tokens, and exposes the
 * resolved userId to tool handlers via `extra.authInfo.extra.userId`.
 */
const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const userId = await resolveTokenUserId(bearerToken);
  if (!userId) return undefined;
  return {
    token: bearerToken,
    scopes: [MCP_SCOPE],
    clientId: userId,
    extra: { userId },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: [MCP_SCOPE],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
