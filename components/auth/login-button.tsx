"use client";

import { createBrowserClient, OAuthProvider } from "@/lib/appwrite/client";
import { Button } from "@/components/ui/button";

export function LoginButton({ next }: { next?: string }) {
  function signIn() {
    const { account } = createBrowserClient();
    const origin = window.location.origin;
    const success = next
      ? `${origin}/oauth?next=${encodeURIComponent(next)}`
      : `${origin}/oauth`;
    account.createOAuth2Token(
      OAuthProvider.Google,
      success,
      `${origin}/login?error=oauth_failed`,
    );
  }

  return (
    <Button onClick={signIn} size="lg">
      Continue with Google
    </Button>
  );
}
