"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeStats } from "@/lib/stats";
import type { Approach, PhaseWithProblems, Problem } from "@/lib/types";

import { Dashboard } from "./dashboard";

type Props = {
  initialPhases: PhaseWithProblems[];
};

const difficultyVariant: Record<
  Problem["difficulty"],
  "secondary" | "default" | "destructive"
> = {
  Easy: "secondary",
  Medium: "default",
  Hard: "destructive",
};

export function TrackerGrid({ initialPhases }: Props) {
  const [phases, setPhases] = useState(initialPhases);
  const stats = useMemo(() => computeStats(phases), [phases]);

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
    patchProblem(problem, { approachIndex: index, done }, {
      ...problem,
      approaches,
    });
  }

  function toggleSolved(problem: Problem, solved: boolean) {
    patchProblem(problem, { solved }, { ...problem, solved });
  }

  return (
    <div className="flex flex-col gap-8">
      <Dashboard stats={stats} />

      {phases.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No problems yet. Use your AI assistant (via the MCP connection) to add
          phases and problems, then refresh.
        </p>
      ) : (
        phases.map((phase) => (
          <section key={phase.$id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{phase.name}</h2>
              <Badge variant="outline">
                {phase.problems.filter((p) => p.solved).length}/
                {phase.problems.length}
              </Badge>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="min-w-48">Problem</TableHead>
                    <TableHead className="w-24">Difficulty</TableHead>
                    <TableHead className="w-20">Priority</TableHead>
                    <TableHead className="w-20 text-center">Solved</TableHead>
                    <TableHead className="min-w-64">Approaches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phase.problems.map((problem) => (
                    <TableRow key={problem.$id}>
                      <TableCell className="text-muted-foreground font-mono">
                        {problem.number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {problem.title}
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
                      <TableCell className="text-center">
                        <Checkbox
                          checked={problem.solved}
                          onCheckedChange={(v) =>
                            toggleSolved(problem, v === true)
                          }
                          aria-label="Solved"
                        />
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
