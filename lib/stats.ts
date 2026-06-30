import type { PhaseWithProblems, Problem, TrackerStats } from "./types";

/**
 * Derives the dashboard counters from the loaded data. Everything is computed
 * in memory so the grid needs only a single fetch (keeps Appwrite reads low).
 */
export function computeStats(phases: PhaseWithProblems[]): TrackerStats {
  const problems: Problem[] = phases.flatMap((p) => p.problems);

  const problemsTotal = problems.length;
  const problemsSolved = problems.filter((p) => p.solved).length;

  let approachesTotal = 0;
  let approachesDone = 0;
  for (const problem of problems) {
    approachesTotal += problem.approaches.length;
    approachesDone += problem.approaches.filter((a) => a.done).length;
  }

  const mustProblems = problems.filter((p) => p.must);
  const mustTotal = mustProblems.length;
  const mustDone = mustProblems.filter((p) => p.solved).length;

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
