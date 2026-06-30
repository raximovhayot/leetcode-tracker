/** A single solution approach for a problem, with its completion flag. */
export type Approach = {
  name: string;
  done: boolean;
};

export type Difficulty = "Easy" | "Medium" | "Hard";

/** A LeetCode problem row in the Study Plan grid. */
export type Problem = {
  $id: string;
  number: number;
  title: string;
  url: string;
  difficulty: Difficulty;
  must: boolean;
  solved: boolean;
  order: number;
  phaseId: string;
  approaches: Approach[];
};

/** A phase (category) grouping a set of problems. */
export type Phase = {
  $id: string;
  name: string;
  order: number;
};

/** A phase together with its problems, ready to render. */
export type PhaseWithProblems = Phase & {
  problems: Problem[];
};

/** Derived dashboard counters shown at the top of the grid. */
export type TrackerStats = {
  problemsSolved: number;
  problemsTotal: number;
  approachesDone: number;
  approachesTotal: number;
  progress: number; // 0..1
  mustDone: number;
  mustTotal: number;
};
