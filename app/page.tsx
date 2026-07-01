import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { TrackerGrid, ALL_TIMELINES } from "@/components/tracker/tracker-grid";
import { Button } from "@/components/ui/button";
import { createSessionClient, getLoggedInUser } from "@/lib/appwrite/server";
import { listTimelinesMeta } from "@/lib/appwrite/timelines";
import {
  groupProblemsByPhase,
  listPhases,
  listAllProblems,
  listProblemsByIds,
} from "@/lib/appwrite/tracker";
import { getTimelineStatus } from "@/lib/stats";
import type { Phase, PhaseWithProblems, Problem, Timeline } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getLoggedInUser();
  if (!user) redirect("/login");

  let phases: PhaseWithProblems[] = [];
  let timelines: Timeline[] = [];
  // Which scope's problems are already loaded into `phases`: either the active
  // timeline's id, or ALL_TIMELINES when the whole collection was read.
  let loadedScope: string = ALL_TIMELINES;
  // Load phases/problems and timelines independently so that a failure loading
  // timelines (e.g. the collection has not been pushed to Appwrite yet) does
  // not also wipe out the problems list.
  try {
    const { databases } = await createSessionClient();

    // Timeline metadata is cheap (no problems join) and tells us whether a
    // timeline is active right now — which lets us scope the problems read.
    try {
      timelines = await listTimelinesMeta(databases, user.$id);
    } catch {
      timelines = [];
    }

    const currentTimeline =
      timelines.find(
        (t) => getTimelineStatus(t.startAt, t.endAt) === "active",
      ) ?? null;

    try {
      let phaseList: Phase[] = [];
      let problems: Problem[] = [];
      if (currentTimeline) {
        // Default view is the active timeline, so read only its problems
        // instead of the entire collection.
        [phaseList, problems] = await Promise.all([
          listPhases(databases, user.$id),
          listProblemsByIds(databases, user.$id, currentTimeline.problemIds),
        ]);
        loadedScope = currentTimeline.$id;
      } else {
        [phaseList, problems] = await Promise.all([
          listPhases(databases, user.$id),
          listAllProblems(databases, user.$id),
        ]);
        loadedScope = ALL_TIMELINES;
      }
      phases = groupProblemsByPhase(phaseList, problems);
    } catch {
      phases = [];
    }
  } catch {
    phases = [];
    timelines = [];
  }

  // The "current" timeline is the one that is active right now. When present,
  // the tracker's filter defaults to showing only the problems it contains.
  const currentTimeline =
    timelines.find(
      (t) => getTimelineStatus(t.startAt, t.endAt) === "active",
    ) ?? null;

  const timelineOptions = timelines.map((t) => ({
    id: t.$id,
    name: t.name,
    problemIds: t.problemIds,
  }));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">LeetCode Study Tracker</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.name || user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/timelines">Timelines</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/sessions">Connect your AI assistant</Link>
          </Button>
          <LogoutButton />
        </div>
      </header>

      <TrackerGrid
        initialPhases={phases}
        timelines={timelineOptions}
        defaultTimelineId={currentTimeline?.$id ?? null}
        initialLoadedScope={loadedScope}
      />
    </main>
  );
}
