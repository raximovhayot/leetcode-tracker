# LeetCode Study Tracker

An interactive, Excel-style LeetCode study tracker. Built with **Next.js (App
Router, TypeScript, Tailwind, shadcn/ui)** and **Appwrite** (Google login +
database). An **MCP endpoint** lets an AI assistant add phases and problems for
you, so you never fill the grid by hand.

```
AI assistant ──(Streamable HTTP MCP, Bearer token)──► /api/mcp
Browser ──(Google login)──► Next.js grid ──► Appwrite (Auth + Database)
```

## Features

- Phase-grouped grid of problems with per-approach checkboxes.
- Live dashboard: problems solved, approaches done, progress %, MUST done.
- **Timelines**: group problems into time-boxed challenges (start/end window)
  with per-timeline status (Upcoming/Active/Ended) and solved progress.
- Optimistic single-row updates (minimal Appwrite reads).
- `/api/mcp` Streamable-HTTP MCP server (built on Vercel's `mcp-handler` +
  the official MCP SDK) with tools to add/update problems.
- Two MCP auth modes: personal **Bearer tokens** and **OAuth 2.1** (PKCE +
  dynamic client registration) for web LLM connectors like ChatGPT/Claude.ai.
- Single-vendor deploy target: **Appwrite Sites** (Next.js SSR supported).

## 1. Appwrite setup

1. Create a project in [Appwrite Cloud](https://cloud.appwrite.io).
2. Enable the **Google** OAuth provider (Auth → Settings) using Google Cloud
   OAuth credentials. Add this success redirect URL:
   `https://<your-domain>/oauth` (and `http://localhost:3000/oauth` for local).
3. Create a **server API key** with scopes:
   `sessions.write`, `databases.read`, `databases.write`,
   `documents.read`, `documents.write`.
4. Push the database schema with the Appwrite CLI:
   ```bash
   npm i -g appwrite-cli
   appwrite login
   # set "projectId" in appwrite.json first, then:
   appwrite push collections
   ```

## 2. App setup

```bash
cp .env.example .env.local   # fill in your project ID + API key
npm install
npm run dev                  # http://localhost:3000
```

## 3. Connecting an AI assistant (MCP)

1. Sign in, then click **Generate MCP token** on the home page (shown once).
2. Point your MCP-capable client at `https://<your-domain>/api/mcp` using the
   token as a **Bearer** token. Example client config:
   ```json
   {
     "mcpServers": {
       "leetcode-tracker": {
         "url": "https://<your-domain>/api/mcp",
         "headers": { "Authorization": "Bearer <your-token>" }
       }
     }
   }
   ```
3. Ask your assistant things like *"Add the NeetCode Two Pointers problems"* —
   it calls `add_problems_bulk` and the grid updates on refresh.

### MCP tools

`list_phases`, `add_phase`, `list_problems`, `add_problem`,
`add_problems_bulk`, `set_approach_done`, `set_problem_solved`, `get_stats`,
`list_timelines`, `create_timeline`, `add_problems_to_timeline`,
`remove_problems_from_timeline`.

## 4. Deploy to Appwrite Sites

Create a Site from this repo with the repository root as the root directory,
framework **Next.js** (install `npm install`, build `npm run build`, output
`./.next`). Add the same
environment variables, then deploy. Update the Google OAuth + Appwrite redirect
URLs to your Site domain.

> The MCP endpoint is served by **`mcp-handler`** (Vercel's adapter around the
> official `@modelcontextprotocol/sdk`) from `app/api/[transport]/route.ts`,
> which exposes the spec-compliant **Streamable HTTP** transport at `/api/mcp`.
> It runs **stateless** (no `REDIS_URL` configured), so it stays compatible with
> Appwrite Sites/Functions, which buffer responses. Bearer tokens are validated
> by `withMcpAuth`, which delegates to our Appwrite-backed token resolver.

### OAuth 2.1 for web LLM connectors

Web connectors (ChatGPT, Claude.ai) require OAuth instead of a pasted token.
This app ships a minimal, **stateless** OAuth 2.1 authorization server that
bridges your existing Appwrite Google login (the transport handles tokens via
`withMcpAuth`; this app remains the authorization server):

- Discovery: `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-authorization-server`.
- Endpoints: `/api/oauth/register` (dynamic client registration),
  `/api/oauth/authorize` (PKCE S256), `/api/oauth/token`.
- Authorization codes and access tokens are HMAC-signed (no extra collection).
  Set `MCP_OAUTH_SECRET` to a long random string in production.

To connect such a client, just point it at `https://<your-domain>/api/mcp`; it
discovers the auth server from the `401` response and walks you through Google
login. No manual token needed.

## Notes / roadmap

- MCP auth supports both **Bearer tokens** (desktop clients) and **OAuth 2.1**
  (web LLM connectors such as ChatGPT/Claude.ai).
- Realtime grid updates can be added later via Appwrite Realtime.
