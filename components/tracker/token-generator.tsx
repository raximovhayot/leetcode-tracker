"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TokenGenerator() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/tokens", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { token: string };
      setToken(data.token);
    } catch {
      toast.error("Could not generate token.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    toast.success("Token copied to clipboard.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your AI assistant</CardTitle>
        <CardDescription>
          Generate a personal token and use it as a Bearer token for the MCP
          endpoint at <code>/api/mcp</code>. The token is shown only once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={generate} disabled={loading} className="self-start">
          Generate MCP token
        </Button>
        {token ? (
          <div className="flex items-center gap-2">
            <code className="bg-muted rounded px-2 py-1 text-sm break-all">
              {token}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              Copy
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
