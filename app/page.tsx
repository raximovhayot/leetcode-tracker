import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { TokenGenerator } from "@/components/tracker/token-generator";
import { TrackerGrid } from "@/components/tracker/tracker-grid";
import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/server";
import { listTracker } from "@/lib/appwrite/tracker";
import type { PhaseWithProblems } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  let phases: PhaseWithProblems[] = [];
  try {
    const { databases } = await createSessionClient();
    phases = await listTracker(databases, user.$id);
  } catch {
    phases = [];
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">LeetCode Study Tracker</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.name || user.email}
          </p>
        </div>
        <LogoutButton />
      </header>

      <TokenGenerator />

      <TrackerGrid initialPhases={phases} />
    </main>
  );
}
