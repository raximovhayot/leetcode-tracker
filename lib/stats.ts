import type { PhaseWithProblems, Problem, TrackerStats } from "./types";

/** Overall completion state of a problem, derived from its approaches. */
export type SolveStatus = "solved" | "partial" | "unsolved";

/**
 * Derives a problem's solve status. When the problem has approaches, the status
 * is driven entirely by them (all done = solved, some done = partial, none =
 * unsolved). Without approaches it falls back to the stored `solved` flag.
 */
export function getSolveStatus(problem: Problem): SolveStatus {
  const total = problem.approaches.length;
  if (total > 0) {
    const done = problem.approaches.filter((a) => a.done).length;
    if (done === 0) return "unsolved";
    if (done === total) return "solved";
    return "partial";
  }
  return problem.solved ? "solved" : "unsolved";
}

/** Whether every approach of a problem is done (used to set the `solved` flag). */
export function approachesAllDone(
  approaches: { done: boolean }[],
): boolean {
  return approaches.length > 0 && approaches.every((a) => a.done);
}

/** Lifecycle state of a timeline relative to the current time. */
export type TimelineStatus = "upcoming" | "active" | "ended" | "open";

/**
 * Derives a timeline's status from its start/end window. An empty/invalid date
 * is treated as unset; a timeline with no usable dates is considered "open".
 */
export function getTimelineStatus(
  startAt: string,
  endAt: string,
  now: number = Date.now(),
): TimelineStatus {
  const start = startAt ? Date.parse(startAt) : NaN;
  const end = endAt ? Date.parse(endAt) : NaN;
  const hasStart = !Number.isNaN(start);
  const hasEnd = !Number.isNaN(end);

  if (hasStart && now < start) return "upcoming";
  if (hasEnd && now > end) return "ended";
  if (hasStart || hasEnd) return "active";
  return "open";
}

/**
 * Derives the dashboard counters from the loaded data. Everything is computed
 * in memory so the grid needs only a single fetch (keeps Appwrite reads low).
 */
export function computeStats(phases: PhaseWithProblems[]): TrackerStats {
  const problems: Problem[] = phases.flatMap((p) => p.problems);

  const isSolved = (problem: Problem) => getSolveStatus(problem) !== "unsolved";

  const problemsTotal = problems.length;
  const problemsSolved = problems.filter(isSolved).length;

  let approachesTotal = 0;
  let approachesDone = 0;
  for (const problem of problems) {
    approachesTotal += problem.approaches.length;
    approachesDone += problem.approaches.filter((a) => a.done).length;
  }

  const mustProblems = problems.filter((p) => p.must);
  const mustTotal = mustProblems.length;
  const mustDone = mustProblems.filter(isSolved).length;

  const progress = problemsTotal === 0 ? 0 : problemsSolved / problemsTotal;

  return {
    problemsSolved,
    problemsTotal,
    approachesDone,
    approachesTotal,
    progress,
    mustDone,
    mustTotal,
  };
}
