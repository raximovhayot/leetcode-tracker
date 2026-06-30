"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { approachesAllDone, computeStats } from "@/lib/stats";
import type { Approach, PhaseWithProblems, Problem } from "@/lib/types";

import { Dashboard } from "./dashboard";
import {
  ProblemFormDialog,
  type ProblemFormValues,
} from "./problem-form-dialog";

type Props = {
  initialPhases: PhaseWithProblems[];
  /**
   * The currently active timeline, if any. When present, the tracker defaults
   * to showing only the problems it contains (with a toggle to show all).
   */
  currentTimeline?: { name: string; problemIds: string[] } | null;
};

const difficultyVariant: Record<
  Problem["difficulty"],
  "secondary" | "default" | "destructive"
> = {
  Easy: "secondary",
  Medium: "default",
  Hard: "destructive",
};


export function TrackerGrid({ initialPhases, currentTimeline }: Props) {
  const [phases, setPhases] = useState(initialPhases);
  const hasTimeline =
    Boolean(currentTimeline) && currentTimeline!.problemIds.length > 0;
  // Default to the timeline-focused view whenever an active timeline exists.
  const [timelineOnly, setTimelineOnly] = useState(hasTimeline);

  // When focusing on the current timeline, keep only its problems (and drop
  // phases that end up empty) so the dashboard reflects just that challenge.
  const visiblePhases = useMemo(() => {
    if (!timelineOnly || !currentTimeline) return phases;
    const allowed = new Set(currentTimeline.problemIds);
    return phases
      .map((phase) => ({
        ...phase,
        problems: phase.problems.filter((p) => allowed.has(p.$id)),
      }))
      .filter((phase) => phase.problems.length > 0);
  }, [phases, timelineOnly, currentTimeline]);

  const stats = useMemo(() => computeStats(visiblePhases), [visiblePhases]);
  const phaseOptions = useMemo(
    () => phases.map((p) => ({ id: p.$id, name: p.name })),
    [phases],
  );

  function replaceProblem(updated: Problem) {
    setPhases((prev) =>
      prev.map((phase) => ({
        ...phase,
        problems: phase.problems.map((p) =>
          p.$id === updated.$id ? updated : p,
        ),
      })),
    );
  }

  /** Inserts a problem into its phase (used after a create). */
  function insertProblem(created: Problem) {
    setPhases((prev) =>
      prev.map((phase) =>
        phase.$id === created.phaseId
          ? { ...phase, problems: [...phase.problems, created] }
          : phase,
      ),
    );
  }

  /** Removes a problem from whichever phase it belongs to. */
  function removeProblem(problemId: string) {
    setPhases((prev) =>
      prev.map((phase) => ({
        ...phase,
        problems: phase.problems.filter((p) => p.$id !== problemId),
      })),
    );
  }

  /** Moves/replaces a problem after an edit, handling phase changes too. */
  function applyEditedProblem(updated: Problem) {
    setPhases((prev) =>
      prev.map((phase) => {
        const without = phase.problems.filter((p) => p.$id !== updated.$id);
        if (phase.$id === updated.phaseId) {
          return { ...phase, problems: [...without, updated] };
        }
        return { ...phase, problems: without };
      }),
    );
  }

  async function createProblem(values: ProblemFormValues): Promise<boolean> {
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");
      const { problem } = (await res.json()) as { problem: Problem };
      insertProblem(problem);
      toast.success("Problem added.");
      return true;
    } catch {
      toast.error("Could not add problem. Please try again.");
      return false;
    }
  }

  async function editProblem(
    problem: Problem,
    values: ProblemFormValues,
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/problems/${problem.$id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");
      const { problem: updated } = (await res.json()) as { problem: Problem };
      applyEditedProblem(updated);
      toast.success("Problem updated.");
      return true;
    } catch {
      toast.error("Could not update problem. Please try again.");
      return false;
    }
  }

  async function deleteProblem(problem: Problem) {
    if (!confirm(`Delete problem #${problem.number} \"${problem.title}\"?`)) {
      return;
    }
    removeProblem(problem.$id); // optimistic
    try {
      const res = await fetch(`/api/problems/${problem.$id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Problem deleted.");
    } catch {
      insertProblem(problem); // revert
      toast.error("Could not delete problem. Please try again.");
    }
  }

  async function patchProblem(problem: Problem, body: object, next: Problem) {
    const previous = problem;
    replaceProblem(next); // optimistic
    try {
      const res = await fetch(`/api/problems/${problem.$id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      replaceProblem(previous); // revert
      toast.error("Could not save change. Please try again.");
    }
  }

  function toggleApproach(problem: Problem, index: number, done: boolean) {
    const approaches: Approach[] = problem.approaches.map((a, i) =>
      i === index ? { ...a, done } : a,
    );
    // Mirror the backend: the overall solved flag follows the approaches.
    patchProblem(problem, { approachIndex: index, done }, {
      ...problem,
      approaches,
      solved: approachesAllDone(approaches),
    });
  }


  return (
    <div className="flex flex-col gap-8">
      {hasTimeline && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <p className="text-sm">
            {timelineOnly ? (
              <>
                Showing problems in your current timeline{" "}
                <span className="font-semibold">{currentTimeline!.name}</span>.
              </>
            ) : (
              <>Showing all problems.</>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTimelineOnly((v) => !v)}
          >
            {timelineOnly ? "Show all problems" : "Show current timeline"}
          </Button>
        </div>
      )}

      <Dashboard stats={stats} />

      {visiblePhases.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No problems yet. Use your AI assistant (via the MCP connection) to add
          phases and problems, then refresh.
        </p>
      ) : (
        visiblePhases.map((phase) => (
          <section key={phase.$id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{phase.name}</h2>
              <Badge variant="outline">
                {phase.problems.filter((p) => p.solved).length}/
                {phase.problems.length}
              </Badge>
              <ProblemFormDialog
                phases={phaseOptions}
                defaultPhaseId={phase.$id}
                onSubmit={createProblem}
                trigger={
                  <Button variant="outline" size="sm" className="ml-auto">
                    <Plus data-icon="inline-start" />
                    Add problem
                  </Button>
                }
              />
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="min-w-48">Problem</TableHead>
                    <TableHead className="w-24">Difficulty</TableHead>
                    <TableHead className="w-20">Priority</TableHead>
                    <TableHead className="min-w-64">Approaches</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phase.problems.map((problem) => (
                    <TableRow key={problem.$id}>
                      <TableCell className="text-muted-foreground font-mono">
                        {problem.number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {problem.url ? (
                          <a
                            href={problem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {problem.title}
                          </a>
                        ) : (
                          problem.title
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={difficultyVariant[problem.difficulty]}>
                          {problem.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {problem.must ? (
                          <Badge variant="default">★ MUST</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {problem.approaches.length === 0 ? (
                            <span className="text-muted-foreground text-sm">
                              —
                            </span>
                          ) : (
                            problem.approaches.map((approach, index) => (
                              <label
                                key={index}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={approach.done}
                                  onCheckedChange={(v) =>
                                    toggleApproach(problem, index, v === true)
                                  }
                                />
                                <span
                                  className={
                                    approach.done
                                      ? "text-muted-foreground line-through"
                                      : ""
                                  }
                                >
                                  {approach.name}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ProblemFormDialog
                            phases={phaseOptions}
                            problem={problem}
                            onSubmit={(values) => editProblem(problem, values)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit problem"
                              >
                                <Pencil />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete problem"
                            onClick={() => deleteProblem(problem)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
