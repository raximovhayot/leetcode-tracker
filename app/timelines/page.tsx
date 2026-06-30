import Link from "next/link";
import { redirect } from "next/navigation";

import { TimelinesView } from "@/components/tracker/timelines-view";
import { Button } from "@/components/ui/button";
import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/server";
import { listTimelines } from "@/lib/appwrite/timelines";
import { listTracker } from "@/lib/appwrite/tracker";
import type { PhaseWithProblems, TimelineWithProblems } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TimelinesPage() {
  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  let phases: PhaseWithProblems[] = [];
  let timelines: TimelineWithProblems[] = [];
  try {
    const { databases } = await createSessionClient();
    [phases, timelines] = await Promise.all([
      listTracker(databases, user.$id),
      listTimelines(databases, user.$id),
    ]);
  } catch {
    phases = [];
    timelines = [];
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Timelines</h1>
          <p className="text-muted-foreground text-sm">
            Group problems into time-boxed challenges and track your progress.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to tracker</Link>
        </Button>
      </header>

      <TimelinesView initialTimelines={timelines} phases={phases} />
    </main>
  );
}
