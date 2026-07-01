"use client";

import { useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTimelineStatus, type TimelineStatus } from "@/lib/stats";
import type { PhaseWithProblems, Timeline } from "@/lib/types";

import {
  TimelineFormDialog,
  type TimelineFormValues,
} from "./timeline-form-dialog";

type Props = {
  initialTimelines: Timeline[];
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
  const [timelines, setTimelines] = useState<Timeline[]>(initialTimelines);

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
      setTimelines((prev) => [...prev, timeline]);
      toast.success("Timeline created.");
      return true;
    } catch {
      toast.error("Could not create timeline. Please try again.");
      return false;
    }
  }

  async function editTimeline(
    timeline: Timeline,
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
        prev.map((t) => (t.$id === updated.$id ? updated : t)),
      );
      toast.success("Timeline updated.");
      return true;
    } catch {
      toast.error("Could not update timeline. Please try again.");
      return false;
    }
  }

  async function deleteTimeline(timeline: Timeline) {
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
            const total = timeline.problemIds.length;

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

                <p className="text-muted-foreground text-sm">
                  {total} {total === 1 ? "problem" : "problems"}
                </p>

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
