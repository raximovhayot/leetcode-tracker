import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginSessions } from "@/components/tracker/login-sessions";
import { McpTokenManager } from "@/components/tracker/mcp-token-manager";
import { Button } from "@/components/ui/button";
import { getLoggedInUser } from "@/lib/appwrite/server";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-muted-foreground text-sm">
            Manage MCP tokens and active login sessions.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to tracker</Link>
        </Button>
      </header>

      <McpTokenManager />

      <LoginSessions />
    </main>
  );
}
