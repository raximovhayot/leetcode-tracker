"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getTimelineStatus, type TimelineStatus } from "@/lib/stats";
import type {
  PhaseWithProblems,
  Problem,
  Timeline,
  TimelineWithProblems,
} from "@/lib/types";

import {
  TimelineFormDialog,
  type TimelineFormValues,
} from "./timeline-form-dialog";

type Props = {
  initialTimelines: TimelineWithProblems[];
  phases: PhaseWithProblems[];
};

const statusLabel: Record<TimelineStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  ended: "Ended",
  open: "Open",
};

const statusVariant: Record<
  TimelineStatus,
  "secondary" | "default" | "outline" | "destructive"
> = {
  upcoming: "secondary",
  active: "default",
  ended: "destructive",
  open: "outline",
};

const difficultyVariant: Record<
  Problem["difficulty"],
  "secondary" | "default" | "destructive"
> = {
  Easy: "secondary",
  Medium: "default",
  Hard: "destructive",
};

function formatRange(startAt: string, endAt: string): string {
  const fmt = (iso: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };
  const start = fmt(startAt);
  const end = fmt(endAt);
  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "No dates set";
}

export function TimelinesView({ initialTimelines, phases }: Props) {
  const [timelines, setTimelines] = useState(initialTimelines);

  // Resolve problemIds against the loaded phases so client-side updates can
  // rebuild the joined problems without another server fetch.
  const problemsById = useMemo(() => {
    const map = new Map<string, Problem>();
    for (const phase of phases) {
      for (const problem of phase.problems) map.set(problem.$id, problem);
    }
    return map;
  }, [phases]);

  function join(timeline: Timeline): TimelineWithProblems {
    return {
      ...timeline,
      problems: timeline.problemIds
        .map((id) => problemsById.get(id))
        .filter((p): p is Problem => Boolean(p)),
    };
  }

  async function createTimeline(
    values: TimelineFormValues,
  ): Promise<boolean> {
    try {
      const res = await fetch("/api/timelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");
      const { timeline } = (await res.json()) as { timeline: Timeline };
      setTimelines((prev) => [...prev, join(timeline)]);
      toast.success("Timeline created.");
      return true;
    } catch {
      toast.error("Could not create timeline. Please try again.");
      return false;
    }
  }

  async function editTimeline(
    timeline: TimelineWithProblems,
    values: TimelineFormValues,
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/timelines/${timeline.$id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");
      const { timeline: updated } = (await res.json()) as {
        timeline: Timeline;
      };
      setTimelines((prev) =>
        prev.map((t) => (t.$id === updated.$id ? join(updated) : t)),
      );
      toast.success("Timeline updated.");
      return true;
    } catch {
      toast.error("Could not update timeline. Please try again.");
      return false;
    }
  }

  async function deleteTimeline(timeline: TimelineWithProblems) {
    if (!confirm(`Delete timeline "${timeline.name}"?`)) return;
    const previous = timelines;
    setTimelines((prev) => prev.filter((t) => t.$id !== timeline.$id));
    try {
      const res = await fetch(`/api/timelines/${timeline.$id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Timeline deleted.");
    } catch {
      setTimelines(previous);
      toast.error("Could not delete timeline. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your timelines</h2>
        <TimelineFormDialog
          phases={phases}
          onSubmit={createTimeline}
          trigger={
            <Button size="sm">
              <Plus data-icon="inline-start" />
              New timeline
            </Button>
          }
        />
      </div>

      {timelines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No timelines yet. Create one to group problems into a time-boxed
          challenge.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {timelines.map((timeline) => {
            const status = getTimelineStatus(
              timeline.startAt,
              timeline.endAt,
            );
            const total = timeline.problems.length;
            const solved = timeline.problems.filter((p) => p.solved).length;
            const percent = total === 0 ? 0 : Math.round((solved / total) * 100);

            return (
              <div
                key={timeline.$id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{timeline.name}</h3>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <CalendarClock className="size-3.5" />
                      {formatRange(timeline.startAt, timeline.endAt)}
                    </p>
                  </div>
                  <Badge variant={statusVariant[status]}>
                    {statusLabel[status]}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>
                      {solved}/{total} solved
                    </span>
                    <span className="tabular-nums">{percent}%</span>
                  </div>
                  <Progress value={percent} />
                </div>

                {total > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {timeline.problems.map((problem) => (
                      <li
                        key={problem.$id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className={
                            problem.solved
                              ? "text-muted-foreground line-through"
                              : ""
                          }
                        >
                          <span className="text-muted-foreground font-mono">
                            {problem.number}
                          </span>{" "}
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
                        </span>
                        <Badge
                          variant={difficultyVariant[problem.difficulty]}
                          className="ml-auto"
                        >
                          {problem.difficulty}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex justify-end gap-1">
                  <TimelineFormDialog
                    phases={phases}
                    timeline={timeline}
                    onSubmit={(values) => editTimeline(timeline, values)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit timeline"
                      >
                        <Pencil />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete timeline"
                    onClick={() => deleteTimeline(timeline)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
