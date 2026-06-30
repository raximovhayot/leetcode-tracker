"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginSession = {
  id: string;
  current: boolean;
  provider: string;
  clientName: string;
  osName: string;
  deviceName: string;
  ip: string;
  countryName: string;
  createdAt: string;
};

export function LoginSessions() {
  const router = useRouter();
  const [sessions, setSessions] = useState<LoginSession[]>([]);

  async function load() {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { sessions: LoginSession[] };
      setSessions(data.sessions);
    } catch {
      toast.error("Could not load sessions.");
    }
  }

  useEffect(() => {
    // load() updates state only after an awaited fetch, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function revoke(session: LoginSession) {
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Session signed out.");
      if (session.current) {
        router.refresh();
        return;
      }
      await load();
    } catch {
      toast.error("Could not sign out session.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login sessions</CardTitle>
        <CardDescription>
          Devices and browsers currently signed in to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active sessions.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
              >
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {[session.clientName, session.osName]
                      .filter(Boolean)
                      .join(" • ") || session.provider}
                    {session.current ? (
                      <Badge variant="secondary">This device</Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {[session.ip, session.countryName]
                      .filter(Boolean)
                      .join(" • ")}{" "}
                    · {new Date(session.createdAt).toLocaleString()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revoke(session)}
                >
                  {session.current ? "Sign out" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
