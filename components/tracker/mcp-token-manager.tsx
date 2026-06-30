"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type TokenSummary = {
  id: string;
  label: string;
  createdAt: string;
};

export function McpTokenManager() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/tokens");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { tokens: TokenSummary[] };
      setTokens(data.tokens);
    } catch {
      toast.error("Could not load tokens.");
    }
  }

  useEffect(() => {
    // load() updates state only after an awaited fetch, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function generate() {
    setLoading(true);
    try {
      const trimmed = label.trim();
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed ? { label: trimmed } : {}),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { token: string };
      setFresh(data.token);
      setLabel("");
      await load();
    } catch {
      toast.error("Could not generate token.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh);
    toast.success("Token copied to clipboard.");
  }

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Token revoked.");
      await load();
    } catch {
      toast.error("Could not revoke token.");
    }
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
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Token title (e.g. Claude Desktop)"
            className="sm:max-w-xs"
            disabled={loading}
          />
          <Button onClick={generate} disabled={loading} className="self-start">
            Generate MCP token
          </Button>
        </div>

        {fresh ? (
          <div className="flex items-center gap-2">
            <code className="bg-muted rounded px-2 py-1 text-sm break-all">
              {fresh}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              Copy
            </Button>
          </div>
        ) : null}

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Active tokens</p>
          {tokens.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No MCP tokens yet. Generate one to connect an assistant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{token.label}</span>
                    <span className="text-muted-foreground text-xs">
                      Created {new Date(token.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revoke(token.id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
