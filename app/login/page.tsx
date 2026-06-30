import { redirect } from "next/navigation";

import { LoginButton } from "@/components/auth/login-button";
import { getLoggedInUser } from "@/lib/appwrite/server";

/** Only same-origin relative paths are honored to avoid open redirects. */
function safeNext(next: string | undefined): string | undefined {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getLoggedInUser();
  if (user) redirect(next ?? "/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">LeetCode Study Tracker</h1>
        <p className="text-muted-foreground">
          Track problems, approaches, and progress — and let your AI assistant
          fill it in for you.
        </p>
      </div>
      <LoginButton next={next} />
    </main>
  );
}
