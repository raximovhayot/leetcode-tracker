"use client";

import { createBrowserClient, OAuthProvider } from "@/lib/appwrite/client";
import { Button } from "@/components/ui/button";

export function LoginButton() {
  function signIn() {
    const { account } = createBrowserClient();
    const origin = window.location.origin;
    account.createOAuth2Token(
      OAuthProvider.Google,
      `${origin}/oauth`,
      `${origin}/login?error=oauth_failed`,
    );
  }

  return (
    <Button onClick={signIn} size="lg">
      Continue with Google
    </Button>
  );
}
